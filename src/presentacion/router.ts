/**
 * presentacion/router.ts — Dirige a cada rol a su pantalla de inicio (CU-01, RS-14).
 * El cliente llega a su Vista del Día sin pasos intermedios (0 clics tras entrar).
 */
import type { Perfil } from "@/tipos";
import { cerrarSesion } from "@/datos/sesion";
import { vistaClientes } from "./clientes";
import { vistaHoy } from "./hoy";
import { vistaPlanes } from "./planes";
import { vistaRutinas } from "./rutinas";
import { esc, marco } from "./ui";

export function irAInicio(raiz: HTMLElement, perfil: Perfil, alSalir: () => void) {
  const salir = () => { void cerrarSesion().then(alSalir); };

  if (perfil.rol === "CLIENTE") {
    void vistaHoy(marco(raiz, perfil, salir), perfil);
    return;
  }

  if (perfil.rol === "ADMIN") {
    // ADR-004: la interfaz del Administrador queda fuera de la v1.0 (catálogos por SQL).
    marco(raiz, perfil, salir).innerHTML = `
      <div class="tarjeta"><h2>Administración</h2>
      <p>Hola, ${esc(perfil.nombre)}. En la versión 1.0 los catálogos de ejercicios y alimentos se mantienen
      desde el SQL Editor de Supabase (ver <code>docs/DECISIONES.md</code>, ADR-004).</p></div>`;
    return;
  }

  const programas = perfil.rol === "ENTRENADOR"
    ? { id: "programas", texto: "Rutinas", vista: vistaRutinas }
    : { id: "programas", texto: "Planes", vista: vistaPlanes };
  const pestanas = [{ id: "clientes", texto: "Clientes" }, { id: programas.id, texto: programas.texto }];
  const abrir = (id: string) => {
    const cont = raiz.querySelector<HTMLElement>("#contenido")!;
    void (id === "clientes" ? vistaClientes(cont, perfil) : programas.vista(cont, perfil));
  };
  marco(raiz, perfil, salir, pestanas, "clientes", abrir);
  abrir("clientes");
}
