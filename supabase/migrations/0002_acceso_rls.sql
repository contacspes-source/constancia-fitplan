-- ============================================================================
-- Constancia FitPlan · Migración 0002 · Control de acceso en el servidor
-- Implementa RS-10 (RBAC verificado en cada operación, con independencia de la
-- interfaz) y RS-13 (aislamiento de datos entre clientes) mediante Row Level
-- Security de PostgreSQL. Ninguna política confía en lo que envía el cliente:
-- el rol se lee de public.perfil con el id autenticado (auth.uid()).
-- ============================================================================

-- ---------- Funciones auxiliares (security definer para evitar recursión) ---
create or replace function rol_actual() returns rol_usuario
language sql stable security definer set search_path = public as $$
  select rol from perfil where id = auth.uid() and activo
$$;

create or replace function es_mi_cliente(p_cliente uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from cliente c
    where c.usuario_id = p_cliente
      and (c.entrenador_id = auth.uid() or c.nutriologo_id = auth.uid())
  )
$$;

-- Registra en bitácora un intento denegado (RS-10). Lo invoca la aplicación
-- cuando el servidor rechaza una operación; también puede llamarse desde SQL.
create or replace function registrar_denegado(p_accion varchar, p_detalle text default null)
returns void language sql security definer set search_path = public as $$
  insert into bitacora_acceso (usuario_id, accion, resultado, detalle)
  values (auth.uid(), p_accion, 'DENEGADO', p_detalle)
$$;

-- ---------- Alta automática del perfil al registrarse ----------------------
-- Supabase Auth crea la fila en auth.users; este trigger crea su perfil.
-- El rol viene de raw_user_meta_data.rol y solo se aceptan roles de instructor
-- o cliente: nadie puede registrarse como ADMIN desde la interfaz.
create or replace function fn_crear_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_rol rol_usuario;
begin
  v_rol := coalesce((new.raw_user_meta_data ->> 'rol')::rol_usuario, 'CLIENTE');
  if v_rol = 'ADMIN' then v_rol := 'CLIENTE'; end if;
  insert into perfil (id, nombre, correo, rol)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)), new.email, v_rol);
  return new;
end $$;

create trigger trg_auth_crear_perfil
  after insert on auth.users
  for each row execute function fn_crear_perfil();

-- ---------- Activación de cuenta con código de invitación (CU-12) ----------
-- El cliente ya inició sesión (cuenta recién creada) y presenta su token.
-- Valida vigencia y correo, crea la fila CLIENTE y marca la invitación usada.
create or replace function activar_invitacion(p_token char(64)) returns cliente
language plpgsql security definer set search_path = public as $$
declare inv invitacion%rowtype; v_correo varchar; v_rol_instr rol_usuario; nuevo cliente%rowtype;
begin
  select correo into v_correo from perfil where id = auth.uid();
  select * into inv from invitacion where token = p_token for update;
  if not found or inv.usada_en is not null or inv.expira_en < now() then
    perform registrar_denegado('activar_invitacion', 'token inválido, usado o caducado');
    raise exception 'El código de invitación no es válido o ya caducó. Solicite uno nuevo a su instructor.';
  end if;
  if lower(inv.correo) <> lower(v_correo) then
    perform registrar_denegado('activar_invitacion', 'correo no coincide');
    raise exception 'El código de invitación no corresponde a esta cuenta.';
  end if;
  select rol into v_rol_instr from perfil where id = inv.instructor_id;
  insert into cliente (usuario_id, entrenador_id, nutriologo_id)
  values (auth.uid(),
          case when v_rol_instr = 'ENTRENADOR' then inv.instructor_id else null end,
          case when v_rol_instr = 'NUTRIOLOGO' then inv.instructor_id else null end)
  on conflict (usuario_id) do update
    set entrenador_id = coalesce(excluded.entrenador_id, cliente.entrenador_id),
        nutriologo_id = coalesce(excluded.nutriologo_id, cliente.nutriologo_id)
  returning * into nuevo;
  update perfil set nombre = inv.nombre, rol = 'CLIENTE' where id = auth.uid();
  update invitacion set usada_en = now(), cliente_id = auth.uid() where id = inv.id;
  return nuevo;
end $$;

-- ---------- Fecha del servidor (RS-06: la fecha la define el servidor) -----
create or replace function fecha_servidor() returns date
language sql stable as $$ select (now() at time zone 'America/Mexico_City')::date $$;

-- ---------- Activar RLS en todas las tablas --------------------------------
alter table perfil                enable row level security;
alter table cliente               enable row level security;
alter table invitacion            enable row level security;
alter table bitacora_acceso       enable row level security;
alter table ejercicio             enable row level security;
alter table alimento              enable row level security;
alter table rutina                enable row level security;
alter table rutina_ejercicio      enable row level security;
alter table plan_alimenticio      enable row level security;
alter table tiempo_comida         enable row level security;
alter table porcion_alimento      enable row level security;
alter table asignacion            enable row level security;
alter table registro_cumplimiento enable row level security;
alter table comentario_comida     enable row level security;

