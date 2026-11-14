-- ============================================================================
-- Constancia FitPlan · Migración 0001 · Esquema de la base de datos
-- Origen: Diagrama entidad-relación v2 (Actividad 12) y requerimientos de la
-- ERS (Actividad 6). Cada restricción indica el requerimiento que la motiva.
--
-- Adaptaciones respecto al ER (ver docs/DECISIONES.md, ADR-003):
--   · USUARIO se divide en auth.users (gestionado por Supabase Auth: hash de
--     contraseña, sesiones, TLS → RS-12) y public.perfil (nombre, rol, activo).
--   · INVITACION se crea antes que CLIENTE: el instructor da de alta nombre y
--     correo (RS-03) y la fila de CLIENTE nace cuando el cliente activa su cuenta.
--   · ALIMENTO agrega gramos_por_pieza para poder calcular macros de porciones
--     en PIEZA (RS-02 exige unidad "piezas"; el cálculo necesita su equivalencia).
-- ============================================================================

-- ---------- Tipos enumerados ------------------------------------------------
create type rol_usuario      as enum ('ADMIN', 'ENTRENADOR', 'NUTRIOLOGO', 'CLIENTE');
create type tipo_comida      as enum ('DESAYUNO', 'COLACION1', 'COMIDA', 'COLACION2', 'CENA');
create type unidad_porcion   as enum ('G', 'ML', 'PIEZA');
create type resultado_acceso as enum ('OK', 'DENEGADO');

-- ---------- M1. Acceso y cuentas -------------------------------------------
create table perfil (
  id         uuid primary key references auth.users (id) on delete cascade,
  nombre     varchar(100) not null check (char_length(nombre) between 2 and 100),
  correo     varchar(120) not null unique,
  rol        rol_usuario  not null,
  activo     boolean      not null default true,
  creado_en  timestamptz  not null default now()
);
comment on table perfil is 'USUARIO del ER. Credenciales en auth.users (RS-10, RS-12).';

create table cliente (
  usuario_id    uuid primary key references perfil (id) on delete cascade,
  entrenador_id uuid references perfil (id),
  nutriologo_id uuid references perfil (id),
  objetivo      varchar(150),
  constraint cliente_con_instructor check (entrenador_id is not null or nutriologo_id is not null)
);
comment on table cliente is 'Un cliente pertenece a un solo entrenador y a un solo nutriólogo a la vez (RS-03, Act. 12 §7). Al menos uno de los dos.';

create table invitacion (
  id            bigint generated always as identity primary key,
  instructor_id uuid not null references perfil (id),
  nombre        varchar(100) not null,
  correo        varchar(120) not null,
  token         char(64) not null unique,
  expira_en     timestamptz not null,
  usada_en      timestamptz,
  cliente_id    uuid references cliente (usuario_id)
);
comment on table invitacion is 'Código de invitación con vigencia de 72 h (RS-03, CU-03, CU-12).';

create table bitacora_acceso (
  id         bigint generated always as identity primary key,
  usuario_id uuid references perfil (id),
  accion     varchar(60) not null,
  resultado  resultado_acceso not null,
  detalle    text,
  fecha      timestamptz not null default now()
);
comment on table bitacora_acceso is 'Operaciones denegadas que exige RS-10.';

-- ---------- Catálogos (Administrador) --------------------------------------
create table ejercicio (
  id               bigint generated always as identity primary key,
  nombre           varchar(100) not null,
  grupo_muscular   varchar(50)  not null,
  descripcion      text,
  url_demostracion varchar(255),
  activo           boolean not null default true
);

create table alimento (
  id                bigint generated always as identity primary key,
  nombre            varchar(100) not null,
  kcal_100          numeric(6,2) not null check (kcal_100 >= 0),
  proteina_100      numeric(6,2) not null check (proteina_100 >= 0),
  carbohidratos_100 numeric(6,2) not null check (carbohidratos_100 >= 0),
  grasa_100         numeric(6,2) not null check (grasa_100 >= 0),
  gramos_por_pieza  numeric(6,2) check (gramos_por_pieza > 0),
  activo            boolean not null default true
);
comment on column alimento.gramos_por_pieza is 'Equivalencia para porciones en PIEZA; nulo si el alimento no se mide por pieza.';

-- ---------- M3. Rutinas y ejercicios ---------------------------------------
create table rutina (
  id            bigint generated always as identity primary key,
  entrenador_id uuid not null references perfil (id),
  nombre        varchar(100) not null check (char_length(nombre) between 3 and 100),
  objetivo      text,
  es_plantilla  boolean not null default false,
  origen_id     bigint references rutina (id) on delete set null,
  creado_en     timestamptz not null default now()
);
comment on column rutina.entrenador_id is 'Se fija al crear y no cambia: asociación inmutable (RS-01).';

create table rutina_ejercicio (
  id            bigint generated always as identity primary key,
  rutina_id     bigint not null references rutina (id) on delete cascade,
  ejercicio_id  bigint not null references ejercicio (id),
  dia_semana    smallint not null check (dia_semana between 1 and 7),
  series        smallint not null check (series between 1 and 50),
  repeticiones  varchar(10) not null check (repeticiones ~ '^[1-9][0-9]*(-[1-9][0-9]*)?$'),
  carga_kg      numeric(5,2) not null check (carga_kg >= 0),
  descanso_seg  smallint not null check (descanso_seg >= 0),
  orden         smallint not null default 0
);
comment on table rutina_ejercicio is 'Rangos de RS-01: día 1-7, series 1-50, reps "12" o "10-12", carga ≥ 0, descanso ≥ 0.';

