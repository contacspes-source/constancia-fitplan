/**
 * negocio/invitacion.ts — Código de invitación (RS-03, CU-03).
 * Token aleatorio de 64 caracteres hexadecimales (32 bytes) con vigencia de 72 h.
 */

export const VIGENCIA_HORAS = 72;

/** Genera un token criptográficamente aleatorio. `fuente` se inyecta en pruebas. */
export function generarToken(fuente: (b: Uint8Array) => Uint8Array = (b) => crypto.getRandomValues(b)): string {
  const bytes = fuente(new Uint8Array(32));
  return Array.from(bytes, (x) => x.toString(16).padStart(2, "0")).join("");
}

export function calcularExpiracion(desde: Date = new Date()): Date {
  return new Date(desde.getTime() + VIGENCIA_HORAS * 3_600_000);
}

export type EstadoInvitacion = "VIGENTE" | "USADA" | "CADUCADA";

export function estadoInvitacion(inv: { expira_en: string; usada_en: string | null }, ahora: Date = new Date()): EstadoInvitacion {
  if (inv.usada_en) return "USADA";
  return new Date(inv.expira_en).getTime() < ahora.getTime() ? "CADUCADA" : "VIGENTE";
}

export function esTokenValido(token: string): boolean {
  return /^[0-9a-f]{64}$/.test(token.trim());
}
