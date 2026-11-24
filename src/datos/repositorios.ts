/**
 * datos/repositorios.ts — Consultas a Supabase agrupadas por módulo del modelo
 * (Act. 12). Ninguna función decide permisos: el servidor los aplica con RLS
 * (0002_acceso_rls.sql). Aquí solo se traducen los errores a mensajes claros.
 */
import { supabase } from "./supabase";
import type {
  Alimento, Asignacion, Ejercicio, EjercicioRutina, PlanAlimenticio, Perfil,
  PorcionAlimento, Rutina, TipoComida, Unidad,
} from "@/tipos";
import { desglosarAdherencia, type AdherenciaDesglosada, type Ventana } from "@/negocio/adherencia";

type ErrorPg = { code?: string; message: string } | null;

/** Convierte un error de PostgREST/PostgreSQL en un mensaje para el usuario. */
async function fallo(e: ErrorPg, accion: string, sinPermiso = "No tiene permisos para realizar esta operación."): Promise<never> {
  const code = e?.code ?? "";
  // 42501 = RLS / privilegio insuficiente. RS-10: se registra y no se revela el recurso.
  if (code === "42501" || code === "PGRST301") {
    await supabase.rpc("registrar_denegado", { p_accion: accion, p_detalle: e?.message ?? null });
    throw new Error(sinPermiso);
  }
  if (code === "23514") throw new Error("Algún valor está fuera del rango permitido. Revise los campos marcados.");
  if (code === "23505") throw new Error("Ya existe un registro con esos datos.");
  if (code === "23503") throw new Error("El registro está en uso por otra información y no puede modificarse así.");
  throw new Error(e?.message ?? "Ocurrió un error inesperado. Intente de nuevo.");
}

// ---------- Fecha del servidor (RS-06, RS-07) --------------------------------
export async function fechaServidor(): Promise<string> {
  const { data, error } = await supabase.rpc("fecha_servidor");
  if (error) return fallo(error, "fecha_servidor");
  return data as string;
}

// ---------- Catálogos ---------------------------------------------------------
export async function listarEjercicios(): Promise<Ejercicio[]> {
  const { data, error } = await supabase.from("ejercicio").select("*").order("grupo_muscular").order("nombre");
  if (error) return fallo(error, "listar_ejercicios");
  return data as Ejercicio[];
}

export async function listarAlimentos(): Promise<Alimento[]> {
  const { data, error } = await supabase.from("alimento").select("*").order("nombre");
  if (error) return fallo(error, "listar_alimentos");
  return (data as Alimento[]).map(a => ({
    ...a,
    kcal_100: Number(a.kcal_100), proteina_100: Number(a.proteina_100),
    carbohidratos_100: Number(a.carbohidratos_100), grasa_100: Number(a.grasa_100),
    gramos_por_pieza: a.gramos_por_pieza === null ? null : Number(a.gramos_por_pieza),
  }));
}

// ---------- Rutinas (RS-01) ---------------------------------------------------
export interface ResumenRutina { id: number; nombre: string; objetivo: string | null; ejercicios: number }

export async function listarRutinas(): Promise<ResumenRutina[]> {
  const { data, error } = await supabase.from("rutina")
    .select("id, nombre, objetivo, rutina_ejercicio(count)")
    .order("creado_en", { ascending: false });
  if (error) return fallo(error, "listar_rutinas");
  return (data as any[]).map(r => ({ id: r.id, nombre: r.nombre, objetivo: r.objetivo, ejercicios: r.rutina_ejercicio?.[0]?.count ?? 0 }));
}

export async function obtenerRutina(id: number): Promise<Rutina> {
  const { data, error } = await supabase.from("rutina")
    .select("*, rutina_ejercicio(*)").eq("id", id).single();
  if (error) return fallo(error, "obtener_rutina", "No tiene permisos para modificar esta rutina.");
  const ejercicios = ((data as any).rutina_ejercicio as any[])
    .map(e => ({ ...e, carga_kg: Number(e.carga_kg) }) as EjercicioRutina)
    .sort((a, b) => a.dia_semana - b.dia_semana || (a.orden ?? 0) - (b.orden ?? 0));
  return { ...(data as any), ejercicios };
}

/**
 * Guarda la rutina y sus ejercicios. Al editar se actualizan los ejercicios
 * existentes por id (para conservar sus marcas de cumplimiento), se insertan
 * los nuevos y se eliminan los retirados.
 */
