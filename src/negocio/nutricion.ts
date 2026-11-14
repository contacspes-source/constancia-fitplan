/**
 * negocio/nutricion.ts — Cálculo de calorías y macronutrientes (RS-02, CU-11).
 * Los totales nunca los captura el usuario: se derivan del catálogo y las porciones.
 */
import type { Alimento, PorcionAlimento, Totales } from "@/tipos";

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
