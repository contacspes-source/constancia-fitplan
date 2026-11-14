/**
 * datos/sesion.ts — Autenticación y perfil del usuario actual (RS-10, CU-01).
 * Control de inactividad de 30 minutos (ERS §2.4): se cierra la sesión local.
 */
import { supabase } from "./supabase";
import type { Perfil, Rol } from "@/tipos";

export const INACTIVIDAD_MS = 30 * 60 * 1000;

export async function iniciarSesion(correo: string, contrasena: string): Promise<Perfil> {
  const { error } = await supabase.auth.signInWithPassword({ email: correo, password: contrasena });
  // RS-10: no se revela cuál de los dos datos falló.
  if (error) throw new Error("El correo o la contraseña no son válidos.");
  const perfil = await perfilActual();
  if (!perfil) throw new Error("La cuenta no tiene perfil. Contacte al administrador.");
  if (!perfil.activo) { await cerrarSesion(); throw new Error("La cuenta está desactivada."); }
  return perfil;
}

/** Registro de un instructor (entrenador o nutriólogo). Los clientes entran por invitación. */
export async function registrarInstructor(nombre: string, correo: string, contrasena: string, rol: Exclude<Rol, "ADMIN" | "CLIENTE">) {
  const { error } = await supabase.auth.signUp({ email: correo, password: contrasena, options: { data: { nombre, rol } } });
  if (error) throw new Error(error.message);
}

/** Registro de un cliente con su código de invitación (CU-12). */
export async function activarCuentaCliente(correo: string, contrasena: string, token: string) {
  const { error } = await supabase.auth.signUp({ email: correo, password: contrasena, options: { data: { rol: "CLIENTE" } } });
  if (error) throw new Error(error.message);
  const { error: e2 } = await supabase.rpc("activar_invitacion", { p_token: token });
  if (e2) throw new Error(e2.message);
}

export async function perfilActual(): Promise<Perfil | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("perfil").select("*").eq("id", user.id).single();
  return (data as Perfil) ?? null;
}

export async function cerrarSesion() {
  await supabase.auth.signOut();
}

/** Cierra la sesión tras INACTIVIDAD_MS sin interacción del usuario. */
export function vigilarInactividad(alExpirar: () => void) {
  let t: ReturnType<typeof setTimeout>;
  const reiniciar = () => { clearTimeout(t); t = setTimeout(() => { void cerrarSesion().then(alExpirar); }, INACTIVIDAD_MS); };
  ["click", "keydown", "touchstart", "scroll"].forEach(ev => window.addEventListener(ev, reiniciar, { passive: true }));
  reiniciar();
}
