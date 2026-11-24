-- ============================================================================
-- Constancia FitPlan · Migración 0007 · Adherencia desglosada por área
-- Observación de pruebas (23 nov 2026): el panel mostraba un solo porcentaje
-- que mezcla ejercicios y comidas. Entrenador y nutriólogo necesitan ver por
-- separado el cumplimiento de su parte. Se conserva el total de RS-05
-- (ejercicios + comidas) para ordenar la lista; se agrega el desglose.
-- security definer por la misma razón que adherencia_cartera (0002): el
-- entrenador no puede leer los tiempos de comida del plan del nutriólogo. La
-- función sigue limitada a la cartera de auth.uid().
-- ============================================================================

create or replace function adherencia_por_area(p_dias int)
returns table (
  cliente_id uuid, nombre varchar,
  ej_programados bigint, ej_completados bigint,
  com_programados bigint, com_completados bigint
)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if p_dias not in (7, 30) then
    raise exception 'La ventana de adherencia debe ser de 7 o 30 días.';
  end if;
  return query
  with dias as (
    select generate_series(fecha_servidor() - (p_dias - 1), fecha_servidor(), interval '1 day')::date as d
  ),
  mis as (
    select c.usuario_id, p.nombre from cliente c join perfil p on p.id = c.usuario_id
    where c.entrenador_id = auth.uid() or c.nutriologo_id = auth.uid()
  ),
  ej as (
    select a.cliente_id as cid, count(*) as n
    from dias
    join asignacion a on a.rutina_id is not null and dias.d between a.fecha_inicio and a.fecha_fin
    join rutina_ejercicio re on re.rutina_id = a.rutina_id and re.dia_semana = extract(isodow from dias.d)
    where a.cliente_id in (select usuario_id from mis)
    group by a.cliente_id
  ),
  com as (
    select a.cliente_id as cid, count(*) as n
    from dias
    join asignacion a on a.plan_id is not null and dias.d between a.fecha_inicio and a.fecha_fin
    join tiempo_comida t on t.plan_id = a.plan_id
    where a.cliente_id in (select usuario_id from mis)
    group by a.cliente_id
  ),
  m as (
    select r.cliente_id as cid,
           count(*) filter (where r.rutina_ejercicio_id is not null) as ej,
           count(*) filter (where r.tiempo_comida_id is not null)    as com
    from registro_cumplimiento r
    where r.completado
      and r.fecha between fecha_servidor() - (p_dias - 1) and fecha_servidor()
      and r.cliente_id in (select usuario_id from mis)
    group by r.cliente_id
  )
  select mis.usuario_id,
         mis.nombre,
         coalesce(ej.n, 0)::bigint,
         least(coalesce(m.ej, 0), coalesce(ej.n, 0))::bigint,
         coalesce(com.n, 0)::bigint,
         least(coalesce(m.com, 0), coalesce(com.n, 0))::bigint
  from mis
  left join ej  on ej.cid  = mis.usuario_id
  left join com on com.cid = mis.usuario_id
  left join m   on m.cid   = mis.usuario_id;
end $$;
