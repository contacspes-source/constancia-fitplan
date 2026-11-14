/** Pruebas de RS-01 (caja blanca: cada regla de validación tiene un caso válido y uno de defecto). */
import { describe, it, expect } from "vitest";
import { validarEjercicio, validarRutina, mensajeError } from "@/negocio/validacion";

const valido = { ejercicio_id: 1, dia_semana: 1, series: 3, repeticiones: "10-12", carga_kg: 0, descanso_seg: 60 };

describe("RS-01 validarEjercicio", () => {
  it("acepta un ejercicio con todos los campos en rango", () => {
    expect(validarEjercicio(valido)).toEqual([]);
  });
  it("acepta carga 0 (peso corporal) y descanso 0", () => {
    expect(validarEjercicio({ ...valido, carga_kg: 0, descanso_seg: 0 })).toEqual([]);
  });
  it("rechaza día fuera de 1..7", () => {
    expect(validarEjercicio({ ...valido, dia_semana: 8 })).toHaveLength(1);
    expect(validarEjercicio({ ...valido, dia_semana: 0 })).toHaveLength(1);
  });
  it("rechaza series fuera de 1..50", () => {
    expect(validarEjercicio({ ...valido, series: 0 })).toHaveLength(1);
    expect(validarEjercicio({ ...valido, series: 51 })).toHaveLength(1);
  });
  it("rechaza valores negativos en carga y descanso", () => {
    expect(validarEjercicio({ ...valido, carga_kg: -1 })).toHaveLength(1);
    expect(validarEjercicio({ ...valido, descanso_seg: -5 })).toHaveLength(1);
  });
  it("acepta repeticiones '12' y '10-12'; rechaza '0', 'abc' y '12-10'", () => {
    expect(validarEjercicio({ ...valido, repeticiones: "12" })).toEqual([]);
    expect(validarEjercicio({ ...valido, repeticiones: "0" })).toHaveLength(1);
    expect(validarEjercicio({ ...valido, repeticiones: "abc" })).toHaveLength(1);
    expect(validarEjercicio({ ...valido, repeticiones: "12-10" })).toHaveLength(1);
  });
  it("el mensaje sigue el formato exigido por la ERS", () => {
    expect(mensajeError("Series", "un entero entre 1 y 50"))
      .toBe("Error de validación: El campo Series debe ser un entero entre 1 y 50. Por favor corregir antes de guardar.");
  });
});

describe("RS-01 validarRutina", () => {
  const base = { entrenador_id: "u1", nombre: "Fuerza A", objetivo: null, es_plantilla: false, origen_id: null };
  it("acepta rutina con nombre válido y un ejercicio", () => {
    expect(validarRutina({ ...base, ejercicios: [valido] }).ok).toBe(true);
  });
  it("rechaza rutina sin ejercicios", () => {
    const r = validarRutina({ ...base, ejercicios: [] });
    expect(r.ok).toBe(false);
    expect(r.errores[0]).toContain("Lista de ejercicios");
  });
  it("rechaza nombre menor a 3 caracteres", () => {
    expect(validarRutina({ ...base, nombre: "ab", ejercicios: [valido] }).ok).toBe(false);
  });
  it("acumula los errores de varios ejercicios con su posición", () => {
    const r = validarRutina({ ...base, ejercicios: [valido, { ...valido, series: 0 }, { ...valido, dia_semana: 9 }] });
    expect(r.errores).toHaveLength(2);
    expect(r.errores[0]).toMatch(/^Ejercicio 2:/);
    expect(r.errores[1]).toMatch(/^Ejercicio 3:/);
  });
});
