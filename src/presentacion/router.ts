/**
 * presentacion/router.ts — Dirige a cada rol a su pantalla de inicio (CU-01, RS-14).
 * El cliente llega a su Vista del Día sin pasos intermedios.
 * Las pantallas por rol se agregan en las iteraciones siguientes.
 */
import type { Perfil } from "@/tipos";
import { cerrarSesion } from "@/datos/sesion";

export function irAInicio(raiz: HTMLElement, perfil: Perfil, alSalir: () => void) {
  const titulo: Record<Perfil["rol"], string> = {
    CLIENTE: "Hoy", ENTRENADOR: "Panel del entrenador", NUTRIOLOGO: "Panel del nutriólogo", ADMIN: "Administración",
  };
  raiz.innerHTML = `
    <div class="tarjeta">
      <h2>${titulo[perfil.rol]}</h2>
      <p>Hola, ${perfil.nombre}. Sesión iniciada como <strong>${perfil.rol.toLowerCase()}</strong>.</p>
      <p class="vacio">Pantalla en construcción (iteración 2).</p>
      <button class="secundario" id="salir">Cerrar sesión</button>
    </div>`;
  raiz.querySelector("#salir")!.addEventListener("click", () => { void cerrarSesion().then(alSalir); });
}
