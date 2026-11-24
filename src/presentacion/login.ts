/** presentacion/login.ts — Inicio de sesión (CU-01), registro de instructor y activación de cliente (CU-12). */
import { activarCuentaCliente, iniciarSesion, perfilActual, registrarInstructor } from "@/datos/sesion";
import type { Perfil } from "@/tipos";
import { $, avisar, esc } from "./ui";

type AlEntrar = (p: Perfil) => void;

/** Lee el código de invitación del enlace (#activar=TOKEN). */
export function tokenDelEnlace(): string | null {
  const m = location.hash.match(/activar=([0-9a-f]{64})/i);
  return m ? m[1] : null;
}

export function renderLogin(raiz: HTMLElement, alEntrar: AlEntrar) {
  if (tokenDelEnlace()) return renderActivar(raiz, alEntrar);
  raiz.innerHTML = `
    <div class="tarjeta">
      <h1>Constancia FitPlan</h1>
      <form id="f-login" novalidate>
        <label for="correo">Correo</label>
        <input id="correo" type="email" autocomplete="username" required />
        <label for="contrasena">Contraseña</label>
        <input id="contrasena" type="password" autocomplete="current-password" required />
        <div class="error" id="login-error" hidden></div>
        <button type="submit">Entrar</button>
      </form>
    </div>
    <div class="enlaces">
      <button class="enlace" id="ir-activar">Tengo un código de invitación</button>
      <button class="enlace" id="ir-registro">Soy entrenador o nutriólogo: crear cuenta</button>
    </div>`;
  const form = $<HTMLFormElement>(raiz, "#f-login");
  const err = $(raiz, "#login-error");
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    err.hidden = true;
    const correo = $<HTMLInputElement>(raiz, "#correo").value.trim();
    const contrasena = $<HTMLInputElement>(raiz, "#contrasena").value;
    if (!correo || !contrasena) { err.textContent = "Capture su correo y contraseña."; err.hidden = false; return; }
    const btn = form.querySelector("button")!; btn.disabled = true;
    try { alEntrar(await iniciarSesion(correo, contrasena)); }
    catch (e) { err.textContent = (e as Error).message; err.hidden = false; btn.disabled = false; }
  });
  $(raiz, "#ir-activar").addEventListener("click", () => renderActivar(raiz, alEntrar));
  $(raiz, "#ir-registro").addEventListener("click", () => renderRegistro(raiz, alEntrar));
}