export async function guardarRutina(r: Rutina): Promise<number> {
  const sinPermiso = "No tiene permisos para modificar esta rutina.";
  let id = r.id;
  if (id === undefined) {
    // entrenador_id lo valida RLS contra auth.uid(): asociación inmutable (RS-01).
    const { data, error } = await supabase.from("rutina")
      .insert({ entrenador_id: r.entrenador_id, nombre: r.nombre.trim(), objetivo: r.objetivo?.trim() || null })
      .select("id").single();
    if (error) return fallo(error, "crear_rutina", sinPermiso);
    id = (data as { id: number }).id;
  } else {
    const { data, error } = await supabase.from("rutina")
      .update({ nombre: r.nombre.trim(), objetivo: r.objetivo?.trim() || null }).eq("id", id).select("id");
    if (error) return fallo(error, "editar_rutina", sinPermiso);
    if (!data || data.length === 0) return fallo({ code: "42501", message: `rutina ${id}` }, "editar_rutina", sinPermiso);
  }

  const filas = r.ejercicios.map((e, i) => ({
    rutina_id: id!, ejercicio_id: e.ejercicio_id, dia_semana: e.dia_semana, series: e.series,
    repeticiones: e.repeticiones.trim(), carga_kg: e.carga_kg, descanso_seg: e.descanso_seg, orden: i,
  }));
  const conservar = r.ejercicios.filter(e => e.id !== undefined).map(e => e.id!);

  if (r.id !== undefined) {
    let q = supabase.from("rutina_ejercicio").delete().eq("rutina_id", id);
    if (conservar.length) q = q.not("id", "in", `(${conservar.join(",")})`);
    const { error } = await q;
    if (error) return fallo(error, "editar_rutina", sinPermiso);
  }
  for (let i = 0; i < r.ejercicios.length; i++) {
    const e = r.ejercicios[i];
    if (e.id === undefined) continue;
    const { error } = await supabase.from("rutina_ejercicio").update(filas[i]).eq("id", e.id);
    if (error) return fallo(error, "editar_rutina", sinPermiso);
  }
  const nuevas = filas.filter((_, i) => r.ejercicios[i].id === undefined);
  if (nuevas.length) {
    const { error } = await supabase.from("rutina_ejercicio").insert(nuevas);
    if (error) return fallo(error, "editar_rutina", sinPermiso);
  }
  return id!;
}

export async function eliminarRutina(id: number): Promise<void> {
  const { data, error } = await supabase.from("rutina").delete().eq("id", id).select("id");
  if (error) {
    if (error.code === "23503") throw new Error("La rutina está asignada a un cliente. Elimine primero esa asignación.");
    return fallo(error, "eliminar_rutina", "No tiene permisos para modificar esta rutina.");
  }
  if (!data || data.length === 0) return fallo({ code: "42501", message: `rutina ${id}` }, "eliminar_rutina", "No tiene permisos para modificar esta rutina.");
}

// ---------- Planes alimenticios (RS-02) --------------------------------------
export interface ResumenPlan { id: number; nombre: string; tiempos: number }

export async function listarPlanes(): Promise<ResumenPlan[]> {
  const { data, error } = await supabase.from("plan_alimenticio")
    .select("id, nombre, tiempo_comida(count)").order("creado_en", { ascending: false });
  if (error) return fallo(error, "listar_planes");
  return (data as any[]).map(p => ({ id: p.id, nombre: p.nombre, tiempos: p.tiempo_comida?.[0]?.count ?? 0 }));
}

const SELECT_PLAN = "*, tiempo_comida(id, tipo, porcion_alimento(id, alimento_id, nombre_copia, cantidad, unidad))";

function mapearPlan(data: any): PlanAlimenticio {
  return {
    ...data,
    tiempos: (data.tiempo_comida as any[]).map(t => ({
      id: t.id, tipo: t.tipo as TipoComida,
      porciones: (t.porcion_alimento as any[]).map(p => ({ ...p, cantidad: Number(p.cantidad), unidad: p.unidad as Unidad }) as PorcionAlimento),
    })),
  };
}

export async function obtenerPlan(id: number): Promise<PlanAlimenticio> {
  const { data, error } = await supabase.from("plan_alimenticio").select(SELECT_PLAN).eq("id", id).single();
  if (error) return fallo(error, "obtener_plan", "No tiene permisos para modificar este plan.");
  return mapearPlan(data);
}

