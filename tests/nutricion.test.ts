/** Pruebas de RS-02: cálculo automático de calorías y macronutrientes. */
import { describe, it, expect } from "vitest";
import { aportePorcion, totalesPlan, redondearTotales, gramosDePorcion } from "@/negocio/nutricion";
import type { Alimento, PorcionAlimento } from "@/tipos";

const pollo: Alimento = { id: 1, nombre: "Pechuga de pollo", kcal_100: 165, proteina_100: 31, carbohidratos_100: 0, grasa_100: 3.6, gramos_por_pieza: null, activo: true };
const huevo: Alimento = { id: 2, nombre: "Huevo", kcal_100: 155, proteina_100: 13, carbohidratos_100: 1.1, grasa_100: 11, gramos_por_pieza: 50, activo: true };
const catalogo = new Map<number, Alimento>([[1, pollo], [2, huevo]]);

describe("RS-02 aportePorcion", () => {
  it("escala linealmente por gramos (200 g de pollo = 2x)", () => {
    const t = aportePorcion({ alimento_id: 1, nombre_copia: "Pollo", cantidad: 200, unidad: "G" }, pollo)!;
    expect(t.kcal).toBeCloseTo(330);
    expect(t.proteina).toBeCloseTo(62);
  });
  it("convierte piezas a gramos (2 huevos = 100 g)", () => {
    const t = aportePorcion({ alimento_id: 2, nombre_copia: "Huevo", cantidad: 2, unidad: "PIEZA" }, huevo)!;
    expect(t.kcal).toBeCloseTo(155);
  });
  it("una porción en PIEZA sin equivalencia no es calculable", () => {
    expect(gramosDePorcion({ cantidad: 1, unidad: "PIEZA" }, pollo)).toBeNull();
  });
  it("cantidad 0 o negativa no es calculable (defecto)", () => {
    expect(aportePorcion({ alimento_id: 1, nombre_copia: "Pollo", cantidad: 0, unidad: "G" }, pollo)).toBeNull();
  });
  it("un alimento retirado del catálogo no aporta pero no rompe el cálculo", () => {
    const porciones: PorcionAlimento[] = [
      { alimento_id: 1, nombre_copia: "Pollo", cantidad: 100, unidad: "G" },
      { alimento_id: null, nombre_copia: "Alimento retirado", cantidad: 100, unidad: "G" },
    ];
    expect(totalesPlan(porciones, catalogo).kcal).toBeCloseTo(165);
  });
});

describe("RS-02 totalesPlan", () => {
  it("suma todas las porciones del plan y redondea a 1 decimal", () => {
    const porciones: PorcionAlimento[] = [
      { alimento_id: 1, nombre_copia: "Pollo", cantidad: 150, unidad: "G" },
      { alimento_id: 2, nombre_copia: "Huevo", cantidad: 3, unidad: "PIEZA" },
    ];
    const t = redondearTotales(totalesPlan(porciones, catalogo));
    expect(t).toEqual({ kcal: 480, proteina: 66, carbohidratos: 1.7, grasa: 21.9 });
  });
  it("un plan vacío da totales en cero", () => {
    expect(totalesPlan([], catalogo)).toEqual({ kcal: 0, proteina: 0, carbohidratos: 0, grasa: 0 });
  });
});
