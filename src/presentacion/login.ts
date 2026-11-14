/** presentacion/login.ts — Pantalla de inicio de sesión (CU-01). */
import { iniciarSesion } from "@/datos/sesion";
import type { Perfil } from "@/tipos";

export function renderLogin(raiz: HTMLElement, alEntrar: (p: Perfil) => void) {
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
    </div>`;
  const form = raiz.querySelector<HTMLFormElement>("#f-login")!;
  const err = raiz.querySelector<HTMLElement>("#login-error")!;
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    err.hidden = true;
    const correo = (raiz.querySelector<HTMLInputElement>("#correo")!).value.trim();
    const contrasena = (raiz.querySelector<HTMLInputElement>("#contrasena")!).value;
    try { alEntrar(await iniciarSesion(correo, contrasena)); }
    catch (e) { err.textContent = (e as Error).message; err.hidden = false; }
  });
}