/**
 * Guarda el plan. Los tiempos de comida se conservan por tipo (para no perder
 * las marcas de cumplimiento); las porciones se reemplazan completas. Un tiempo
 * que se queda sin alimentos se elimina, porque contaría como programado (RS-05).
 */
export async function guardarPlan(p: PlanAlimenticio): Promise<number> {
  const sinPermiso = "No tiene permisos para modificar este plan.";
  let id = p.id;
  if (id === undefined) {
    const { data, error } = await supabase.from("plan_alimenticio")
      .insert({ nutriologo_id: p.nutriologo_id, nombre: p.nombre.trim() }).select("id").single();
    if (error) return fallo(error, "crear_plan", sinPermiso);
    id = (data as { id: number }).id;
  } else {
    const { data, error } = await supabase.from("plan_alimenticio").update({ nombre: p.nombre.trim() }).eq("id", id).select("id");
    if (error) return fallo(error, "editar_plan", sinPermiso);
    if (!data || data.length === 0) return fallo({ code: "42501", message: `plan ${id}` }, "editar_plan", sinPermiso);
  }

  const { data: actuales, error: e1 } = await supabase.from("tiempo_comida").select("id, tipo").eq("plan_id", id);
  if (e1) return fallo(e1, "editar_plan", sinPermiso);
  const porTipo = new Map((actuales as { id: number; tipo: TipoComida }[]).map(t => [t.tipo, t.id]));
  const conAlimentos = p.tiempos.filter(t => t.porciones.length > 0);

  const retirar = [...porTipo.entries()].filter(([tipo]) => !conAlimentos.some(t => t.tipo === tipo)).map(([, tid]) => tid);
  if (retirar.length) {
    const { error } = await supabase.from("tiempo_comida").delete().in("id", retirar);
    if (error) return fallo(error, "editar_plan", sinPermiso);
  }

  for (const t of conAlimentos) {
    let tid = porTipo.get(t.tipo);
    if (tid === undefined) {
      const { data, error } = await supabase.from("tiempo_comida").insert({ plan_id: id, tipo: t.tipo }).select("id").single();
      if (error) return fallo(error, "editar_plan", sinPermiso);
      tid = (data as { id: number }).id;
    } else {
      const { error } = await supabase.from("porcion_alimento").delete().eq("tiempo_id", tid);
      if (error) return fallo(error, "editar_plan", sinPermiso);
    }
    const { error } = await supabase.from("porcion_alimento").insert(t.porciones.map(x => ({
      tiempo_id: tid, alimento_id: x.alimento_id, nombre_copia: x.nombre_copia, cantidad: x.cantidad, unidad: x.unidad,
    })));
    if (error) return fallo(error, "editar_plan", sinPermiso);
  }
  return id!;
}

export async function eliminarPlan(id: number): Promise<void> {
  const { data, error } = await supabase.from("plan_alimenticio").delete().eq("id", id).select("id");
  if (error) {
    if (error.code === "23503") throw new Error("El plan está asignado a un cliente. Elimine primero esa asignación.");
    return fallo(error, "eliminar_plan", "No tiene permisos para modificar este plan.");
  }
  if (!data || data.length === 0) return fallo({ code: "42501", message: `plan ${id}` }, "eliminar_plan", "No tiene permisos para modificar este plan.");
}

// ---------- Cartera de clientes e invitaciones (RS-03) -----------------------
export interface ClienteCartera { usuario_id: string; nombre: string; correo: string; objetivo: string | null }

