-- Pruebas de servidor de la iteración 3: vista del día (RS-06) y cumplimiento (RS-07).
-- Ejecutar después de 01 y 02, en base de PRUEBA.
\set ON_ERROR_STOP 0
set role authenticated;

-- ===== Cliente con programa
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
\echo '-- T34 vista del dia: 1 ejercicio (el del dia de hoy) y 3 comidas'
select v->>'tiene_programa' as tiene_programa, v->>'rutina' as rutina, v->>'plan' as plan,
       jsonb_array_length(v->'ejercicios') as ejercicios, jsonb_array_length(v->'comidas') as comidas,
       (v->>'dia_semana')::int = extract(isodow from fecha_servidor())::int as dia_correcto
from vista_del_dia() v;

\echo '-- T35 marcar el ejercicio de hoy dos veces: una sola fila, completado = true'
select rutina_ejercicio_id is not null as es_ejercicio, completado from marcar_cumplimiento((select (vista_del_dia()->'ejercicios'->0->>'id')::bigint), null, true);
select completado from marcar_cumplimiento((select (vista_del_dia()->'ejercicios'->0->>'id')::bigint), null, true);
select count(*) as filas_del_ejercicio from registro_cumplimiento where fecha = fecha_servidor() and rutina_ejercicio_id is not null;

\echo '-- T36 desmarcar la misma comida: misma fila, completado = false'
select count(*) as filas_antes from registro_cumplimiento where fecha = fecha_servidor();
select completado from marcar_cumplimiento(null, (select (vista_del_dia()->'comidas'->0->>'id')::bigint), false);
select count(*) as filas_despues from registro_cumplimiento where fecha = fecha_servidor();
select (vista_del_dia()->'comidas'->0->>'completado') as vista_refleja_desmarcado;

\echo '-- T37 defecto: marcar un ejercicio programado para otro dia'
select marcar_cumplimiento((select re.id from rutina_ejercicio re where re.dia_semana <> extract(isodow from fecha_servidor()) limit 1), null, true);

\echo '-- T38 defecto: indicar ejercicio y comida a la vez'
select marcar_cumplimiento(1, 1, true);

\echo '-- T39 la comida trae los datos para calcular macros en el cliente'
select v->'comidas'->0->'porciones'->0->>'nombre' as alimento, (v->'comidas'->0->'porciones'->0->'alimento'->>'kcal_100') is not null as trae_kcal
from vista_del_dia() v;

-- ===== Cliente sin programa
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false);
\echo '-- T40 cliente sin programa vigente: tiene_programa = false y listas vacias'
select v->>'tiene_programa' as tiene_programa, jsonb_array_length(v->'ejercicios') as ej, jsonb_array_length(v->'comidas') as com from vista_del_dia() v;

-- ===== Instructor
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
\echo '-- T41 defecto: el entrenador no puede registrar cumplimiento'
select marcar_cumplimiento(1, null, true);

select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
insert into plan_alimenticio (nutriologo_id,nombre) values ('22222222-2222-2222-2222-222222222222','Plan sin asignar');
insert into tiempo_comida (plan_id,tipo) select id,'CENA' from plan_alimenticio where nombre='Plan sin asignar';
-- El id se obtiene como el nutriólogo (dueño del plan): el cliente no puede verlo por RLS.
select t.id as tiempo_ajeno from tiempo_comida t join plan_alimenticio p on p.id = t.plan_id where p.nombre = 'Plan sin asignar' \gset
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
\echo '-- T42 defecto: cliente marca una comida de un plan que no tiene asignado'
select marcar_cumplimiento(null, :tiempo_ajeno, true);

select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
\echo '-- T43 la adherencia del entrenador refleja las marcas (completado = true)'
select nombre, programados, completados, adherencia from adherencia_cartera_validada(7);
reset role;
