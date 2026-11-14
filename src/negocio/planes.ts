/**
 * negocio/planes.ts — Validación de planes alimenticios (RS-02, CU-10).
 * Estructura exigida: Plan → Tiempos de comida (1 a 5) → Alimentos (≥ 1 por tiempo).
 * Cada porción: cantidad decimal > 0 y unidad G, ML o PIEZA.
 */
import type { Alimento, PlanAlimenticio, ResultadoValidacion } from "@/tipos";
import { ETIQUETA_COMIDA, TIPOS_COMIDA } from "@/tipos";
import { mensajeError } from "./validacion";

const UNIDADES = ["G", "ML", "PIEZA"];

/**
 * @param catalogo Opcional. Si se pasa, verifica también que las porciones en PIEZA
 * correspondan a alimentos con equivalencia en gramos; sin ella no hay cálculo de macros.
 */
export function validarPlan(p: Partial<PlanAlimenticio>, catalogo?: Map<number, Alimento>): ResultadoValidacion {
  const errores: string[] = [];
  const nombre = (p.nombre ?? "").trim();
  if (nombre.length < 3 || nombre.length > 100)
    errores.push(mensajeError("Nombre del plan", "un texto de 3 a 100 caracteres"));

  const tiempos = p.tiempos ?? [];
  if (tiempos.length === 0) {
    errores.push(mensajeError("Tiempos de comida", "una lista con al menos 1 tiempo de comida con alimentos"));
    return { ok: false, errores };
  }

  const vistos = new Set<string>();
  for (const t of tiempos) {
    const etiqueta = ETIQUETA_COMIDA[t.tipo] ?? String(t.tipo);
    if (!TIPOS_COMIDA.includes(t.tipo)) {
      errores.push(mensajeError("Tiempo de comida", "Desayuno, Colación 1, Comida, Colación 2 o Cena"));
      continue;
    }
    if (vistos.has(t.tipo)) errores.push(`${etiqueta}: ` + mensajeError("Tiempo de comida", "único dentro del plan"));
    vistos.add(t.tipo);
    if (t.porciones.length === 0)
      errores.push(`${etiqueta}: ` + mensajeError("Alimentos", "una lista con al menos 1 alimento"));
    t.porciones.forEach((po, i) => {
      if (!(typeof po.cantidad === "number" && po.cantidad > 0))
        errores.push(`${etiqueta}, alimento ${i + 1}: ` + mensajeError("Porción", "un número mayor a 0"));
      if (!UNIDADES.includes(po.unidad))
        errores.push(`${etiqueta}, alimento ${i + 1}: ` + mensajeError("Unidad", "gramos, mililitros o piezas"));
      if (catalogo && po.unidad === "PIEZA" && po.alimento_id !== null && !catalogo.get(po.alimento_id)?.gramos_por_pieza)
        errores.push(`${etiqueta}, alimento ${i + 1}: ` + mensajeError("Unidad", "gramos o mililitros: este alimento no se mide por pieza"));
      if (!po.nombre_copia?.trim())
        errores.push(`${etiqueta}, alimento ${i + 1}: ` + mensajeError("Alimento", "un alimento del catálogo"));
    });
  }
  return { ok: errores.length === 0, errores };
}
