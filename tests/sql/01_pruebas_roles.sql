-- Pruebas de servidor (RLS, triggers, funciones) actuando como cada rol.
-- Ejecutar en una base de PRUEBA después de 00_simulacion_supabase.sql y las 3 migraciones.
-- NO ejecutar en el proyecto real: crea usuarios ficticios.
-- Cada bloque T## indica el resultado esperado; los marcados 'defecto' deben fallar.
\set ON_ERROR_STOP 0
-- Usuarios (simula supabase.auth.signUp)
insert into auth.users (id,email,raw_user_meta_data) values
 ('11111111-1111-1111-1111-111111111111','ent@x.com','{"nombre":"Entrenador Uno","rol":"ENTRENADOR"}'),
 ('22222222-2222-2222-2222-222222222222','nut@x.com','{"nombre":"Nutri Uno","rol":"NUTRIOLOGO"}'),
 ('33333333-3333-3333-3333-333333333333','cli@x.com','{"rol":"CLIENTE"}'),
 ('44444444-4444-4444-4444-444444444444','otro@x.com','{"rol":"CLIENTE"}'),
 ('55555555-5555-5555-5555-555555555555','hack@x.com','{"nombre":"Hacker","rol":"ADMIN"}');
\echo '-- T1 perfiles creados por trigger; ADMIN degradado a CLIENTE'
select correo, rol from perfil order by correo;

set role authenticated;
-- ===== Entrenador
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
insert into invitacion (instructor_id,nombre,correo,token,expira_en) values
 ('11111111-1111-1111-1111-111111111111','Cliente Uno','cli@x.com',repeat('a',64),now()+interval '72 hours');
\echo '-- T2 entrenador crea rutina valida'
insert into rutina (entrenador_id,nombre) values ('11111111-1111-1111-1111-111111111111','Fuerza A') returning id;
insert into rutina_ejercicio (rutina_id,ejercicio_id,dia_semana,series,repeticiones,carga_kg,descanso_seg)
  select r.id, 1, d, 3, '10-12', 60, 90 from rutina r, generate_series(1,7) d;
\echo '-- T3 defecto: series 0 debe fallar (CHECK)'
insert into rutina_ejercicio (rutina_id,ejercicio_id,dia_semana,series,repeticiones,carga_kg,descanso_seg) select id,1,1,0,'10',0,0 from rutina limit 1;
\echo '-- T4 defecto: entrenador no puede crear rutina a nombre de otro'
insert into rutina (entrenador_id,nombre) values ('22222222-2222-2222-2222-222222222222','Robada');

-- ===== Nutriólogo
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
insert into invitacion (instructor_id,nombre,correo,token,expira_en) values
 ('22222222-2222-2222-2222-222222222222','Cliente Uno','cli@x.com',repeat('b',64),now()+interval '72 hours');
insert into plan_alimenticio (nutriologo_id,nombre) values ('22222222-2222-2222-2222-222222222222','Plan base');
insert into tiempo_comida (plan_id,tipo) select id, t::tipo_comida from plan_alimenticio, unnest(array['DESAYUNO','COMIDA','CENA']) t;
insert into porcion_alimento (tiempo_id,alimento_id,nombre_copia,cantidad,unidad) select id,1,'Pollo',150,'G' from tiempo_comida;
\echo '-- T5 defecto: entrenador no puede crear planes (rol)'
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
insert into plan_alimenticio (nutriologo_id,nombre) values ('11111111-1111-1111-1111-111111111111','No debo');

-- ===== Cliente activa con los dos códigos
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
\echo '-- T6 activar invitacion entrenador y luego nutriologo'
select entrenador_id is not null as tiene_ent, nutriologo_id is not null as tiene_nut from activar_invitacion(repeat('a',64));
select entrenador_id is not null as tiene_ent, nutriologo_id is not null as tiene_nut from activar_invitacion(repeat('b',64));
\echo '-- T7 defecto: reutilizar codigo'
select activar_invitacion(repeat('a',64));

-- ===== Asignaciones
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
\echo '-- T8 asignar rutina vigente'
insert into asignacion (cliente_id,asignado_por,rutina_id,fecha_inicio,fecha_fin)
  select '33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111',id,fecha_servidor()-6,fecha_servidor()+20 from rutina limit 1;
\echo '-- T9 defecto: solape de rutinas'
insert into asignacion (cliente_id,asignado_por,rutina_id,fecha_inicio,fecha_fin)
  select '33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111',id,fecha_servidor(),fecha_servidor()+5 from rutina limit 1;
\echo '-- T10 defecto: fin antes de inicio'
insert into asignacion (cliente_id,asignado_por,rutina_id,fecha_inicio,fecha_fin)
  select '33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111',id,'2027-02-10','2027-02-01' from rutina limit 1;
\echo '-- T11 defecto: asignar a un cliente ajeno'
insert into asignacion (cliente_id,asignado_por,rutina_id,fecha_inicio,fecha_fin)
  select '44444444-4444-4444-4444-444444444444','11111111-1111-1111-1111-111111111111',id,'2027-03-01','2027-03-10' from rutina limit 1;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
insert into asignacion (cliente_id,asignado_por,plan_id,fecha_inicio,fecha_fin)
  select '33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222',id,fecha_servidor()-6,fecha_servidor()+20 from plan_alimenticio limit 1;

-- ===== Cliente marca cumplimiento
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
\echo '-- T12 cliente ve su rutina y plan'
select (select count(*) from rutina) rutinas, (select count(*) from rutina_ejercicio) ejercicios, (select count(*) from tiempo_comida) comidas;
insert into registro_cumplimiento (cliente_id,fecha,rutina_ejercicio_id)
  select '33333333-3333-3333-3333-333333333333',fecha_servidor(),id from rutina_ejercicio where dia_semana=extract(isodow from fecha_servidor());
insert into registro_cumplimiento (cliente_id,fecha,tiempo_comida_id)
  select '33333333-3333-3333-3333-333333333333',fecha_servidor(),id from tiempo_comida limit 2;
\echo '-- T13 doble marca con upsert no duplica'
insert into registro_cumplimiento (cliente_id,fecha,tiempo_comida_id)
  select '33333333-3333-3333-3333-333333333333',fecha_servidor(),id from tiempo_comida limit 1
  on conflict (cliente_id,fecha,tiempo_comida_id) where tiempo_comida_id is not null do update set completado=true, marcado_en=now();
select count(*) as marcas from registro_cumplimiento;
\echo '-- T14 defecto: marcar dia anterior'
insert into registro_cumplimiento (cliente_id,fecha,tiempo_comida_id) select '33333333-3333-3333-3333-333333333333',fecha_servidor()-1,id from tiempo_comida limit 1;
\echo '-- T15 defecto: cliente edita su rol'
update perfil set rol='ADMIN' where id=auth.uid();
select rol from perfil where id=auth.uid();
\echo '-- T16 cliente edita su nombre (sin recursion)'
update perfil set nombre='Cliente Uno Editado' where id=auth.uid();
select nombre from perfil where id=auth.uid();

-- ===== Aislamiento
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false);
\echo '-- T17 otro cliente no ve nada ajeno'
select (select count(*) from rutina) r,(select count(*) from registro_cumplimiento) m,(select count(*) from perfil) p,(select count(*) from asignacion) a;

-- ===== Adherencia
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
\echo '-- T18 adherencia 7 y 30 dias (entrenador)'
select nombre, programados, completados, adherencia from adherencia_cartera(7);
select nombre, programados, completados, adherencia from adherencia_cartera(30);
reset role;
