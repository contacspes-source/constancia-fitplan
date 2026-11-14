/**
 * datos/clientes.ts — Cartera de clientes, invitaciones y asignaciones (RS-03, CU-02 a CU-04).
 * RLS limita cada consulta a los clientes del instructor que inició sesión.
 */
import { supabase } from "./supabase";
import { exigir, ErrorNegocio } from "./errores";
import type { Asignacion } from "@/tipos";
import { generarToken, calcularExpiracion } from "@/negocio/invitacion";
import { validarAsignacion } from "@/negocio/asignaciones";

export interface ClienteCartera { usuario_id: string; nombre: string; correo: string; objetivo: string | null;
  entrenador_id: string | null; nutriologo_id: string | null }

export interface Invitacion { id: number; nombre: string; correo: string; token: string; expira_en: string; usada_en: string | null }

export interface AsignacionVista extends Asignacion { programa: string | null }

const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function listarCartera(): Promise<ClienteCartera[]> {
  const filas = exigir(await supabase.from("cliente")
    .select("usuario_id, objetivo, entrenador_id, nutriologo_id, perfil:perfil!cliente_usuario_id_fkey(nombre, correo)"),
    "cargar la cartera de clientes") as any[];
  return filas.map((c) => ({ usuario_id: c.usuario_id, objetivo: c.objetivo, entrenador_id: c.entrenador_id,
    nutriologo_id: c.nutriologo_id, nombre: c.perfil?.nombre ?? "(sin nombre)", correo: c.perfil?.correo ?? "" }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export async function listarInvitacionesPendientes(): Promise<Invitacion[]> {
  return exigir(await supabase.from("invitacion").select("id, nombre, correo, token, expira_en, usada_en")
    .is("usada_en", null).order("expira_en", { ascending: false }), "cargar las invitaciones") as Invitacion[];
}

export function validarAltaCliente(nombre: string, correo: string): string[] {
  const errores: string[] = [];
  if (nombre.trim().length < 2) errores.push("Error de validación: El campo Nombre debe ser un texto de al menos 2 caracteres. Por favor corregir antes de guardar.");
  if (!RE_CORREO.test(correo.trim())) errores.push("Error de validación: El campo Correo debe ser un correo electrónico válido. Por favor corregir antes de guardar.");
  return errores;
}

export async function crearInvitacion(instructorId: string, nombre: string, correo: string): Promise<Invitacion> {
  const errores = validarAltaCliente(nombre, correo);
  if (errores.length) throw new ErrorNegocio(errores.join(" "));
  return exigir(await supabase.from("invitacion").insert({
    instructor_id: instructorId, nombre: nombre.trim(), correo: correo.trim().toLowerCase(),
    token: generarToken(), expira_en: calcularExpiracion().toISOString(),
  }).select("id, nombre, correo, token, expira_en, usada_en").single(), "generar la invitación") as Invitacion;
}

/** Reemite un código caducado: nuevo token y nueva vigencia de 72 h (RS-03). */
export async function reemitirInvitacion(id: number): Promise<Invitacion> {
  return exigir(await supabase.from("invitacion").update({ token: generarToken(), expira_en: calcularExpiracion().toISOString() })
    .eq("id", id).is("usada_en", null).select("id, nombre, correo, token, expira_en, usada_en").single(), "reemitir la invitación") as Invitacion;
}

export async function cancelarInvitacion(id: number): Promise<void> {
  exigir(await supabase.from("invitacion").delete().eq("id", id), "cancelar la invitación");
}

export async function listarAsignaciones(): Promise<AsignacionVista[]> {
  const filas = exigir(await supabase.from("asignacion")
    .select("id, cliente_id, asignado_por, rutina_id, plan_id, fecha_inicio, fecha_fin, rutina:rutina!asignacion_rutina_id_fkey(nombre), plan:plan_alimenticio!asignacion_plan_id_fkey(nombre)")
    .order("fecha_inicio", { ascending: false }), "cargar las asignaciones") as any[];
  return filas.map((a) => ({ id: a.id, cliente_id: a.cliente_id, asignado_por: a.asignado_por, rutina_id: a.rutina_id,
    plan_id: a.plan_id, fecha_inicio: a.fecha_inicio, fecha_fin: a.fecha_fin, programa: a.rutina?.nombre ?? a.plan?.nombre ?? null }));
}

/** Valida en negocio (mensaje inmediato) y guarda; el trigger del servidor repite la regla de no solape. */
export async function crearAsignacion(a: Asignacion, existentes: Asignacion[]): Promise<void> {
  const v = validarAsignacion(a, existentes);
  if (!v.ok) throw new ErrorNegocio(v.errores.join(" "));
  exigir(await supabase.from("asignacion").insert({ cliente_id: a.cliente_id, asignado_por: a.asignado_por,
    rutina_id: a.rutina_id, plan_id: a.plan_id, fecha_inicio: a.fecha_inicio, fecha_fin: a.fecha_fin }), "asignar el programa");
}

export async function eliminarAsignacion(id: number): Promise<void> {
  exigir(await supabase.from("asignacion").delete().eq("id", id), "eliminar la asignación");
}
