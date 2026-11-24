/** main.ts — Punto de entrada: sesión existente → inicio por rol; si no, login. */
import { perfilActual, vigilarInactividad } from "@/datos/sesion";
import { renderLogin } from "@/presentacion/login";
import { irAInicio } from "@/presentacion/router";

const raiz = document.getElementById("app")!;

function mostrarLogin() { renderLogin(raiz, (p) => irAInicio(raiz, p, mostrarLogin)); }

async function arrancar() {
  const p = await perfilActual();
  if (p) irAInicio(raiz, p, mostrarLogin); else mostrarLogin();
  vigilarInactividad(mostrarLogin);
}

void arrancar();
