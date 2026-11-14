/**
 * negocio/asignaciones.ts — Reglas de asignación de programas (RS-03, CU-04).
 * Fecha fin ≥ fecha inicio y sin solapes entre programas del mismo tipo.
 * El servidor repite la regla (trigger trg_asignacion_sin_solape).
 */
import type { Asignacion } from "@/tipos";

type Periodo = Pick<Asignacion, "fecha_inicio" | "fecha_fin">;

/** Convierte "yyyy-mm-dd" a un entero comparable (días). Sin zonas horarias. */
function dia(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

export function periodoValido(p: Periodo): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(p.fecha_inicio) && /^\d{4}-\d{2}-\d{2}$/.test(p.fecha_fin)
    && dia(p.fecha_fin) >= dia(p.fecha_inicio);
}

/** Dos periodos se solapan si comparten al menos un día (extremos inclusive). */
export function seSolapan(a: Periodo, b: Periodo): boolean {
  return dia(a.fecha_inicio) <= dia(b.fecha_fin) && dia(a.fecha_fin) >= dia(b.fecha_inicio);
}

function mismoTipo(a: Asignacion, b: Asignacion): boolean {
  return (a.rutina_id !== null && b.rutina_id !== null) || (a.plan_id !== null && b.plan_id !== null);
}

/**
 * Busca la asignación existente con la que entra en conflicto la nueva.
 * Devuelve `null` si no hay conflicto. Ignora la propia asignación al editar.
 */
export function encontrarConflicto(nueva: Asignacion, existentes: Asignacion[]): Asignacion | null {
  return existentes.find(e =>
    e.cliente_id === nueva.cliente_id
    && e.id !== nueva.id
    && mismoTipo(e, nueva)
    && seSolapan(e, nueva)) ?? null;
}

/** ¿La asignación está vigente en la fecha dada? */
export function estaVigente(a: Periodo, fechaIso: string): boolean {
  const f = dia(fechaIso);
  return f >= dia(a.fecha_inicio) && f <= dia(a.fecha_fin);
}

/** Valida una asignación nueva. Mensajes listos para mostrar junto al campo. */
export function validarAsignacion(nueva: Asignacion, existentes: Asignacion[]): { ok: boolean; errores: string[] } {
  const errores: string[] = [];
  const tieneUno = (nueva.rutina_id !== null) !== (nueva.plan_id !== null);
  if (!tieneUno) errores.push("Debe asignar exactamente una rutina o un plan alimenticio.");
  if (!periodoValido(nueva)) errores.push("La fecha de fin debe ser igual o posterior a la fecha de inicio.");
  else {
    const c = encontrarConflicto(nueva, existentes);
    if (c) errores.push(`El periodo se solapa con la asignación vigente del ${c.fecha_inicio} al ${c.fecha_fin}.`);
  }
  return { ok: errores.length === 0, errores };
}
