/**
 * presentacion/dom.ts — Utilidades de interfaz compartidas.
 * esc() es obligatorio para todo texto que venga del usuario o del servidor:
 * evita que un nombre como "<script>" se ejecute en el navegador de otro usuario.
 */

const MAPA: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (c) => MAPA[c]);
}

export function $<T extends HTMLElement = HTMLElement>(sel: string, raiz: ParentNode = document): T {
  const el = raiz.querySelector<T>(sel);
  if (!el) throw new Error(`Elemento no encontrado: ${sel}`);
  return el;
}

export function $$<T extends HTMLElement = HTMLElement>(sel: string, raiz: ParentNode = document): T[] {
  return Array.from(raiz.querySelectorAll<T>(sel));
}

/** Muestra (o limpia) mensajes de error junto al campo que los origina (ERS §3.1.1). */
export function mostrarErrores(el: HTMLElement, errores: string[]) {
  el.innerHTML = errores.map((e) => `<div>${esc(e)}</div>`).join("");
  el.hidden = errores.length === 0;
}

/** Confirmación explícita mediante ventana modal para acciones destructivas (ERS §3.1.1). */
export function confirmar(mensaje: string, textoAceptar = "Eliminar"): Promise<boolean> {
  return new Promise((resolver) => {
    const fondo = document.createElement("div");
    fondo.className = "modal-fondo";
    fondo.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-msg">
        <p id="modal-msg">${esc(mensaje)}</p>
        <div class="acciones">
          <button class="secundario" data-r="no">Cancelar</button>
          <button class="peligro" data-r="si">${esc(textoAceptar)}</button>
        </div>
      </div>`;
    const cerrar = (r: boolean) => { fondo.remove(); document.removeEventListener("keydown", tecla); resolver(r); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") cerrar(false); };
    fondo.addEventListener("click", (e) => {
      const r = (e.target as HTMLElement).dataset.r;
      if (r) cerrar(r === "si"); else if (e.target === fondo) cerrar(false);
    });
    document.addEventListener("keydown", tecla);
    document.body.appendChild(fondo);
    $<HTMLButtonElement>('[data-r="no"]', fondo).focus();
  });
}

export function aviso(mensaje: string, tipo: "ok" | "error" = "ok") {
  const t = document.createElement("div");
  t.className = `aviso aviso-${tipo}`;
  t.setAttribute("role", "status");
  t.textContent = mensaje;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), tipo === "error" ? 6000 : 3000);
}

export function cargando(cont: HTMLElement, texto = "Cargando…") {
  cont.innerHTML = `<p class="vacio">${esc(texto)}</p>`;
}

export function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function sumarDiasISO(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const f = new Date(Date.UTC(y, m - 1, d + dias));
  return f.toISOString().slice(0, 10);
}

export function fechaCorta(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

/** Deshabilita el botón mientras corre la acción, para evitar dobles envíos. */
export async function conBoton<T>(btn: HTMLButtonElement, accion: () => Promise<T>): Promise<T | undefined> {
  const texto = btn.textContent;
  btn.disabled = true; btn.textContent = "Guardando…";
  try { return await accion(); }
  finally { btn.disabled = false; btn.textContent = texto; }
}
