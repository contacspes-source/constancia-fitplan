/** Pruebas de la vista del día (RS-06) y su progreso (RS-07). */
import { describe, it, expect } from "vitest";
import { estadoDelDia, progresoDelDia, totalesComida, textoCarga, textoDescanso, textoPorcion, type ComidaDelDia, type EjercicioDelDia } from "@/negocio/dia";

const ej = (completado: boolean): EjercicioDelDia => ({ id: 1, nombre: "Sentadilla", grupo_muscular: "Piernas", descripcion: null, url_demostracion: null,
  series: 4, repeticiones: "8-10", carga_kg: 60, descanso_seg: 90, completado });
const pollo = { id: 1, nombre: "Pollo", kcal_100: 165, proteina_100: 31, carbohidratos_100: 0, grasa_100: 3.6, gramos_por_pieza: null };
const huevo = { id: 2, nombre: "Huevo", kcal_100: 155, proteina_100: 13, carbohidratos_100: 1.1, grasa_100: 11, gramos_por_pieza: 50 };
const comida = (completado: boolean): ComidaDelDia => ({ id: 1, tipo: "COMIDA", completado,
  porciones: [{ nombre: "Pollo", cantidad: 200, unidad: "G", alimento: pollo }] });

describe("RS-06 estadoDelDia", () => {
  it("sin asignación vigente → SIN_PROGRAMA (no pantalla vacía)", () => {
    expect(estadoDelDia({ tiene_programa: false, ejercicios: [], comidas: [] })).toBe("SIN_PROGRAMA");
  });
  it("con programa pero nada hoy → DESCANSO", () => {
    expect(estadoDelDia({ tiene_programa: true, ejercicios: [], comidas: [] })).toBe("DESCANSO");
  });
  it("con elementos hoy → ACTIVO", () => {
    expect(estadoDelDia({ tiene_programa: true, ejercicios: [ej(false)], comidas: [] })).toBe("ACTIVO");
  });
});

describe("RS-07 progresoDelDia", () => {
  it("cuenta ejercicios y comidas completados", () => {
    expect(progresoDelDia({ ejercicios: [ej(true), ej(false)], comidas: [comida(true), comida(false)] }))
      .toEqual({ total: 4, hechos: 2, porcentaje: 50 });
  });
  it("sin elementos el progreso es 0 sin dividir entre cero", () => {
    expect(progresoDelDia({ ejercicios: [], comidas: [] })).toEqual({ total: 0, hechos: 0, porcentaje: 0 });
  });
});

describe("totalesComida", () => {
  it("usa el mismo cálculo que el nutriólogo (200 g de pollo = 330 kcal)", () => {
    expect(Math.round(totalesComida(comida(false)).kcal)).toBe(330);
  });
  it("convierte piezas y tolera valores numéricos que llegan como texto desde el servidor", () => {
    const c: ComidaDelDia = { id: 2, tipo: "DESAYUNO", completado: false,
      porciones: [{ nombre: "Huevo", cantidad: "2" as unknown as number, unidad: "PIEZA", alimento: { ...huevo, kcal_100: "155" as unknown as number } }] };
    expect(Math.round(totalesComida(c).kcal)).toBe(155);
  });
  it("un alimento retirado del catálogo no aporta pero se sigue mostrando", () => {
    const c: ComidaDelDia = { id: 3, tipo: "CENA", completado: false, porciones: [{ nombre: "Retirado", cantidad: 100, unidad: "G", alimento: null }] };
    expect(totalesComida(c).kcal).toBe(0);
  });
});

describe("formatos", () => {
  it("carga 0 = peso corporal", () => { expect(textoCarga(0)).toBe("Peso corporal"); expect(textoCarga(22.5)).toBe("22.5 kg"); });
  it("descanso en minutos y segundos", () => {
    expect(textoDescanso(45)).toBe("45 s"); expect(textoDescanso(120)).toBe("2 min"); expect(textoDescanso(90)).toBe("1 min 30 s"); expect(textoDescanso(0)).toBe("Sin descanso");
  });
  it("porciones con su unidad", () => {
    expect(textoPorcion({ cantidad: 1, unidad: "PIEZA" })).toBe("1 pieza");
    expect(textoPorcion({ cantidad: 150, unidad: "G" })).toBe("150 g");
  });
});
