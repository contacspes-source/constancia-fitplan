/**
 * datos/dia.ts — Vista del día y registro de cumplimiento del cliente (RS-06, RS-07),
 * y panel de adherencia del instructor (RS-05). Las reglas viven en el servidor:
 * vista_del_dia(), marcar_cumplimiento() y adherencia_cartera_validada().
 */
import { supabase } from "./supabase";
import { exigir } from "./errores";
import type { VistaDelDia } from "@/negocio/dia";
import type { AdherenciaCliente, Ventana } from "@/negocio/adherencia";

export async function obtenerVistaDelDia(): Promise<VistaDelDia> {
  return exigir(await supabase.rpc("vista_del_dia"), "cargar tu día") as VistaDelDia;
}

export type Elemento = { tipo: "ejercicio" | "comida"; id: number };

/** Marca o desmarca. Repetir la misma petición no duplica el registro (RS-07). */
export async function marcarCumplimiento(e: Elemento, completado: boolean): Promise<void> {
  exigir(await supabase.rpc("marcar_cumplimiento", {
    p_rutina_ejercicio_id: e.tipo === "ejercicio" ? e.id : null,
    p_tiempo_comida_id: e.tipo === "comida" ? e.id : null,
    p_completado: completado,
  }), "registrar el cumplimiento");
}

export async function obtenerAdherencia(dias: Ventana): Promise<AdherenciaCliente[]> {
  const filas = exigir(await supabase.rpc("adherencia_cartera_validada", { p_dias: dias }), "calcular la adherencia") as any[];
  return filas.map((f) => ({ cliente_id: f.cliente_id, nombre: f.nombre, programados: Number(f.programados),
    completados: Number(f.completados), adherencia: f.adherencia === null ? null : Number(f.adherencia) }));
}
