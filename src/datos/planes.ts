/**
 * datos/planes.ts — Persistencia de planes alimenticios (RS-02, CU-10).
 * Los tiempos de comida se conservan por tipo (sus marcas de cumplimiento dependen
 * de su id); las porciones se reemplazan completas porque nada las referencia.
 * Los totales nutricionales NO se guardan: se calculan siempre (RS-02).
 */
import { supabase } from "./supabase";
import { exigir, registrarDenegado, ErrorNegocio } from "./errores";
import type { PlanAlimenticio, PorcionAlimento, TipoComida } from "@/tipos";
import { TIPOS_COMIDA } from "@/tipos";

export interface PlanResumen { id: number; nombre: string; creado_en: string; num_tiempos: number }

export async function listarPlanes(): Promise<PlanResumen[]> {
  const filas = exigir(await supabase.from("plan_alimenticio")
    .select("id, nombre, creado_en, tiempo_comida(count)")
    .order("creado_en", { ascending: false }), "cargar los planes") as any[];
  return filas.map((p) => ({ id: p.id, nombre: p.nombre, creado_en: p.creado_en, num_tiempos: p.tiempo_comida?.[0]?.count ?? 0 }));
}

export async function obtenerPlan(id: number): Promise<PlanAlimenticio> {
  const p = exigir(await supabase.from("plan_alimenticio")
    .select("id, nutriologo_id, nombre, es_plantilla, origen_id, tiempo_comida(id, tipo, porcion_alimento(*))")
    .eq("id", id).maybeSingle(), "cargar el plan") as any;
  if (!p) throw new ErrorNegocio("El plan no existe o no tiene permisos para verlo.");
  const orden = (t: TipoComida) => TIPOS_COMIDA.indexOf(t);
  const tiempos = (p.tiempo_comida as any[])
    .sort((a, b) => orden(a.tipo) - orden(b.tipo))
    .map((t) => ({ id: t.id, tipo: t.tipo as TipoComida,
      porciones: (t.porcion_alimento as any[]).sort((a, b) => a.id - b.id).map((x): PorcionAlimento => ({
        id: x.id, alimento_id: x.alimento_id, nombre_copia: x.nombre_copia, cantidad: Number(x.cantidad), unidad: x.unidad })) }));
  return { id: p.id, nutriologo_id: p.nutriologo_id, nombre: p.nombre, es_plantilla: p.es_plantilla, origen_id: p.origen_id, tiempos };
}

export async function guardarPlan(p: PlanAlimenticio): Promise<number> {
  let id = p.id;
  if (id === undefined) {
    const nuevo = exigir(await supabase.from("plan_alimenticio")
      .insert({ nutriologo_id: p.nutriologo_id, nombre: p.nombre.trim() }).select("id").single(), "crear el plan") as { id: number };
    id = nuevo.id;
  } else {
    const act = exigir(await supabase.from("plan_alimenticio").update({ nombre: p.nombre.trim() }).eq("id", id).select("id"), "modificar este plan") as any[];
    if (act.length === 0) {
      await registrarDenegado("modificar_plan", `plan ${id}`);
      throw new ErrorNegocio("No tiene permisos para modificar este plan.");
    }
  }

  const existentes = exigir(await supabase.from("tiempo_comida").select("id, tipo").eq("plan_id", id), "cargar el plan") as { id: number; tipo: TipoComida }[];
  const porTipo = new Map(existentes.map((t) => [t.tipo, t.id]));
  const tiposNuevos = new Set(p.tiempos.map((t) => t.tipo));

  const quitar = existentes.filter((t) => !tiposNuevos.has(t.tipo)).map((t) => t.id);
  if (quitar.length) exigir(await supabase.from("tiempo_comida").delete().in("id", quitar), "quitar tiempos de comida");

  for (const t of p.tiempos) {
    let tiempoId = porTipo.get(t.tipo);
    if (tiempoId === undefined) {
      const nt = exigir(await supabase.from("tiempo_comida").insert({ plan_id: id, tipo: t.tipo }).select("id").single(), "agregar un tiempo de comida") as { id: number };
      tiempoId = nt.id;
    } else {
      exigir(await supabase.from("porcion_alimento").delete().eq("tiempo_id", tiempoId), "actualizar los alimentos");
    }
    const filas = t.porciones.map((po) => ({ tiempo_id: tiempoId, alimento_id: po.alimento_id,
      nombre_copia: po.nombre_copia.trim(), cantidad: po.cantidad, unidad: po.unidad }));
    if (filas.length) exigir(await supabase.from("porcion_alimento").insert(filas), "guardar los alimentos");
  }
  return id;
}

export async function eliminarPlan(id: number): Promise<void> {
  const borrados = exigir(await supabase.from("plan_alimenticio").delete().eq("id", id).select("id"), "eliminar el plan") as any[];
  if (borrados.length === 0) {
    await registrarDenegado("eliminar_plan", `plan ${id}`);
    throw new ErrorNegocio("No tiene permisos para modificar este plan.");
  }
}
