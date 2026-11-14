/** Pruebas de RS-02: estructura y validación del plan alimenticio. */
import { describe, it, expect } from "vitest";
import { validarPlan } from "@/negocio/planes";
import type { Alimento, PlanAlimenticio } from "@/tipos";

const porcion = { alimento_id: 1, nombre_copia: "Pollo", cantidad: 150, unidad: "G" as const };
const base: PlanAlimenticio = { nutriologo_id: "n1", nombre: "Plan base", es_plantilla: false, origen_id: null,
  tiempos: [{ tipo: "DESAYUNO", porciones: [porcion] }] };

describe("RS-02 validarPlan", () => {
  it("acepta un plan con un tiempo y un alimento", () => {
    expect(validarPlan(base).ok).toBe(true);
  });
  it("rechaza plan sin tiempos de comida", () => {
    expect(validarPlan({ ...base, tiempos: [] }).ok).toBe(false);
  });
  it("rechaza un tiempo de comida sin alimentos", () => {
    const r = validarPlan({ ...base, tiempos: [{ tipo: "COMIDA", porciones: [] }] });
    expect(r.errores[0]).toMatch(/^Comida:/);
  });
  it("rechaza porción 0 o negativa", () => {
    const r = validarPlan({ ...base, tiempos: [{ tipo: "CENA", porciones: [{ ...porcion, cantidad: 0 }] }] });
    expect(r.errores[0]).toContain("Porción");
  });
  it("rechaza tiempos repetidos", () => {
    const r = validarPlan({ ...base, tiempos: [base.tiempos[0], base.tiempos[0]] });
    expect(r.ok).toBe(false);
  });
  it("rechaza nombre corto", () => {
    expect(validarPlan({ ...base, nombre: "ab" }).ok).toBe(false);
  });
  it("con catálogo: rechaza PIEZA en un alimento sin equivalencia y acepta la que sí la tiene", () => {
    const pollo = { id: 1, nombre: "Pollo", gramos_por_pieza: null } as Alimento;
    const huevo = { id: 2, nombre: "Huevo", gramos_por_pieza: 50 } as Alimento;
    const cat = new Map([[1, pollo], [2, huevo]]);
    const enPiezas = (id: number) => ({ ...base, tiempos: [{ tipo: "DESAYUNO" as const, porciones: [{ ...porcion, alimento_id: id, cantidad: 2, unidad: "PIEZA" as const }] }] });
    expect(validarPlan(enPiezas(1), cat).ok).toBe(false);
    expect(validarPlan(enPiezas(2), cat).ok).toBe(true);
  });
});
