/**
 * presentacion/app.ts — Armazón de la aplicación: encabezado, navegación por rol
 * y enrutamiento por hash (#/rutinas, #/planes/3, …).
 * La navegación oculta lo que el rol no usa, pero NO es la seguridad: el servidor
 * (RLS) rechaza cualquier operación no permitida aunque se escriba la URL a mano.
 */
import type { Perfil, Rol } from "@/tipos";
import { cerrarSesion } from "@/datos/sesion";
import { $, esc } from "./dom";
import { pantallaRutinas } from "./rutinas";
import { pantallaPlanes } from "./planes";
import { pantallaClientes } from "./clientes";
import { pantallaHoy } from "./hoy";
import { pantallaAdherencia } from "./adherencia";

export interface Contexto { perfil: Perfil; cont: HTMLElement; params: string[] }
type Pantalla = (ctx: Contexto) => Promise<void> | void;

interface Ruta { clave: string; etiqueta: string; pantalla: Pantalla }

const pantallaPendiente = (titulo: string, texto: string): Pantalla => ({ cont }) => {
  cont.innerHTML = `<div class="tarjeta"><h2>${esc(titulo)}</h2><p class="vacio">${esc(texto)}</p></div>`;
};

const RUTAS: Record<Rol, Ruta[]> = {
  ENTRENADOR: [
    { clave: "rutinas", etiqueta: "Rutinas", pantalla: pantallaRutinas },
    { clave: "clientes", etiqueta: "Clientes", pantalla: pantallaClientes },
    { clave: "adherencia", etiqueta: "Adherencia", pantalla: pantallaAdherencia },
  ],
  NUTRIOLOGO: [
    { clave: "planes", etiqueta: "Planes", pantalla: pantallaPlanes },
    { clave: "clientes", etiqueta: "Clientes", pantalla: pantallaClientes },
    { clave: "adherencia", etiqueta: "Adherencia", pantalla: pantallaAdherencia },
  ],
  CLIENTE: [
    { clave: "hoy", etiqueta: "Hoy", pantalla: pantallaHoy },
  ],
  ADMIN: [
    { clave: "admin", etiqueta: "Administración", pantalla: pantallaPendiente("Administración", "Los catálogos se administran desde la base de datos en esta versión.") },
  ],
};

const NOMBRE_ROL: Record<Rol, string> = { ENTRENADOR: "Entrenador", NUTRIOLOGO: "Nutriólogo", CLIENTE: "Cliente", ADMIN: "Administrador" };

let alHash: (() => void) | null = null;

export function montarApp(raiz: HTMLElement, perfil: Perfil, alSalir: () => void) {
  const rutas = RUTAS[perfil.rol];
  raiz.innerHTML = `
    <header class="barra">
      <div class="marca-mini">Constancia <span>FitPlan</span></div>
      <nav class="nav">${rutas.map((r) => `<a href="#/${r.clave}" data-r="${r.clave}">${esc(r.etiqueta)}</a>`).join("")}</nav>
      <div class="usuario">
        <span title="${esc(perfil.correo)}">${esc(perfil.nombre)} · ${NOMBRE_ROL[perfil.rol]}</span>
        <button class="secundario chico" id="salir">Salir</button>
      </div>
    </header>
    <main id="vista"></main>`;

  $("#salir", raiz).addEventListener("click", async () => {
    await cerrarSesion();
    desmontar();
    alSalir();
  });

  const vista = $("#vista", raiz);
  const navegar = async () => {
    const partes = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    let ruta = rutas.find((r) => r.clave === partes[0]);
    if (!ruta) { ruta = rutas[0]; history.replaceState(null, "", `#/${ruta.clave}`); }
    raiz.querySelectorAll<HTMLElement>("[data-r]").forEach((a) => a.classList.toggle("activa", a.dataset.r === ruta!.clave));
    try { await ruta.pantalla({ perfil, cont: vista, params: partes.slice(1) }); }
    catch (e) { vista.innerHTML = `<div class="tarjeta"><p class="error">${esc((e as Error).message)}</p></div>`; }
    window.scrollTo(0, 0);
  };

  desmontar();
  alHash = () => { void navegar(); };
  window.addEventListener("hashchange", alHash);
  void navegar();
}

function desmontar() {
  if (alHash) window.removeEventListener("hashchange", alHash);
  alHash = null;
}

export function ir(ruta: string) { location.hash = `#/${ruta}`; }