-- ---------- M4. Nutrición ---------------------------------------------------
create table plan_alimenticio (
  id            bigint generated always as identity primary key,
  nutriologo_id uuid not null references perfil (id),
  nombre        varchar(100) not null check (char_length(nombre) between 3 and 100),
  es_plantilla  boolean not null default false,
  origen_id     bigint references plan_alimenticio (id) on delete set null,
  creado_en     timestamptz not null default now()
);

create table tiempo_comida (
  id      bigint generated always as identity primary key,
  plan_id bigint not null references plan_alimenticio (id) on delete cascade,
  tipo    tipo_comida not null,
  unique (plan_id, tipo)
);

create table porcion_alimento (
  id           bigint generated always as identity primary key,
  tiempo_id    bigint not null references tiempo_comida (id) on delete cascade,
  alimento_id  bigint references alimento (id) on delete set null,
  nombre_copia varchar(100) not null,
  cantidad     numeric(7,2) not null check (cantidad > 0),
  unidad       unidad_porcion not null
);
comment on column porcion_alimento.nombre_copia is 'Copia en texto para que el plan siga legible si el alimento sale del catálogo (RS-02).';

-- ---------- M2. Asignaciones -----------------------------------------------
create table asignacion (
  id           bigint generated always as identity primary key,
  cliente_id   uuid not null references cliente (usuario_id) on delete cascade,
  asignado_por uuid not null references perfil (id),
  rutina_id    bigint references rutina (id),
  plan_id      bigint references plan_alimenticio (id),
  fecha_inicio date not null,
  fecha_fin    date not null,
  creado_en    timestamptz not null default now(),
  constraint asignacion_periodo_valido check (fecha_fin >= fecha_inicio),
  constraint asignacion_un_programa check (
    (rutina_id is not null and plan_id is null) or (rutina_id is null and plan_id is not null)
  )
);
comment on table asignacion is 'Exactamente una rutina o un plan; fecha_fin ≥ fecha_inicio (RS-03). El no-solape se valida en negocio (trigger abajo).';

-- Regla de negocio RS-03: un cliente no puede tener dos rutinas (ni dos planes)
-- vigentes en periodos que se traslapen. Se valida en el servidor.
create or replace function fn_validar_solape_asignacion() returns trigger
language plpgsql as $$
declare conflicto asignacion%rowtype;
begin
  select a.* into conflicto
  from asignacion a
  where a.cliente_id = new.cliente_id
    and a.id is distinct from new.id
    and ((new.rutina_id is not null and a.rutina_id is not null)
      or (new.plan_id   is not null and a.plan_id   is not null))
    and a.fecha_inicio <= new.fecha_fin
    and a.fecha_fin    >= new.fecha_inicio
  limit 1;
  if found then
    raise exception 'El periodo se solapa con la asignación % (% a %).',
      conflicto.id, conflicto.fecha_inicio, conflicto.fecha_fin
      using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger trg_asignacion_sin_solape
  before insert or update on asignacion
  for each row execute function fn_validar_solape_asignacion();

-- ---------- M5. Vista del día y cumplimiento -------------------------------
create table registro_cumplimiento (
  id                  bigint generated always as identity primary key,
  cliente_id          uuid not null references cliente (usuario_id) on delete cascade,
  fecha               date not null,
  rutina_ejercicio_id bigint references rutina_ejercicio (id) on delete cascade,
  tiempo_comida_id    bigint references tiempo_comida (id) on delete cascade,
  completado          boolean not null default true,
  marcado_en          timestamptz not null default now(),
  constraint registro_un_elemento check (
    (rutina_ejercicio_id is not null and tiempo_comida_id is null)
    or (rutina_ejercicio_id is null and tiempo_comida_id is not null)
  )
);
-- No duplicidad (RS-07): una marca por cliente, fecha y elemento. Los índices
-- únicos parciales permiten usar UPSERT desde la aplicación.
create unique index registro_unico_ejercicio
  on registro_cumplimiento (cliente_id, fecha, rutina_ejercicio_id)
  where rutina_ejercicio_id is not null;
create unique index registro_unico_comida
  on registro_cumplimiento (cliente_id, fecha, tiempo_comida_id)
  where tiempo_comida_id is not null;

create table comentario_comida (
  id               bigint generated always as identity primary key,
  cliente_id       uuid not null references cliente (usuario_id) on delete cascade,
  tiempo_comida_id bigint not null references tiempo_comida (id) on delete cascade,
  fecha            date not null,
  texto            varchar(500) not null,
  creado_en        timestamptz not null default now()
);
comment on table comentario_comida is 'CU-15 / RS-17 propuesto (Could Have). Tabla creada; interfaz fuera del alcance de v1.';

-- ---------- Índices de consulta --------------------------------------------
create index idx_cliente_entrenador on cliente (entrenador_id);
create index idx_cliente_nutriologo on cliente (nutriologo_id);
create index idx_asignacion_cliente_fechas on asignacion (cliente_id, fecha_inicio, fecha_fin);
create index idx_registro_cliente_fecha on registro_cumplimiento (cliente_id, fecha);
create index idx_rutina_entrenador on rutina (entrenador_id);
create index idx_plan_nutriologo on plan_alimenticio (nutriologo_id);
