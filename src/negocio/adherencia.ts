/**
 * negocio/adherencia.ts — Índice de adherencia (RS-05, CU-06).
 * Adherencia (%) = completados ÷ programados × 100, en ventanas de 7 y 30 días.
 * Si no hay elementos programados, la adherencia NO es 0 %: es "no determinable" (null).
 */

export type Ventana = 7 | 30;

export interface AdherenciaCliente {
  cliente_id: string;
  nombre: string;
  programados: number;
  completados: number;
  adherencia: number | null;   // 0..100 con un decimal, o null si no determinable
}

export function calcularAdherencia(programados: number, completados: number): number | null {
  if (!(programados > 0)) return null;
  const c = Math.min(Math.max(completados, 0), programados);   // nunca > 100 %
  return Math.round((c / programados) * 1000) / 10;
}

/** Ordena de menor a mayor adherencia; los "no determinables" al final (RS-05). */
export function ordenarPorRiesgo<T extends { adherencia: number | null; nombre: string }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => {
    if (a.adherencia === null && b.adherencia === null) return a.nombre.localeCompare(b.nombre);
    if (a.adherencia === null) return 1;
    if (b.adherencia === null) return -1;
    return a.adherencia - b.adherencia || a.nombre.localeCompare(b.nombre);
  });
}

export function textoAdherencia(a: number | null): string {
  return a === null ? "No determinable" : `${a.toFixed(1)} %`;
}

/** Día ISO (1 = lunes … 7 = domingo) de una fecha "yyyy-mm-dd". */
export function diaIso(fechaIso: string): number {
  const [y, m, d] = fechaIso.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();   // 0 = domingo
  return dow === 0 ? 7 : dow;
}

/** Adherencia con desglose por área: entrenamiento (entrenador) y alimentación (nutriólogo). */
export interface AdherenciaDesglosada extends AdherenciaCliente {
  entrenamiento: { programados: number; completados: number; adherencia: number | null };
  alimentacion: { programados: number; completados: number; adherencia: number | null };
}

/**
 * Arma el desglose a partir de los conteos del servidor. El total sigue la
 * fórmula de RS-05: (ejercicios + comidas completados) ÷ (ejercicios + comidas programados).
 */
export function desglosarAdherencia(f: {
  cliente_id: string; nombre: string;
  ej_programados: number; ej_completados: number; com_programados: number; com_completados: number;
}): AdherenciaDesglosada {
  const programados = f.ej_programados + f.com_programados;
  const completados = f.ej_completados + f.com_completados;
  return {
    cliente_id: f.cliente_id, nombre: f.nombre, programados, completados,
    adherencia: calcularAdherencia(programados, completados),
    entrenamiento: { programados: f.ej_programados, completados: f.ej_completados, adherencia: calcularAdherencia(f.ej_programados, f.ej_completados) },
    alimentacion: { programados: f.com_programados, completados: f.com_completados, adherencia: calcularAdherencia(f.com_programados, f.com_completados) },
  };
}