function validarCuenta(nombre: string | null, correo: string, contrasena: string, confirmacion: string): string[] {
  const e: string[] = [];
  if (nombre !== null && (nombre.length < 2 || nombre.length > 100)) e.push("El nombre debe tener de 2 a 100 caracteres.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) e.push("Capture un correo electrónico válido.");
  if (contrasena.length < 8) e.push("La contraseña debe tener al menos 8 caracteres.");
  if (contrasena !== confirmacion) e.push("Las contraseñas no coinciden.");
  return e;
}

function renderRegistro(raiz: HTMLElement, alEntrar: AlEntrar) {
  raiz.innerHTML = `
    <div class="tarjeta">
      <h2>Crear cuenta de instructor</h2>
      <form id="f-reg" novalidate>
        <label for="nombre">Nombre completo</label>
        <input id="nombre" autocomplete="name" maxlength="100" />
        <label for="rol">Soy</label>
        <select id="rol"><option value="ENTRENADOR">Entrenador</option><option value="NUTRIOLOGO">Nutriólogo</option></select>
        <label for="correo">Correo</label>
        <input id="correo" type="email" autocomplete="username" />
        <label for="contrasena">Contraseña (mínimo 8 caracteres)</label>
        <input id="contrasena" type="password" autocomplete="new-password" />
        <label for="confirmacion">Confirmar contraseña</label>
        <input id="confirmacion" type="password" autocomplete="new-password" />
        <div class="error" id="reg-error" hidden></div>
        <button type="submit">Crear cuenta</button>
      </form>
    </div>
    <div class="enlaces"><button class="enlace" id="volver">Ya tengo cuenta: iniciar sesión</button></div>`;
  $(raiz, "#volver").addEventListener("click", () => renderLogin(raiz, alEntrar));
  const err = $(raiz, "#reg-error");
  $<HTMLFormElement>(raiz, "#f-reg").addEventListener("submit", async ev => {
    ev.preventDefault();
    const v = (id: string) => $<HTMLInputElement>(raiz, id).value;
    const nombre = v("#nombre").trim(), correo = v("#correo").trim(), contrasena = v("#contrasena");
    const errores = validarCuenta(nombre, correo, contrasena, v("#confirmacion"));
    if (errores.length) { err.innerHTML = errores.map(esc).join("<br>"); err.hidden = false; return; }
    err.hidden = true;
    const btn = (ev.target as HTMLFormElement).querySelector("button")!; btn.disabled = true;
    try {
      const conSesion = await registrarInstructor(nombre, correo, contrasena, v("#rol") as "ENTRENADOR" | "NUTRIOLOGO");
      if (conSesion) { const p = await perfilActual(); if (p) return alEntrar(p); }
      raiz.innerHTML = `<div class="tarjeta"><h2>Revise su correo</h2>
        <p>Enviamos un enlace de confirmación a <strong>${esc(correo)}</strong>. Después de confirmarlo, inicie sesión.</p>
        <button id="ok">Ir a iniciar sesión</button></div>`;
      $(raiz, "#ok").addEventListener("click", () => renderLogin(raiz, alEntrar));
    } catch (e) { err.textContent = (e as Error).message; err.hidden = false; btn.disabled = false; }
  });
}

function renderActivar(raiz: HTMLElement, alEntrar: AlEntrar) {
  const token = tokenDelEnlace() ?? "";
  raiz.innerHTML = `
    <div class="tarjeta">
      <h2>Activar mi cuenta</h2>
      <p class="ayuda">Use el mismo correo al que su entrenador o nutriólogo emitió la invitación. El código vence a las 72 horas.</p>
      <form id="f-act" novalidate>
        <label for="token">Código de invitación</label>
        <input id="token" value="${esc(token)}" autocomplete="off" spellcheck="false" />
        <label for="correo">Correo</label>
        <input id="correo" type="email" autocomplete="username" />
        <label for="contrasena">Crea una contraseña (mínimo 8 caracteres)</label>
        <input id="contrasena" type="password" autocomplete="new-password" />
        <label for="confirmacion">Confirmar contraseña</label>
        <input id="confirmacion" type="password" autocomplete="new-password" />
        <div class="error" id="act-error" hidden></div>
        <button type="submit">Activar cuenta</button>
      </form>
      <p class="ayuda">¿Ya tienes cuenta y te invitó otro instructor? Inicia sesión y captura el código en tu pantalla de Hoy.</p>
    </div>
    <div class="enlaces"><button class="enlace" id="volver">Ya tengo cuenta: iniciar sesión</button></div>`;
  $(raiz, "#volver").addEventListener("click", () => { history.replaceState(null, "", location.pathname); renderLogin(raiz, alEntrar); });
  const err = $(raiz, "#act-error");
  $<HTMLFormElement>(raiz, "#f-act").addEventListener("submit", async ev => {
    ev.preventDefault();
    const v = (id: string) => $<HTMLInputElement>(raiz, id).value;
    const tok = v("#token").trim(), correo = v("#correo").trim(), contrasena = v("#contrasena");
    const errores = validarCuenta(null, correo, contrasena, v("#confirmacion"));
    if (!/^[0-9a-f]{64}$/i.test(tok)) errores.unshift("El código de invitación debe tener 64 caracteres (letras a-f y números).");
    if (errores.length) { err.innerHTML = errores.map(esc).join("<br>"); err.hidden = false; return; }
    err.hidden = true;
    const btn = (ev.target as HTMLFormElement).querySelector("button")!; btn.disabled = true;
    try {
      const conSesion = await activarCuentaCliente(correo, contrasena, tok);
      history.replaceState(null, "", location.pathname);
      if (conSesion) { const p = await perfilActual(); if (p) return alEntrar(p); }
      raiz.innerHTML = `<div class="tarjeta"><h2>Revisa tu correo</h2>
        <p>Confirma tu cuenta con el enlace que enviamos a <strong>${esc(correo)}</strong>. Después inicia sesión y captura este código en la pantalla de Hoy:</p>
        <code class="codigo">${esc(tok)}</code>
        <button id="ok">Ir a iniciar sesión</button></div>`;
      $(raiz, "#ok").addEventListener("click", () => renderLogin(raiz, alEntrar));
    } catch (e) {
      // La cuenta pudo crearse aunque el código fallara: entra y reintenta desde Hoy.
      const p = await perfilActual().catch(() => null);
      if (p) { history.replaceState(null, "", location.pathname); avisar((e as Error).message, "error"); return alEntrar(p); }
      err.textContent = (e as Error).message; err.hidden = false; btn.disabled = false;
    }
  });
}
