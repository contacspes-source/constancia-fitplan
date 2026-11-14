-- ============================================================================
-- Constancia FitPlan · Migración 0005 · Cierre de permisos en asignaciones y clientes
-- Defectos detectados al construir la pantalla de clientes (iteración 2):
--   D7. asignacion_instructor permitía a cualquier instructor del cliente borrar o
--       modificar asignaciones de OTRO instructor (p. ej., el entrenador quitaba el
--       plan del nutriólogo), y asignar programas ajenos adivinando su id.
--   D8. cliente_instr_upd permitía a un instructor cambiar el entrenador o el
--       nutriólogo del cliente. Ninguna pantalla actualiza CLIENTE en v1.0.
-- RS-10: la verificación de permisos se hace en el servidor, con independencia
-- de lo que la interfaz haya presentado.
-- ============================================================================

drop policy if exists asignacion_instructor on asignacion;

-- Ver: todas las asignaciones de sus clientes (para mostrar el programa completo y validar solapes).
create policy asignacion_instructor_sel on asignacion for select
  using (es_mi_cliente(cliente_id));

-- Crear: solo para sus clientes, a su nombre y con un programa propio.
create policy asignacion_instructor_ins on asignacion for insert
  with check (
    es_mi_cliente(cliente_id)
    and asignado_por = auth.uid()
    and (rutina_id is null or exists (select 1 from rutina r where r.id = rutina_id and r.entrenador_id = auth.uid()))
    and (plan_id   is null or exists (select 1 from plan_alimenticio p where p.id = plan_id and p.nutriologo_id = auth.uid()))
  );

-- Modificar o borrar: solo las que él mismo asignó.
create policy asignacion_instructor_upd on asignacion for update
  using (asignado_por = auth.uid() and es_mi_cliente(cliente_id))
  with check (asignado_por = auth.uid() and es_mi_cliente(cliente_id));
create policy asignacion_instructor_del on asignacion for delete
  using (asignado_por = auth.uid());

drop policy if exists cliente_instr_upd on cliente;
