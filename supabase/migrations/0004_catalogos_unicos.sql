-- ============================================================================
-- Constancia FitPlan · Migración 0004 · Nombres únicos en catálogos
-- Motivo: al ejecutar 0003 dos veces se duplicaron los 15 ejercicios y los
-- 20 alimentos (defecto detectado el 14 nov 2026). Con estas restricciones la
-- base rechaza cualquier duplicado, venga de un script o de la interfaz.
-- Requisito previo: haber eliminado los duplicados existentes.
-- ============================================================================

alter table ejercicio add constraint ejercicio_nombre_unico unique (nombre);
alter table alimento  add constraint alimento_nombre_unico  unique (nombre);
