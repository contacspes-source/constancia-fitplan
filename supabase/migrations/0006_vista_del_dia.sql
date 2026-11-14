-- ============================================================================
-- Constancia FitPlan · Migración 0006 · Vista del día y registro de cumplimiento
-- RS-06: el servidor resuelve la fecha y cruza las asignaciones vigentes del
--        cliente para devolver, en una sola consulta, lo que le toca hoy.
-- RS-07: marcar/desmarcar solo lo programado para el día en curso, sin duplicar
--        registros y con sello de tiempo del servidor.
-- D11:   los índices únicos parciales de registro_cumplimiento no admiten
--        ON CONFLICT sin predicado, que es lo único que puede enviar la API de
--        Supabase. El upsert se hace aquí, con el predicado del índice.
-- Ambas funciones son SECURITY INVOKER: las políticas RLS siguen aplicando.
-- ============================================================================

create or replace function vista_del_dia() returns jsonb
language sql stable security invoker set search_path = public as $$
  with f as (select fecha_servidor() as d, extract(isodow from fecha_servidor())::int as dow),
  asig as (
    select a.* from asignacion a, f
    where a.cliente_id = auth.uid() and f.d between a.fecha_inicio and a.fecha_fin
  )
  select jsonb_build_object(
    'fecha',          f.d,
    'dia_semana',     f.dow,
    'tiene_programa', exists (select 1 from asig),
    'rutina',         (select r.nombre from asig a join rutina r on r.id = a.rutina_id limit 1),
    'plan',           (select p.nombre from asig a join plan_alimenticio p on p.id = a.plan_id limit 1),
    'ejercicios', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', re.id,
          'nombre', coalesce(e.nombre, 'Ejercicio retirado del catálogo'),
          'grupo_muscular', e.grupo_muscular,
          'descripcion', e.descripcion,
          'url_demostracion', e.url_demostracion,
          'series', re.series, 'repeticiones', re.repeticiones,
          'carga_kg', re.carga_kg, 'descanso_seg', re.descanso_seg,
          'completado', coalesce(rc.completado, false))
        order by re.orden, re.id)
      from asig a
      join rutina_ejercicio re on re.rutina_id = a.rutina_id and re.dia_semana = f.dow
      left join ejercicio e on e.id = re.ejercicio_id
      left join registro_cumplimiento rc
        on rc.cliente_id = auth.uid() and rc.fecha = f.d and rc.rutina_ejercicio_id = re.id
    ), '[]'::jsonb),
    'comidas', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', t.id,
          'tipo', t.tipo,
          'completado', coalesce(rc.completado, false),
          'porciones', coalesce((
            select jsonb_agg(jsonb_build_object(
                'nombre', po.nombre_copia, 'cantidad', po.cantidad, 'unidad', po.unidad,
                'alimento', case when al.id is null then null else jsonb_build_object(
                  'id', al.id, 'nombre', al.nombre, 'kcal_100', al.kcal_100, 'proteina_100', al.proteina_100,
                  'carbohidratos_100', al.carbohidratos_100, 'grasa_100', al.grasa_100,
                  'gramos_por_pieza', al.gramos_por_pieza, 'activo', al.activo) end)
              order by po.id)
            from porcion_alimento po left join alimento al on al.id = po.alimento_id
            where po.tiempo_id = t.id), '[]'::jsonb))
        order by t.tipo)
      from asig a
      join tiempo_comida t on t.plan_id = a.plan_id
      left join registro_cumplimiento rc
        on rc.cliente_id = auth.uid() and rc.fecha = f.d and rc.tiempo_comida_id = t.id
    ), '[]'::jsonb)
  )
  from f
$$;

create or replace function marcar_cumplimiento(
  p_rutina_ejercicio_id bigint default null,
  p_tiempo_comida_id    bigint default null,
  p_completado          boolean default true
) returns registro_cumplimiento
language plpgsql volatile security invoker set search_path = public as $$
declare
  v_fecha date := fecha_servidor();
  v_dow   int  := extract(isodow from fecha_servidor())::int;
  v_fila  registro_cumplimiento%rowtype;
begin
  if (p_rutina_ejercicio_id is null) = (p_tiempo_comida_id is null) then
    raise exception 'Indique exactamente un ejercicio o una comida.';
  end if;
  if not exists (select 1 from cliente where usuario_id = auth.uid()) then
    perform registrar_denegado('marcar_cumplimiento', 'el usuario no es cliente');
    raise exception 'Solo los clientes registran su cumplimiento.';
  end if;

  if p_rutina_ejercicio_id is not null then
    if not exists (
      select 1 from rutina_ejercicio re
      join asignacion a on a.rutina_id = re.rutina_id
      where re.id = p_rutina_ejercicio_id and a.cliente_id = auth.uid()
        and v_fecha between a.fecha_inicio and a.fecha_fin and re.dia_semana = v_dow
    ) then
      raise exception 'Solo puede registrar el cumplimiento de lo programado para el día en curso.';
    end if;
    insert into registro_cumplimiento (cliente_id, fecha, rutina_ejercicio_id, completado, marcado_en)
    values (auth.uid(), v_fecha, p_rutina_ejercicio_id, p_completado, now())
    on conflict (cliente_id, fecha, rutina_ejercicio_id) where rutina_ejercicio_id is not null
    do update set completado = excluded.completado, marcado_en = now()
    returning * into v_fila;
  else
    if not exists (
      select 1 from tiempo_comida t
      join asignacion a on a.plan_id = t.plan_id
      where t.id = p_tiempo_comida_id and a.cliente_id = auth.uid()
        and v_fecha between a.fecha_inicio and a.fecha_fin
    ) then
      raise exception 'Solo puede registrar el cumplimiento de lo programado para el día en curso.';
    end if;
    insert into registro_cumplimiento (cliente_id, fecha, tiempo_comida_id, completado, marcado_en)
    values (auth.uid(), v_fecha, p_tiempo_comida_id, p_completado, now())
    on conflict (cliente_id, fecha, tiempo_comida_id) where tiempo_comida_id is not null
    do update set completado = excluded.completado, marcado_en = now()
    returning * into v_fila;
  end if;
  return v_fila;
end $$;
