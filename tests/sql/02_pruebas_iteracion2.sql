-- Pruebas de servidor de la iteración 2 (ejecutar después de 01_pruebas_roles.sql, en base de PRUEBA).
-- Cubren las operaciones que hacen las pantallas de rutinas, planes y clientes.
\set ON_ERROR_STOP 0
-- Segundo entrenador (se crea como superusuario, igual que lo haría Supabase Auth).
insert into auth.users (id,email,raw_user_meta_data) values
 ('66666666-6666-6666-6666-666666666666','ent2@x.com','{"nombre":"Entrenador Dos","rol":"ENTRENADOR"}');
set role authenticated;

-- ===== Entrenador ve el perfil de su cliente (consulta de la cartera)
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
\echo '-- T22 cartera del entrenador con nombre del cliente (embed cliente->perfil)'
select p.nombre, p.correo from cliente c join perfil p on p.id = c.usuario_id;

\echo '-- T23 entrenador reemite su invitacion (update) y cancela otra (delete)'
insert into invitacion (instructor_id,nombre,correo,token,expira_en) values
 ('11111111-1111-1111-1111-111111111111','Pendiente','pend@x.com',repeat('c',64),now()-interval '1 hour');
update invitacion set token = repeat('d',64), expira_en = now()+interval '72 hours' where correo='pend@x.com' and usada_en is null returning correo, expira_en > now() as vigente;
delete from invitacion where correo='pend@x.com' returning correo;

-- ===== Otro entrenador intenta tocar rutinas ajenas
select set_config('request.jwt.claim.sub','66666666-6666-6666-6666-666666666666',false);
\echo '-- T24 defecto: entrenador 2 edita rutina ajena -> 0 filas (la app muestra "No tiene permisos")'
update rutina set nombre='Hackeada' where id=1 returning id;
\echo '-- T25 defecto: entrenador 2 elimina rutina ajena -> 0 filas'
delete from rutina where id=1 returning id;
\echo '-- T26 defecto: entrenador 2 no ve la cartera del entrenador 1'
select count(*) as clientes_visibles from cliente;

-- ===== Entrenador 1 elimina rutina asignada
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
\echo '-- T27 defecto: eliminar rutina asignada -> violacion de llave foranea (23503)'
delete from rutina where id=1;

-- ===== D7: el entrenador no puede quitar ni alterar la asignacion del nutriologo
\echo '-- T28 defecto (D7): entrenador borra asignacion de plan del nutriologo -> 0 filas'
delete from asignacion where plan_id is not null returning id;
\echo '-- T29 defecto (D7): entrenador asigna una rutina ajena'
select set_config('request.jwt.claim.sub','66666666-6666-6666-6666-666666666666',false);
insert into rutina (entrenador_id,nombre) values ('66666666-6666-6666-6666-666666666666','Ajena') returning id \gset
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
insert into asignacion (cliente_id,asignado_por,rutina_id,fecha_inicio,fecha_fin)
 values ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111',:id,'2027-05-01','2027-05-10');
\echo '-- T30 entrenador si borra su propia asignacion'
insert into asignacion (cliente_id,asignado_por,rutina_id,fecha_inicio,fecha_fin)
 values ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111',1,'2027-05-01','2027-05-10') returning id \gset
delete from asignacion where id=:id returning id;

-- ===== D8: instructor no puede reasignar el entrenador de su cliente
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
\echo '-- T31 defecto (D8): nutriologo cambia el entrenador del cliente -> 0 filas'
update cliente set entrenador_id='22222222-2222-2222-2222-222222222222' returning usuario_id;

-- ===== Planes: guardar como lo hace la pantalla (borrar porciones y reinsertar)
\echo '-- T32 nutriologo reemplaza porciones de su plan'
delete from porcion_alimento where tiempo_id in (select id from tiempo_comida where tipo='DESAYUNO');
insert into porcion_alimento (tiempo_id,alimento_id,nombre_copia,cantidad,unidad)
 select id, 2, 'Huevo entero', 3, 'PIEZA' from tiempo_comida where tipo='DESAYUNO' returning nombre_copia, cantidad;
\echo '-- T33 nutriologo ve asignaciones del cliente; la rutina del entrenador aparece sin nombre (RLS)'
select a.rutina_id is not null as es_rutina, r.nombre as nombre_rutina, p.nombre as nombre_plan
from asignacion a left join rutina r on r.id = a.rutina_id left join plan_alimenticio p on p.id = a.plan_id order by 1;
reset role;
