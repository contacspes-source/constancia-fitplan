/** Pruebas de RS-03: periodos válidos y sin solapes. */
import { describe, it, expect } from "vitest";
import { periodoValido, seSolapan, encontrarConflicto, validarAsignacion, estaVigente } from "@/negocio/asignaciones";
import type { Asignacion } from "@/tipos";

const base: Asignacion = { id: 1, cliente_id: "c1", asignado_por: "e1", rutina_id: 10, plan_id: null, fecha_inicio: "2026-11-10", fecha_fin: "2026-11-30" };

describe("RS-03 periodoValido", () => {
  it("acepta fin igual o posterior al inicio", () => {
    expect(periodoValido({ fecha_inicio: "2026-11-10", fecha_fin: "2026-11-10" })).toBe(true);
    expect(periodoValido({ fecha_inicio: "2026-11-10", fecha_fin: "2026-12-01" })).toBe(true);
  });
  it("rechaza fin anterior al inicio", () => {
    expect(periodoValido({ fecha_inicio: "2026-11-10", fecha_fin: "2026-11-09" })).toBe(false);
  });
  it("rechaza fechas mal formadas", () => {
    expect(periodoValido({ fecha_inicio: "10/11/2026", fecha_fin: "2026-11-30" })).toBe(false);
  });
});

describe("RS-03 solapes", () => {
  it("detecta solape parcial y total", () => {
    expect(seSolapan(base, { fecha_inicio: "2026-11-25", fecha_fin: "2026-12-10" })).toBe(true);
    expect(seSolapan(base, { fecha_inicio: "2026-11-01", fecha_fin: "2026-12-31" })).toBe(true);
  });
  it("un solo día en común ya es solape (extremos inclusive)", () => {
    expect(seSolapan(base, { fecha_inicio: "2026-11-30", fecha_fin: "2026-12-05" })).toBe(true);
  });
  it("periodos contiguos sin día en común no se solapan", () => {
    expect(seSolapan(base, { fecha_inicio: "2026-12-01", fecha_fin: "2026-12-31" })).toBe(false);
  });
  it("una rutina y un plan pueden coexistir en las mismas fechas", () => {
    const plan: Asignacion = { ...base, id: 2, rutina_id: null, plan_id: 5 };
    expect(encontrarConflicto(plan, [base])).toBeNull();
  });
  it("dos rutinas del mismo cliente en fechas solapadas entran en conflicto", () => {
    const otra: Asignacion = { ...base, id: 3, rutina_id: 11, fecha_inicio: "2026-11-20", fecha_fin: "2026-12-05" };
    expect(encontrarConflicto(otra, [base])?.id).toBe(1);
  });
  it("la misma asignación al editarse no entra en conflicto consigo misma", () => {
    expect(encontrarConflicto({ ...base, fecha_fin: "2026-12-05" }, [base])).toBeNull();
  });
  it("otro cliente con las mismas fechas no entra en conflicto", () => {
    expect(encontrarConflicto({ ...base, id: 4, cliente_id: "c2" }, [base])).toBeNull();
  });
});

describe("RS-03 validarAsignacion", () => {
  it("rechaza asignar rutina y plan a la vez, o ninguno", () => {
    expect(validarAsignacion({ ...base, plan_id: 5 }, []).ok).toBe(false);
    expect(validarAsignacion({ ...base, rutina_id: null }, []).ok).toBe(false);
  });
  it("indica la asignación con la que entra en conflicto", () => {
    const r = validarAsignacion({ ...base, id: 9, rutina_id: 12 }, [base]);
    expect(r.ok).toBe(false);
    expect(r.errores[0]).toContain("2026-11-10 al 2026-11-30");
  });
  it("estaVigente respeta los extremos", () => {
    expect(estaVigente(base, "2026-11-10")).toBe(true);
    expect(estaVigente(base, "2026-11-30")).toBe(true);
    expect(estaVigente(base, "2026-12-01")).toBe(false);
  });
});
