/**
 * presentacion/acceso.ts — Entrada al sistema (CU-01 iniciar sesión, CU-12 activar cuenta)
 * y registro de instructores. Tres pestañas en una sola pantalla.
 */
import { activarCuentaCliente, iniciarSesion, registrarInstructor, MIN_CONTRASENA } from "@/datos/sesion";
import type { Perfil } from "@/tipos";
import { $, $$, conBoton, esc, mostrarErrores } from "./dom";

type Pestana = "entrar" | "registro" | "codigo";

export function renderAcceso(raiz: HTMLElement, alEntrar: (p: Perfil) => void, inicial: Pestana = "entrar") {
  raiz.innerHTML = `
    <div class="acceso">
      <h1 class="marca">Constancia <span>FitPlan</span></h1>
      <p class="sub">Rutinas y alimentación, en un solo lugar.</p>
      <div class="pestanas" role="tablist">
        <button role="tab" data-p="entrar">Entrar</button>
        <button role="tab" data-p="codigo">Tengo un código</button>
        <button role="tab" data-p="registro">Soy instructor</button>
      </div>
      <div class="tarjeta" id="panel-acceso"></div>
    </div>`;

  const panel = $("#panel-acceso", raiz);
  const mostrar = (p: Pestana) => {
    $$("[data-p]", raiz).forEach((b) => b.setAttribute("aria-selected", String(b.dataset.p === p)));
    if (p === "entrar") formEntrar(panel, alEntrar);
    else if (p === "registro") formRegistro(panel, alEntrar);
    else formCodigo(panel, alEntrar);
  };
  $$("[data-p]", raiz).forEach((b) => b.addEventListener("click", () => mostrar(b.dataset.p as Pestana)));
  mostrar(inicial);
}

function campo(id: string, etiqueta: string, tipo = "text", extra = "") {
  return `<label for="${id}">${esc(etiqueta)}</label><input id="${id}" type="${tipo}" ${extra} />`;
}

function enviar(form: HTMLFormElement, accion: () => Promise<Perfil>, alEntrar: (p: Perfil) => void) {
  const err = $("[data-err]", form);
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    mostrarErrores(err, []);
    try { const p = await conBoton($<HTMLButtonElement>("button[type=submit]", form), accion); if (p) alEntrar(p); }
    catch (e) { mostrarErrores(err, [(e as Error).message]); }
  });
}

const valor = (f: HTMLElement, id: string) => $<HTMLInputElement>(`#${id}`, f).value;

function formEntrar(panel: HTMLElement, alEntrar: (p: Perfil) => void) {
  panel.innerHTML = `
    <form novalidate>
      ${campo("correo", "Correo", "email", 'autocomplete="username" required')}
      ${campo("contrasena", "Contraseña", "password", 'autocomplete="current-password" required')}
      <div class="error" data-err hidden></div>
      <button type="submit">Entrar</button>
    </form>`;
  const f = $<HTMLFormElement>("form", panel);
  enviar(f, () => iniciarSesion(valor(f, "correo"), valor(f, "contrasena")), alEntrar);
}

function formRegistro(panel: HTMLElement, alEntrar: (p: Perfil) => void) {
  panel.innerHTML = `
    <form novalidate>
      <p class="ayuda">Para entrenadores y nutriólogos. Tus clientes entran con el código que les generes.</p>
      ${campo("nombre", "Nombre completo", "text", 'autocomplete="name" required')}
      <label for="rol">Soy</label>
      <select id="rol"><option value="ENTRENADOR">Entrenador</option><option value="NUTRIOLOGO">Nutriólogo</option></select>
      ${campo("correo", "Correo", "email", 'autocomplete="email" required')}
      ${campo("contrasena", `Contraseña (mínimo ${MIN_CONTRASENA} caracteres)`, "password", 'autocomplete="new-password" required')}
      <div class="error" data-err hidden></div>
      <button type="submit">Crear cuenta</button>
    </form>`;
  const f = $<HTMLFormElement>("form", panel);
  enviar(f, () => registrarInstructor(valor(f, "nombre"), valor(f, "correo"), valor(f, "contrasena"),
    $<HTMLSelectElement>("#rol", f).value as "ENTRENADOR" | "NUTRIOLOGO"), alEntrar);
}

function formCodigo(panel: HTMLElement, alEntrar: (p: Perfil) => void) {
  panel.innerHTML = `
    <form novalidate>
      <p class="ayuda">Usa el correo con el que te registró tu instructor. Si ya tienes cuenta, escribe tu contraseña actual.</p>
      ${campo("codigo", "Código de invitación", "text", 'autocomplete="off" spellcheck="false" required')}
      ${campo("correo", "Correo", "email", 'autocomplete="email" required')}
      ${campo("contrasena", `Contraseña (mínimo ${MIN_CONTRASENA} caracteres)`, "password", 'autocomplete="new-password" required')}
      <div class="error" data-err hidden></div>
      <button type="submit">Activar cuenta</button>
    </form>`;
  const f = $<HTMLFormElement>("form", panel);
  enviar(f, () => activarCuentaCliente(valor(f, "correo"), valor(f, "contrasena"), valor(f, "codigo")), alEntrar);
}
