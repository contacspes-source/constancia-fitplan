/**
 * datos/rutinas.ts — Persistencia de rutinas (RS-01, CU-08).
 * Al editar se comparan los ejercicios por id en lugar de borrar y reinsertar:
 * borrar un ejercicio elimina en cascada sus marcas de cumplimiento (RS-07),
 * así que solo se borran los que el entrenador quitó.
 */
import { supabase } from "./supabase";
import { exigir, registrarDenegado, ErrorNegocio } from "./errores";
import type { EjercicioRutina, Rutina } from "@/tipos";

export interface RutinaResumen { id: number; nombre: string; objetivo: string | null; creado_en: string; num_ejercicios: number }

export async function listarRutinas(): Promise<RutinaResumen[]> {
  const filas = exigir(await supabase.from("rutina")
    .select("id, nombre, objetivo, creado_en, rutina_ejercicio(count)")
    .order("creado_en", { ascending: false }), "cargar las rutinas") as any[];
  return filas.map((r) => ({ id: r.id, nombre: r.nombre, objetivo: r.objetivo, creado_en: r.creado_en,
    num_ejercicios: r.rutina_ejercicio?.[0]?.count ?? 0 }));
}

export async function obtenerRutina(id: number): Promise<Rutina> {
  const r = exigir(await supabase.from("rutina")
    .select("id, entrenador_id, nombre, objetivo, es_plantilla, origen_id, rutina_ejercicio(*)")
    .eq("id", id).maybeSingle(), "cargar la rutina") as any;
  if (!r) throw new ErrorNegocio("La rutina no existe o no tiene permisos para verla.");
  const ejercicios = (r.rutina_ejercicio as any[])
    .sort((a, b) => a.orden - b.orden || a.id - b.id)
    .map((e): EjercicioRutina => ({ id: e.id, ejercicio_id: e.ejercicio_id, dia_semana: e.dia_semana, series: e.series,
      repeticiones: e.repeticiones, carga_kg: Number(e.carga_kg), descanso_seg: e.descanso_seg, orden: e.orden }));
  return { id: r.id, entrenador_id: r.entrenador_id, nombre: r.nombre, objetivo: r.objetivo,
    es_plantilla: r.es_plantilla, origen_id: r.origen_id, ejercicios };
}

/** Crea o actualiza la rutina. Devuelve su id. La validación previa la hace negocio/validacion.ts. */
export async function guardarRutina(r: Rutina): Promise<number> {
  let id = r.id;
  if (id === undefined) {
    const nueva = exigir(await supabase.from("rutina")
      .insert({ entrenador_id: r.entrenador_id, nombre: r.nombre.trim(), objetivo: r.objetivo?.trim() || null })
      .select("id").single(), "crear la rutina") as { id: number };
    id = nueva.id;
  } else {
    const act = exigir(await supabase.from("rutina")
      .update({ nombre: r.nombre.trim(), objetivo: r.objetivo?.trim() || null })
      .eq("id", id).select("id"), "modificar esta rutina") as any[];
    if (act.length === 0) {               // RLS filtró la fila: no es el creador
      await registrarDenegado("modificar_rutina", `rutina ${id}`);
      throw new ErrorNegocio("No tiene permisos para modificar esta rutina.");
    }
  }

  const filas = r.ejercicios.map((e, i) => ({
    rutina_id: id, ejercicio_id: e.ejercicio_id, dia_semana: e.dia_semana, series: e.series,
    repeticiones: e.repeticiones.trim(), carga_kg: e.carga_kg, descanso_seg: e.descanso_seg, orden: i,
  }));

  if (r.id !== undefined) {
    const existentes = exigir(await supabase.from("rutina_ejercicio").select("id").eq("rutina_id", id), "cargar la rutina") as { id: number }[];
    const conservar = new Set(r.ejercicios.filter((e) => e.id !== undefined).map((e) => e.id));
    const quitar = existentes.map((e) => e.id).filter((x) => !conservar.has(x));
    if (quitar.length) exigir(await supabase.from("rutina_ejercicio").delete().in("id", quitar), "quitar ejercicios");
    for (const [i, e] of r.ejercicios.entries()) {
      if (e.id !== undefined) exigir(await supabase.from("rutina_ejercicio").update(filas[i]).eq("id", e.id), "actualizar un ejercicio");
    }
  }
  const nuevos = filas.filter((_, i) => r.ejercicios[i].id === undefined);
  if (nuevos.length) exigir(await supabase.from("rutina_ejercicio").insert(nuevos), "guardar los ejercicios");
  return id;
}

export async function eliminarRutina(id: number): Promise<void> {
  const borradas = exigir(await supabase.from("rutina").delete().eq("id", id).select("id"), "eliminar la rutina") as any[];
  if (borradas.length === 0) {
    await registrarDenegado("eliminar_rutina", `rutina ${id}`);
    throw new ErrorNegocio("No tiene permisos para modificar esta rutina.");
  }
}
