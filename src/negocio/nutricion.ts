/**
 * negocio/nutricion.ts — Cálculo de calorías y macronutrientes (RS-02, CU-11).
 * Los totales nunca los captura el usuario: se derivan del catálogo y las porciones.
 */
import type { Alimento, PlanAlimenticio, PorcionAlimento, ResultadoValidacion, Totales } from "@/tipos";
import { ETIQUETA_COMIDA } from "@/tipos";
import { mensajeError } from "./validacion";

export const TOTALES_CERO: Totales = { kcal: 0, proteina: 0, carbohidratos: 0, grasa: 0 };

/**
 * Gramos (o mililitros) equivalentes de una porción.
 * PIEZA requiere gramos_por_pieza en el alimento; si falta, la porción no es calculable.
 */
export function gramosDePorcion(p: Pick<PorcionAlimento, "cantidad" | "unidad">, a: Pick<Alimento, "gramos_por_pieza"> | null): number | null {
  if (!(p.cantidad > 0)) return null;
  if (p.unidad === "PIEZA") return a?.gramos_por_pieza ? p.cantidad * a.gramos_por_pieza : null;
  return p.cantidad;
}

/** Aporte de una porción. `null` si el alimento ya no está en el catálogo o no es calculable. */
export function aportePorcion(p: PorcionAlimento, a: Alimento | null): Totales | null {
  const g = gramosDePorcion(p, a);
  if (g === null || !a) return null;
  const f = g / 100;
  return {
    kcal: a.kcal_100 * f,
    proteina: a.proteina_100 * f,
    carbohidratos: a.carbohidratos_100 * f,
    grasa: a.grasa_100 * f,
  };
}

export function sumarTotales(lista: (Totales | null)[]): Totales {
  return lista.reduce<Totales>((acc, t) => t ? {
    kcal: acc.kcal + t.kcal,
    proteina: acc.proteina + t.proteina,
    carbohidratos: acc.carbohidratos + t.carbohidratos,
    grasa: acc.grasa + t.grasa,
  } : acc, { ...TOTALES_CERO });
}

/** Totales de un plan completo a partir de sus porciones y el catálogo. */
export function totalesPlan(porciones: PorcionAlimento[], catalogo: Map<number, Alimento>): Totales {
  return sumarTotales(porciones.map(p => aportePorcion(p, p.alimento_id !== null ? catalogo.get(p.alimento_id) ?? null : null)));
}

export function redondearTotales(t: Totales, decimales = 1): Totales {
  const r = (n: number) => Number(n.toFixed(decimales));
  return { kcal: r(t.kcal), proteina: r(t.proteina), carbohidratos: r(t.carbohidratos), grasa: r(t.grasa) };
}

/**
 * Valida un plan alimenticio antes de guardarlo (RS-02). Mensajes con el
 * formato de RS-01. El servidor repite los rangos con CHECK.
 */
export function validarPlan(p: Pick<PlanAlimenticio, "nombre" | "tiempos">, catalogo: Map<number, Alimento>): ResultadoValidacion {
  const errores: string[] = [];
  const nombre = (p.nombre ?? "").trim();
  if (nombre.length < 3 || nombre.length > 100)
    errores.push(mensajeError("Nombre del plan", "un texto de 3 a 100 caracteres"));
  const conAlimentos = p.tiempos.filter(t => t.porciones.length > 0);
  if (conAlimentos.length === 0)
    errores.push(mensajeError("Tiempos de comida", "una lista con al menos 1 alimento en algún tiempo de comida"));
  for (const t of conAlimentos) {
    t.porciones.forEach((x, i) => {
      const pref = `${ETIQUETA_COMIDA[t.tipo]}, alimento ${i + 1}: `;
      const a = x.alimento_id !== null ? catalogo.get(x.alimento_id) ?? null : null;
      if (x.alimento_id === null || !a) errores.push(pref + mensajeError("Alimento", "un alimento del catálogo"));
      if (typeof x.cantidad !== "number" || !(x.cantidad > 0))
        errores.push(pref + mensajeError("Porción", "un número decimal mayor que 0"));
      if (!["G", "ML", "PIEZA"].includes(x.unidad))
        errores.push(pref + mensajeError("Unidad", "gramos, mililitros o piezas"));
      else if (x.unidad === "PIEZA" && a && !a.gramos_por_pieza)
        errores.push(pref + mensajeError("Unidad", `gramos o mililitros, porque "${a.nombre}" no se mide por pieza`));
    });
  }
  return { ok: errores.length === 0, errores };
}
