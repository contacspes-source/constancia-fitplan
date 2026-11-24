/** Pruebas de RS-02: validación de planes alimenticios antes de guardar. */
import { describe, it, expect } from "vitest";
import { validarPlan } from "@/negocio/nutricion";
import type { Alimento, TiempoComida } from "@/tipos";

const pollo: Alimento = { id: 1, nombre: "Pechuga de pollo", kcal_100: 165, proteina_100: 31, carbohidratos_100: 0, grasa_100: 3.6, gramos_por_pieza: null, activo: true };
const huevo: Alimento = { id: 2, nombre: "Huevo", kcal_100: 155, proteina_100: 13, carbohidratos_100: 1.1, grasa_100: 11, gramos_por_pieza: 50, activo: true };
const catalogo = new Map<number, Alimento>([[1, pollo], [2, huevo]]);

const desayuno = (porciones: TiempoComida["porciones"]): TiempoComida[] => [{ tipo: "DESAYUNO", porciones }];

describe("RS-02 validarPlan", () => {
  it("acepta un plan válido", () => {
    const r = validarPlan({ nombre: "Plan volumen", tiempos: desayuno([{ alimento_id: 2, nombre_copia: "Huevo", cantidad: 3, unidad: "PIEZA" }]) }, catalogo);
    expect(r).toEqual({ ok: true, errores: [] });
  });

  it("rechaza nombre corto y plan sin alimentos", () => {
    const r = validarPlan({ nombre: "ab", tiempos: [{ tipo: "CENA", porciones: [] }] }, catalogo);
    expect(r.ok).toBe(false);
    expect(r.errores).toHaveLength(2);
    expect(r.errores[0]).toMatch(/^Error de validación: El campo Nombre del plan debe ser/);
  });

  it("rechaza porción 0, vacía (NaN) o negativa", () => {
    for (const cantidad of [0, NaN, -5]) {
      const r = validarPlan({ nombre: "Plan", tiempos: desayuno([{ alimento_id: 1, nombre_copia: "Pollo", cantidad, unidad: "G" }]) }, catalogo);
      expect(r.errores.some(e => e.includes("Porción"))).toBe(true);
    }
  });

  it("rechaza PIEZA en un alimento sin gramos_por_pieza", () => {
    const r = validarPlan({ nombre: "Plan", tiempos: desayuno([{ alimento_id: 1, nombre_copia: "Pollo", cantidad: 1, unidad: "PIEZA" }]) }, catalogo);
    expect(r.ok).toBe(false);
    expect(r.errores[0]).toContain("no se mide por pieza");
  });

  it("exige reemplazar un alimento retirado del catálogo", () => {
    const r = validarPlan({ nombre: "Plan", tiempos: desayuno([{ alimento_id: null, nombre_copia: "Tofu", cantidad: 100, unidad: "G" }]) }, catalogo);
    expect(r.errores.some(e => e.includes("un alimento del catálogo"))).toBe(true);
  });

  it("indica el tiempo de comida y la posición del alimento", () => {
    const r = validarPlan({ nombre: "Plan", tiempos: [{ tipo: "COLACION1", porciones: [
      { alimento_id: 1, nombre_copia: "Pollo", cantidad: 100, unidad: "G" },
      { alimento_id: 1, nombre_copia: "Pollo", cantidad: 0, unidad: "G" },
    ] }] }, catalogo);
    expect(r.errores[0]).toMatch(/^Colación 1, alimento 2: /);
  });
});