-- ---------- perfil ----------------------------------------------------------
create policy perfil_propio_sel on perfil for select using (id = auth.uid());
-- El usuario edita su propio perfil pero no puede cambiarse el rol. Se compara
-- con rol_actual() (security definer) para no consultar perfil dentro de su
-- propia política, lo que causaría recursión infinita.
create policy perfil_propio_upd on perfil for update using (id = auth.uid()) with check (id = auth.uid() and rol = rol_actual());
create policy perfil_admin_all  on perfil for all using (rol_actual() = 'ADMIN');
-- El instructor ve el perfil de sus clientes; el cliente ve el de sus instructores.
create policy perfil_instructor_ve_clientes on perfil for select using (es_mi_cliente(id));
create policy perfil_cliente_ve_instructores on perfil for select using (
  exists (select 1 from cliente c where c.usuario_id = auth.uid() and (c.entrenador_id = perfil.id or c.nutriologo_id = perfil.id))
);

-- ---------- cliente ---------------------------------------------------------
create policy cliente_propio      on cliente for select using (usuario_id = auth.uid());
create policy cliente_instructor  on cliente for select using (entrenador_id = auth.uid() or nutriologo_id = auth.uid());
create policy cliente_instr_upd   on cliente for update using (entrenador_id = auth.uid() or nutriologo_id = auth.uid());
create policy cliente_admin       on cliente for all using (rol_actual() = 'ADMIN');

-- ---------- invitacion (solo instructores sobre las suyas) -----------------
create policy invitacion_instructor on invitacion for all
  using (instructor_id = auth.uid() and rol_actual() in ('ENTRENADOR', 'NUTRIOLOGO'))
  with check (instructor_id = auth.uid() and rol_actual() in ('ENTRENADOR', 'NUTRIOLOGO'));

-- ---------- bitácora: solo admin lee; escribe la función registrar_denegado -
create policy bitacora_admin on bitacora_acceso for select using (rol_actual() = 'ADMIN');

-- ---------- catálogos: lectura para todos los autenticados, escritura admin --
create policy ejercicio_lectura on ejercicio for select using (auth.uid() is not null and activo);
create policy ejercicio_admin   on ejercicio for all using (rol_actual() = 'ADMIN');
create policy alimento_lectura  on alimento  for select using (auth.uid() is not null and activo);
create policy alimento_admin    on alimento  for all using (rol_actual() = 'ADMIN');

-- ---------- rutinas: el entrenador creador; lectura para su cliente asignado
create policy rutina_entrenador on rutina for all
  using (entrenador_id = auth.uid())
  with check (entrenador_id = auth.uid() and rol_actual() = 'ENTRENADOR');
create policy rutina_cliente_asignado on rutina for select using (
  exists (select 1 from asignacion a where a.rutina_id = rutina.id and a.cliente_id = auth.uid())
);
create policy rutina_ejercicio_entrenador on rutina_ejercicio for all
  using (exists (select 1 from rutina r where r.id = rutina_id and r.entrenador_id = auth.uid()))
  with check (exists (select 1 from rutina r where r.id = rutina_id and r.entrenador_id = auth.uid()));
create policy rutina_ejercicio_cliente on rutina_ejercicio for select using (
  exists (select 1 from asignacion a where a.rutina_id = rutina_ejercicio.rutina_id and a.cliente_id = auth.uid())
);

-- ---------- planes: el nutriólogo creador; lectura para su cliente asignado -
create policy plan_nutriologo on plan_alimenticio for all
  using (nutriologo_id = auth.uid())
  with check (nutriologo_id = auth.uid() and rol_actual() = 'NUTRIOLOGO');
create policy plan_cliente_asignado on plan_alimenticio for select using (
  exists (select 1 from asignacion a where a.plan_id = plan_alimenticio.id and a.cliente_id = auth.uid())
);
create policy tiempo_nutriologo on tiempo_comida for all
  using (exists (select 1 from plan_alimenticio p where p.id = plan_id and p.nutriologo_id = auth.uid()))
  with check (exists (select 1 from plan_alimenticio p where p.id = plan_id and p.nutriologo_id = auth.uid()));
create policy tiempo_cliente on tiempo_comida for select using (
  exists (select 1 from asignacion a where a.plan_id = tiempo_comida.plan_id and a.cliente_id = auth.uid())
);
create policy porcion_nutriologo on porcion_alimento for all
  using (exists (select 1 from tiempo_comida t join plan_alimenticio p on p.id = t.plan_id where t.id = tiempo_id and p.nutriologo_id = auth.uid()))
  with check (exists (select 1 from tiempo_comida t join plan_alimenticio p on p.id = t.plan_id where t.id = tiempo_id and p.nutriologo_id = auth.uid()));
create policy porcion_cliente on porcion_alimento for select using (
  exists (select 1 from tiempo_comida t join asignacion a on a.plan_id = t.plan_id where t.id = porcion_alimento.tiempo_id and a.cliente_id = auth.uid())
);