export async function listarClientes(): Promise<ClienteCartera[]> {
  const { data, error } = await supabase.from("cliente")
    .select("usuario_id, objetivo, perfil:perfil!cliente_usuario_id_fkey(nombre, correo)");
  if (error) return fallo(error, "listar_clientes");
  return (data as any[])
    .map(c => ({ usuario_id: c.usuario_id, objetivo: c.objetivo, nombre: c.perfil?.nombre ?? "—", correo: c.perfil?.correo ?? "" }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export interface Invitacion { id: number; nombre: string; correo: string; token: string; expira_en: string; usada_en: string | null }

export async function listarInvitaciones(): Promise<Invitacion[]> {
  const { data, error } = await supabase.from("invitacion")
    .select("id, nombre, correo, token, expira_en, usada_en").order("id", { ascending: false });
  if (error) return fallo(error, "listar_invitaciones");
  return data as Invitacion[];
}

/** Token de 64 caracteres hexadecimales generado con el CSPRNG del navegador. */
export function generarToken(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return [...b].map(x => x.toString(16).padStart(2, "0")).join("");
}

export const VIGENCIA_INVITACION_MS = 72 * 60 * 60 * 1000;

export async function crearInvitacion(instructorId: string, nombre: string, correo: string): Promise<Invitacion> {
  const { data, error } = await supabase.from("invitacion").insert({
    instructor_id: instructorId, nombre: nombre.trim(), correo: correo.trim().toLowerCase(),
    token: generarToken(), expira_en: new Date(Date.now() + VIGENCIA_INVITACION_MS).toISOString(),
  }).select("id, nombre, correo, token, expira_en, usada_en").single();
  if (error) return fallo(error, "crear_invitacion");
  return data as Invitacion;
}

/** Reemite un código caducado: nuevo token y 72 h más (RS-03). */
export async function reemitirInvitacion(id: number): Promise<void> {
  const { error } = await supabase.from("invitacion")
    .update({ token: generarToken(), expira_en: new Date(Date.now() + VIGENCIA_INVITACION_MS).toISOString() })
    .eq("id", id).is("usada_en", null);
  if (error) return fallo(error, "reemitir_invitacion");
}

export async function eliminarInvitacion(id: number): Promise<void> {
  const { error } = await supabase.from("invitacion").delete().eq("id", id).is("usada_en", null);
  if (error) return fallo(error, "eliminar_invitacion");
}

// ---------- Asignaciones (RS-03) ----------------------------------------------
export interface AsignacionDetalle extends Asignacion { id: number; nombre_programa: string; propia: boolean }

export async function listarAsignaciones(miId: string): Promise<AsignacionDetalle[]> {
  const { data, error } = await supabase.from("asignacion")
    .select("*, rutina(nombre), plan_alimenticio(nombre)").order("fecha_inicio", { ascending: false });
  if (error) return fallo(error, "listar_asignaciones");
  return (data as any[]).map(a => ({
    id: a.id, cliente_id: a.cliente_id, asignado_por: a.asignado_por, rutina_id: a.rutina_id, plan_id: a.plan_id,
    fecha_inicio: a.fecha_inicio, fecha_fin: a.fecha_fin,
    // El nombre del programa del otro instructor no es visible por RLS: se muestra genérico.
    nombre_programa: a.rutina?.nombre ?? a.plan_alimenticio?.nombre ?? (a.rutina_id ? "Rutina de otro instructor" : "Plan de otro instructor"),
    propia: a.asignado_por === miId,
  }));
}

export async function crearAsignacion(a: Asignacion): Promise<void> {
  const { error } = await supabase.from("asignacion").insert({
    cliente_id: a.cliente_id, asignado_por: a.asignado_por, rutina_id: a.rutina_id, plan_id: a.plan_id,
    fecha_inicio: a.fecha_inicio, fecha_fin: a.fecha_fin,
  });
  if (error) {
    // El trigger de solape (P0001) ya trae el mensaje con la asignación en conflicto.
    if (error.code === "P0001") throw new Error(error.message);
    return fallo(error, "crear_asignacion");
  }
}

export async function eliminarAsignacion(id: number): Promise<void> {
  const { data, error } = await supabase.from("asignacion").delete().eq("id", id).select("id");
  if (error) return fallo(error, "eliminar_asignacion");
  if (!data || data.length === 0) return fallo({ code: "42501", message: `asignacion ${id}` }, "eliminar_asignacion");
}

// ---------- Adherencia (RS-05) ------------------------------------------------
export async function adherenciaCartera(dias: Ventana): Promise<AdherenciaDesglosada[]> {
  const { data, error } = await supabase.rpc("adherencia_por_area", { p_dias: dias });
  if (error) {
    // Si aún no se aplica la migración 0007, se usa la función anterior (sin desglose).
    if (error.code === "PGRST202" || error.code === "42883") return adherenciaSinDesglose(dias);
    return fallo(error, "adherencia_cartera");
  }
  return (data as any[]).map(r => desglosarAdherencia({
    cliente_id: r.cliente_id, nombre: r.nombre,
    ej_programados: Number(r.ej_programados), ej_completados: Number(r.ej_completados),
    com_programados: Number(r.com_programados), com_completados: Number(r.com_completados),
  }));
}

async function adherenciaSinDesglose(dias: Ventana): Promise<AdherenciaDesglosada[]> {
  const { data, error } = await supabase.rpc("adherencia_cartera_validada", { p_dias: dias });
  if (error) return fallo(error, "adherencia_cartera");
  const nd = { programados: 0, completados: 0, adherencia: null };
  return (data as any[]).map(r => ({
    cliente_id: r.cliente_id, nombre: r.nombre, programados: Number(r.programados), completados: Number(r.completados),
    adherencia: r.adherencia === null ? null : Number(r.adherencia), entrenamiento: nd, alimentacion: nd,
  }));
}

// ---------- Vista del día y cumplimiento (RS-06, RS-07) -----------------------
// Ambas operaciones las resuelve el servidor (migración 0006): fecha, cruce con
// asignaciones vigentes, validación de "solo lo de hoy", no duplicidad y sello.
export interface ElementoEjercicio {
  id: number; nombre: string; descripcion: string | null; grupo: string | null;
  series: number; repeticiones: string; carga_kg: number; descanso_seg: number; completado: boolean;
}
export interface PorcionDia { nombre: string; cantidad: number; unidad: Unidad; alimento: Alimento | null }
export interface ElementoComida { id: number; tipo: TipoComida; completado: boolean; porciones: PorcionDia[] }
export interface DiaCliente {
  fecha: string;
  tieneProgramaVigente: boolean;
  rutina: string | null;
  plan: string | null;
  ejercicios: ElementoEjercicio[];
  comidas: ElementoComida[];
}

export async function cargarDia(): Promise<DiaCliente> {
  const { data, error } = await supabase.rpc("vista_del_dia");
  if (error) return fallo(error, "vista_dia");
  const d = data as any;
  const orden: TipoComida[] = ["DESAYUNO", "COLACION1", "COMIDA", "COLACION2", "CENA"];
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    fecha: d.fecha,
    tieneProgramaVigente: Boolean(d.tiene_programa),
    rutina: d.rutina ?? null,
    plan: d.plan ?? null,
    ejercicios: (d.ejercicios as any[]).map(e => ({
      id: e.id, nombre: e.nombre, descripcion: e.descripcion ?? null, grupo: e.grupo_muscular ?? null,
      series: e.series, repeticiones: e.repeticiones, carga_kg: Number(e.carga_kg), descanso_seg: e.descanso_seg,
      completado: Boolean(e.completado),
    })),
    comidas: (d.comidas as any[]).map(c => ({
      id: c.id, tipo: c.tipo, completado: Boolean(c.completado),
      porciones: (c.porciones as any[]).map(p => ({
        nombre: p.nombre, cantidad: Number(p.cantidad), unidad: p.unidad,
        alimento: p.alimento ? {
          ...p.alimento, kcal_100: Number(p.alimento.kcal_100), proteina_100: Number(p.alimento.proteina_100),
          carbohidratos_100: Number(p.alimento.carbohidratos_100), grasa_100: Number(p.alimento.grasa_100),
          gramos_por_pieza: num(p.alimento.gramos_por_pieza),
        } as Alimento : null,
      })),
    })).sort((a, b) => orden.indexOf(a.tipo) - orden.indexOf(b.tipo)),
  };
}

/** Marca o desmarca un elemento del día (RS-07) con la función del servidor. */
export async function marcarCumplimiento(
  elemento: { rutina_ejercicio_id: number } | { tiempo_comida_id: number }, completado: boolean,
): Promise<void> {
  const { error } = await supabase.rpc("marcar_cumplimiento", {
    p_rutina_ejercicio_id: "rutina_ejercicio_id" in elemento ? elemento.rutina_ejercicio_id : null,
    p_tiempo_comida_id: "tiempo_comida_id" in elemento ? elemento.tiempo_comida_id : null,
    p_completado: completado,
  });
  if (error) {
    if (error.code === "P0001") throw new Error(error.message);
    return fallo(error, "marcar_cumplimiento", "Solo puede registrar el cumplimiento del día en curso.");
  }
}

/** ¿El usuario CLIENTE ya tiene su fila de cliente (activó una invitación)? */
export async function clienteActivado(id: string): Promise<boolean> {
  const { data, error } = await supabase.from("cliente").select("usuario_id").eq("usuario_id", id).maybeSingle();
  if (error) return fallo(error, "cliente_activado");
  return data !== null;
}

export async function activarCodigo(token: string): Promise<void> {
  const { error } = await supabase.rpc("activar_invitacion", { p_token: token.trim() });
  if (error) throw new Error(error.message);
}

export type { Perfil };
