/** Pruebas de RS-03: código de invitación de 64 caracteres y vigencia de 72 h. */
import { describe, it, expect } from "vitest";
import { generarToken, calcularExpiracion, estadoInvitacion, esTokenValido } from "@/negocio/invitacion";

describe("RS-03 invitación", () => {
  it("genera 64 caracteres hexadecimales", () => {
    const t = generarToken();
    expect(t).toHaveLength(64);
    expect(esTokenValido(t)).toBe(true);
  });
  it("dos tokens seguidos son distintos", () => {
    expect(generarToken()).not.toBe(generarToken());
  });
  it("con bytes fijos produce el hexadecimal esperado", () => {
    expect(generarToken((b) => b.fill(255))).toBe("f".repeat(64));
  });
  it("expira exactamente 72 h después", () => {
    const d = new Date("2026-11-14T12:00:00Z");
    expect(calcularExpiracion(d).toISOString()).toBe("2026-11-17T12:00:00.000Z");
  });
  it("estado: vigente, caducada y usada", () => {
    const ahora = new Date("2026-11-15T00:00:00Z");
    expect(estadoInvitacion({ expira_en: "2026-11-16T00:00:00Z", usada_en: null }, ahora)).toBe("VIGENTE");
    expect(estadoInvitacion({ expira_en: "2026-11-14T00:00:00Z", usada_en: null }, ahora)).toBe("CADUCADA");
    expect(estadoInvitacion({ expira_en: "2026-11-16T00:00:00Z", usada_en: "2026-11-14T10:00:00Z" }, ahora)).toBe("USADA");
  });
  it("rechaza tokens mal formados", () => {
    expect(esTokenValido("abc")).toBe(false);
    expect(esTokenValido("G".repeat(64))).toBe(false);
  });
});
