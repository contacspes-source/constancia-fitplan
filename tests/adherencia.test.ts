/** Pruebas de RS-05: fórmula de adherencia, "no determinable" y orden por riesgo. */
import { describe, it, expect } from "vitest";
import { calcularAdherencia, ordenarPorRiesgo, textoAdherencia, diaIso, desglosarAdherencia } from "@/negocio/adherencia";

describe("RS-05 calcularAdherencia", () => {
  it("completados ÷ programados × 100 con un decimal", () => {
    expect(calcularAdherencia(30, 21)).toBe(70);
    expect(calcularAdherencia(3, 1)).toBe(33.3);
  });
  it("sin elementos programados no es 0 %, es no determinable", () => {
    expect(calcularAdherencia(0, 0)).toBeNull();
    expect(textoAdherencia(null)).toBe("No determinable");
  });
  it("0 completados con programados sí es 0 %", () => {
    expect(calcularAdherencia(10, 0)).toBe(0);
  });
  it("nunca supera 100 % aunque haya marcas de más (defecto de datos)", () => {
    expect(calcularAdherencia(10, 12)).toBe(100);
  });
});

describe("RS-05 ordenarPorRiesgo", () => {
  it("ordena de menor a mayor y manda los no determinables al final", () => {
    const l = ordenarPorRiesgo([
      { nombre: "Ana", adherencia: 80 }, { nombre: "Beto", adherencia: null },
      { nombre: "Caro", adherencia: 20 }, { nombre: "Dan", adherencia: 20 },
    ]);
    expect(l.map(x => x.nombre)).toEqual(["Caro", "Dan", "Ana", "Beto"]);
  });
});

describe("diaIso", () => {
  it("lunes = 1, domingo = 7", () => {
    expect(diaIso("2026-11-09")).toBe(1);   // lunes
    expect(diaIso("2026-11-15")).toBe(7);   // domingo
  });
});

describe("RS-05 desglose por área", () => {
  const base = { cliente_id: "c1", nombre: "Ana" };
  it("separa entrenamiento y alimentación y conserva el total de RS-05", () => {
    const d = desglosarAdherencia({ ...base, ej_programados: 10, ej_completados: 9, com_programados: 10, com_completados: 3 });
    expect(d.entrenamiento.adherencia).toBe(90);
    expect(d.alimentacion.adherencia).toBe(30);
    expect(d.adherencia).toBe(60);   // (9 + 3) ÷ (10 + 10)
  });
  it("un área sin programa es 'no determinable' sin afectar a la otra", () => {
    const d = desglosarAdherencia({ ...base, ej_programados: 4, ej_completados: 1, com_programados: 0, com_completados: 0 });
    expect(d.alimentacion.adherencia).toBeNull();
    expect(d.entrenamiento.adherencia).toBe(25);
    expect(d.adherencia).toBe(25);
  });
});
