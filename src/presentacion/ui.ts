/**
 * presentacion/ui.ts — Utilidades de interfaz compartidas por las pantallas:
 * escape de HTML, modal de confirmación (ERS §3.1.1), avisos y encabezado.
 */
import type { Perfil } from "@/tipos";

/** Escapa texto capturado por usuarios antes de insertarlo en HTML. */
export function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export function $<T extends HTMLElement = HTMLElement>(raiz: ParentNode, sel: string): T {
  const el = raiz.querySelector<T>(sel);
  if (!el) throw new Error(`No se encontró ${sel}`);
  return el;
}

/** Ventana modal de confirmación para acciones destructivas. */
export function confirmar(mensaje: string, textoAceptar = "Eliminar"): Promise<boolean> {
  return new Promise(resolve => {
    const fondo = document.createElement("div");
    fondo.className = "modal-fondo";
    fondo.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-texto">
        <p id="modal-texto">${esc(mensaje)}</p>
        <div class="acciones">
          <button class="secundario" data-r="no">Cancelar</button>
          <button class="peligro" data-r="si">${esc(textoAceptar)}</button>
        </div>
      </div>`;
    const cerrar = (r: boolean) => { fondo.remove(); document.removeEventListener("keydown", tecla); resolve(r); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") cerrar(false); };
    fondo.addEventListener("click", e => {
      const r = (e.target as HTMLElement).dataset.r;
      if (r) cerrar(r === "si"); else if (e.target === fondo) cerrar(false);
    });
    document.addEventListener("keydown", tecla);
    document.body.appendChild(fondo);
    fondo.querySelector<HTMLButtonElement>("[data-r=no]")!.focus();
  });
}

/** Aviso breve en la parte inferior de la pantalla. */
export function avisar(texto: string, tipo: "ok" | "error" = "ok") {
  const a = document.createElement("div");
  a.className = `aviso aviso-${tipo}`;
  a.setAttribute("role", "status");
  a.textContent = texto;
  document.body.appendChild(a);
  setTimeout(() => a.remove(), tipo === "error" ? 6000 : 3000);
}

/** Lista de errores (formato RS-01) dentro de un contenedor. */
export function mostrarErrores(cont: HTMLElement, errores: string[]) {
  cont.innerHTML = errores.map(e => `<div>${esc(e)}</div>`).join("");
  cont.hidden = errores.length === 0;
  if (errores.length) cont.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

export const ETIQUETA_ROL: Record<Perfil["rol"], string> = {
  ADMIN: "Administrador", ENTRENADOR: "Entrenador", NUTRIOLOGO: "Nutriólogo", CLIENTE: "Cliente",
};

export const DIAS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/** Encabezado común con nombre, rol y botón de salir. Devuelve el contenedor de contenido. */
export function marco(raiz: HTMLElement, perfil: Perfil, alSalir: () => void, pestanas?: { id: string; texto: string }[], activa?: string, alCambiar?: (id: string) => void): HTMLElement {
  raiz.innerHTML = `
    <header class="encabezado">
      <div>
        <div class="marca">Constancia FitPlan</div>
        <div class="sub">${esc(perfil.nombre)} · ${ETIQUETA_ROL[perfil.rol]}</div>
      </div>
      <button class="secundario chico" id="salir">Salir</button>
    </header>
    ${pestanas ? `<nav class="pestanas">${pestanas.map(p =>
      `<button data-p="${p.id}" class="${p.id === activa ? "activa" : ""}">${esc(p.texto)}</button>`).join("")}</nav>` : ""}
    <main id="contenido"></main>`;
  $(raiz, "#salir").addEventListener("click", alSalir);
  raiz.querySelectorAll<HTMLButtonElement>(".pestanas button").forEach(b =>
    b.addEventListener("click", () => {
      raiz.querySelectorAll(".pestanas button").forEach(x => x.classList.toggle("activa", x === b));
      alCambiar?.(b.dataset.p!);
    }));
  return $(raiz, "#contenido");
}

export function cargando(cont: HTMLElement) {
  cont.innerHTML = `<p class="vacio">Cargando…</p>`;
}

export function formatoFecha(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}
