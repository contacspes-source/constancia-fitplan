/**
 * datos/errores.ts — Traduce errores del servidor (PostgreSQL vía PostgREST)
 * a mensajes para el usuario. El servidor es la autoridad: si la interfaz
 * dejó pasar algo, aquí llega el rechazo de la base (CHECK, RLS, trigger).
 */
import { supabase } from "./supabase";

export interface ErrorServidor { code?: string; message?: string; details?: string | null; hint?: string | null }

export class ErrorNegocio extends Error {}

export function traducirError(e: ErrorServidor, contexto = "realizar la operación"): ErrorNegocio {
  switch (e.code) {
    case "P0001":   // raise exception de nuestras funciones/triggers: mensaje ya redactado
      return new ErrorNegocio(e.message ?? "Operación rechazada por el servidor.");
    case "23514":   // CHECK
      return new ErrorNegocio("Error de validación: un valor está fuera del rango permitido. Por favor corregir antes de guardar.");
    case "23505":   // UNIQUE
      return new ErrorNegocio("Ya existe un registro con esos datos.");
    case "23503":   // FK
      return new ErrorNegocio(`No se puede ${contexto}: el registro está en uso (por ejemplo, asignado a un cliente).`);
    case "42501":   // RLS / privilegios
      return new ErrorNegocio(`No tiene permisos para ${contexto}.`);
    default:
      return new ErrorNegocio(e.message ? `No se pudo ${contexto}: ${e.message}` : `No se pudo ${contexto}.`);
  }
}

/** Lanza el error traducido si la respuesta trae error; si no, devuelve los datos. */
export function exigir<T>(r: { data: T | null; error: ErrorServidor | null }, contexto?: string): T {
  if (r.error) throw traducirError(r.error, contexto);
  return r.data as T;
}

/** Registra en la bitácora del servidor una operación denegada (RS-10). No interrumpe si falla. */
export async function registrarDenegado(accion: string, detalle?: string) {
  await supabase.rpc("registrar_denegado", { p_accion: accion, p_detalle: detalle ?? null });
}