-- ---------- asignaciones: el instructor sobre sus clientes; el cliente lee --
create policy asignacion_instructor on asignacion for all
  using (es_mi_cliente(cliente_id))
  with check (es_mi_cliente(cliente_id) and asignado_por = auth.uid());
create policy asignacion_cliente on asignacion for select using (cliente_id = auth.uid());

-- ---------- cumplimiento: el cliente escribe SOLO sus marcas del día actual --
-- (RS-07: no se puede marcar ni desmarcar un día distinto al de hoy;
--  RS-10: el cliente solo escribe sobre sus marcas de completado.)
create policy registro_cliente_sel on registro_cumplimiento for select using (cliente_id = auth.uid());
create policy registro_cliente_ins on registro_cumplimiento for insert
  with check (cliente_id = auth.uid() and fecha = fecha_servidor());
create policy registro_cliente_upd on registro_cumplimiento for update
  using (cliente_id = auth.uid() and fecha = fecha_servidor())
  with check (cliente_id = auth.uid() and fecha = fecha_servidor());
create policy registro_instructor_sel on registro_cumplimiento for select using (es_mi_cliente(cliente_id));

-- ---------- comentarios de comida (CU-15) -----------------------------------
create policy comentario_cliente on comentario_comida for all
  using (cliente_id = auth.uid()) with check (cliente_id = auth.uid());
create policy comentario_instructor on comentario_comida for select using (es_mi_cliente(cliente_id));

-- ---------- Vista del panel de adherencia (RS-05) ---------------------------
-- Programados = elementos (ejercicios del día + tiempos de comida) de las
-- asignaciones vigentes del cliente en cada día de la ventana.
-- Completados = marcas con completado = true en esos días.
-- Si programados = 0 → adherencia nula ("no determinable"), nunca 0 %.
-- security definer: el entrenador no puede leer los tiempos de comida del plan
-- del nutriólogo (ni el nutriólogo los ejercicios de la rutina), y con permisos
-- del invocador esos elementos desaparecían del conteo sin error. La función
-- sigue limitada a la cartera de auth.uid() (CTE mis_clientes), así que no
-- expone datos de clientes ajenos. Defecto detectado en pruebas (Act. 14).
create or replace function adherencia_cartera(p_dias int)
returns table (cliente_id uuid, nombre varchar, programados bigint, completados bigint, adherencia numeric)
language sql stable security definer set search_path = public as $$
  with dias as (
    select generate_series(fecha_servidor() - (p_dias - 1), fecha_servidor(), interval '1 day')::date as d
  ),
  mis_clientes as (
    select c.usuario_id, p.nombre from cliente c join perfil p on p.id = c.usuario_id
    where c.entrenador_id = auth.uid() or c.nutriologo_id = auth.uid()
  ),
  prog as (
    select mc.usuario_id,
      count(re.id) filter (where re.id is not null) as ej,
      (select count(*) from asignacion a2 join tiempo_comida t on t.plan_id = a2.plan_id
         where a2.cliente_id = mc.usuario_id and d.d between a2.fecha_inicio and a2.fecha_fin) as com
    from mis_clientes mc
    cross join dias d
    left join asignacion a on a.cliente_id = mc.usuario_id and a.rutina_id is not null and d.d between a.fecha_inicio and a.fecha_fin
    left join rutina_ejercicio re on re.rutina_id = a.rutina_id and re.dia_semana = extract(isodow from d.d)
    group by mc.usuario_id, d.d
  ),
  totales as (
    select usuario_id, sum(ej + com) as programados from prog group by usuario_id
  ),
  marcas as (
    select r.cliente_id, count(*) as completados
    from registro_cumplimiento r
    where r.completado and r.fecha between fecha_servidor() - (p_dias - 1) and fecha_servidor()
    group by r.cliente_id
  )
  select mc.usuario_id                                   as cliente_id,
         mc.nombre                                       as nombre,
         coalesce(t.programados, 0)::bigint              as programados,
         coalesce(m.completados, 0)::bigint              as completados,
         case when coalesce(t.programados, 0) = 0 then null
              else round(least(coalesce(m.completados, 0), t.programados) * 100.0 / t.programados, 1)
         end                                             as adherencia
  from mis_clientes mc
  left join totales t on t.usuario_id = mc.usuario_id
  left join marcas  m on m.cliente_id = mc.usuario_id
  order by 5 asc nulls last, 2
$$;

-- Ventanas válidas según RS-05: solo 7 y 30 días.
create or replace function adherencia_cartera_validada(p_dias int)
returns table (cliente_id uuid, nombre varchar, programados bigint, completados bigint, adherencia numeric)
language plpgsql stable security invoker set search_path = public as $$
begin
  if p_dias not in (7, 30) then
    raise exception 'La ventana de adherencia debe ser de 7 o 30 días.';
  end if;
  return query select * from adherencia_cartera(p_dias);
end $$;
