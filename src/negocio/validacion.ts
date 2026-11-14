/**
 * negocio/validacion.ts — Reglas de validación de rutinas (RS-01).
 * Lógica pura, sin interfaz ni base de datos, para poder probarla sola.
 * La misma validación se repite en el servidor (CHECK en 0001_esquema.sql):
 * la interfaz no es confiable (RS-10).
 */
import type { EjercicioRutina, Rutina, ResultadoValidacion } from "@/tipos";

/** Mensaje con el formato exacto que exige RS-01. */
export function mensajeError(campo: string, criterio: string): string {
  return `Error de validación: El campo ${campo} debe ser ${criterio}. Por favor corregir antes de guardar.`;
}

const RE_REPETICIONES = /^[1-9][0-9]*(-[1-9][0-9]*)?$/;

function esEntero(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v);
}

/** Valida un ejercicio dentro de la rutina. Devuelve todos los errores, no solo el primero. */
export function validarEjercicio(e: Partial<EjercicioRutina>, posicion?: number): string[] {
  const errores: string[] = [];
  const pref = posicion !== undefined ? `Ejercicio ${posicion}: ` : "";

  if (!esEntero(e.ejercicio_id) || e.ejercicio_id <= 0)
    errores.push(pref + mensajeError("Ejercicio", "un ejercicio del catálogo"));
  if (!esEntero(e.dia_semana) || e.dia_semana < 1 || e.dia_semana > 7)
    errores.push(pref + mensajeError("Día de la semana", "un entero del 1 (lunes) al 7 (domingo)"));
  if (!esEntero(e.series) || e.series < 1 || e.series > 50)
    errores.push(pref + mensajeError("Series", "un entero entre 1 y 50"));
  if (typeof e.repeticiones !== "string" || !RE_REPETICIONES.test(e.repeticiones.trim()))
    errores.push(pref + mensajeError("Repeticiones", 'un número mayor a cero o un rango, por ejemplo "12" o "10-12"'));
  else {
    const [a, b] = e.repeticiones.trim().split("-").map(Number);
    if (b !== undefined && b < a)
      errores.push(pref + mensajeError("Repeticiones", "un rango cuyo límite superior sea mayor o igual al inferior"));
  }
  if (typeof e.carga_kg !== "number" || Number.isNaN(e.carga_kg) || e.carga_kg < 0)
    errores.push(pref + mensajeError("Carga", "un número mayor o igual a 0 (0 = peso corporal)"));
  if (!esEntero(e.descanso_seg) || e.descanso_seg < 0)
    errores.push(pref + mensajeError("Tiempo de descanso", "un entero de segundos mayor o igual a 0"));

  return errores;
}

/** Valida la rutina completa: nombre, al menos un ejercicio y cada ejercicio. */
export function validarRutina(r: Partial<Rutina>): ResultadoValidacion {
  const errores: string[] = [];
  const nombre = (r.nombre ?? "").trim();
  if (nombre.length < 3 || nombre.length > 100)
    errores.push(mensajeError("Nombre de la rutina", "un texto de 3 a 100 caracteres"));
  if (!r.ejercicios || r.ejercicios.length === 0)
    errores.push(mensajeError("Lista de ejercicios", "una lista con al menos 1 ejercicio"));
  else r.ejercicios.forEach((e, i) => errores.push(...validarEjercicio(e, i + 1)));
  return { ok: errores.length === 0, errores };
}
