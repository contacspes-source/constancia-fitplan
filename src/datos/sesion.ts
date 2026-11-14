/**
 * datos/sesion.ts — Autenticación y perfil del usuario actual (RS-10, CU-01, CU-12).
 * Control de inactividad de 30 minutos (ERS §2.4): se cierra la sesión.
 */
import { supabase } from "./supabase";
import type { Perfil, Rol } from "@/tipos";
import { esTokenValido } from "@/negocio/invitacion";

export const INACTIVIDAD_MS = 30 * 60 * 1000;
export const MIN_CONTRASENA = 8;

export async function iniciarSesion(correo: string, contrasena: string): Promise<Perfil> {
  const { error } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: contrasena });
  if (error) {
    // RS-10: al usuario no se le revela cuál de los dos datos falló. El detalle
    // técnico queda en la consola para el equipo de desarrollo (defecto D6).
    console.warn("[auth] inicio de sesión rechazado:", error.message);
    throw new Error("El correo o la contraseña no son válidos.");
  }
  const perfil = await perfilActual();
  if (!perfil) throw new Error("La cuenta no tiene perfil. Contacte al administrador.");
  if (!perfil.activo) { await cerrarSesion(); throw new Error("La cuenta está desactivada."); }
  return perfil;
}

/**
 * Traduce los errores de Supabase Auth que puede ver el usuario. Los demás se
 * muestran genéricos y el detalle queda en consola (RS-10).
 */
function errorAuth(e: { code?: string; message: string }): Error {
  console.warn("[auth]", e.code ?? "", e.message);
  switch (e.code) {
    case "over_email_send_rate_limit":
      return new Error("Se alcanzó el límite de correos del servidor. Intente de nuevo en unos minutos o avise al administrador (revisar que la confirmación de correo esté desactivada).");
    case "email_not_confirmed":
      return new Error("La cuenta existe pero su correo no está confirmado. Avise a su instructor o al administrador.");
    case "weak_password":
      return new Error(`Error de validación: El campo Contraseña debe ser más segura (mínimo ${MIN_CONTRASENA} caracteres). Por favor corregir antes de guardar.`);
    case "user_already_exists":
      return new Error("Ya existe una cuenta con ese correo. Inicie sesión.");
    case "email_provider_disabled":
    case "signup_disabled":
      return new Error("El registro está deshabilitado temporalmente. Avise al administrador.");
    default:
      return new Error("No se pudo completar la operación. Intente de nuevo.");
  }
}

const yaRegistrado = (e: { code?: string; message: string }) => e.code === "user_already_exists" || /registered/i.test(e.message);

function validarCredenciales(correo: string, contrasena: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo.trim())) throw new Error("Error de validación: El campo Correo debe ser un correo electrónico válido. Por favor corregir antes de guardar.");
  if (contrasena.length < MIN_CONTRASENA) throw new Error(`Error de validación: El campo Contraseña debe ser de al menos ${MIN_CONTRASENA} caracteres. Por favor corregir antes de guardar.`);
}

/** Registro de un instructor (entrenador o nutriólogo). Los clientes entran por invitación. */
export async function registrarInstructor(nombre: string, correo: string, contrasena: string, rol: Exclude<Rol, "ADMIN" | "CLIENTE">): Promise<Perfil> {
  if (nombre.trim().length < 2) throw new Error("Error de validación: El campo Nombre debe ser un texto de al menos 2 caracteres. Por favor corregir antes de guardar.");
  validarCredenciales(correo, contrasena);
  const { data, error } = await supabase.auth.signUp({ email: correo.trim(), password: contrasena, options: { data: { nombre: nombre.trim(), rol } } });
  if (error) throw errorAuth(error);
  if (!data.session) throw new Error("Cuenta creada. Revise su correo para confirmarla antes de entrar.");
  const p = await perfilActual();
  if (!p) throw new Error("La cuenta se creó pero no tiene perfil. Contacte al administrador.");
  return p;
}

/**
 * Activación de cuenta del cliente con su código (CU-12).
 * Si el cliente ya tiene cuenta (lo invitó antes otro instructor), inicia sesión
 * con ella y canjea el nuevo código, en vez de crear una segunda cuenta.
 */
export async function activarCuentaCliente(correo: string, contrasena: string, token: string): Promise<Perfil> {
  validarCredenciales(correo, contrasena);
  if (!esTokenValido(token)) throw new Error("Error de validación: El campo Código de invitación debe ser el código de 64 caracteres que le dio su instructor. Por favor corregir antes de guardar.");
  const alta = await supabase.auth.signUp({ email: correo.trim(), password: contrasena, options: { data: { rol: "CLIENTE" } } });
  if (alta.error) {
    if (!yaRegistrado(alta.error)) throw errorAuth(alta.error);
    const { error } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: contrasena });
    if (error) throw error.code === "email_not_confirmed" ? errorAuth(error) : new Error("Ya existe una cuenta con ese correo y la contraseña no coincide.");
  } else if (!alta.data.session) {
    throw new Error("Cuenta creada. Revise su correo para confirmarla y vuelva a canjear el código.");
  }
  const { error } = await supabase.rpc("activar_invitacion", { p_token: token.trim() });
  if (error) { await cerrarSesion(); throw new Error(error.message); }
  const p = await perfilActual();
  if (!p) throw new Error("No se pudo cargar el perfil.");
  return p;
}

export async function perfilActual(): Promise<Perfil | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data } = await supabase.from("perfil").select("*").eq("id", session.user.id).maybeSingle();
  return (data as Perfil) ?? null;
}

export async function cerrarSesion() {
  await supabase.auth.signOut();
}

let temporizador: ReturnType<typeof setTimeout> | undefined;
let vigilando = false;

/** Cierra la sesión tras INACTIVIDAD_MS sin interacción del usuario. */
export function vigilarInactividad(alExpirar: () => void) {
  const reiniciar = () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(async () => {
      if (await perfilActual()) { await cerrarSesion(); alExpirar(); }
    }, INACTIVIDAD_MS);
  };
  if (!vigilando) {
    ["click", "keydown", "touchstart", "scroll"].forEach((ev) => window.addEventListener(ev, reiniciar, { passive: true }));
    vigilando = true;
  }
  reiniciar();
}
