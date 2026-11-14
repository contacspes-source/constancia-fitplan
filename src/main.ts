/** main.ts — Punto de entrada: con sesión → aplicación por rol; sin sesión → acceso. */
import { perfilActual, vigilarInactividad } from "@/datos/sesion";
import { renderAcceso } from "@/presentacion/acceso";
import { montarApp } from "@/presentacion/app";
import { aviso } from "@/presentacion/dom";
import type { Perfil } from "@/tipos";

const raiz = document.getElementById("app")!;

function entrar(p: Perfil) {
  montarApp(raiz, p, mostrarAcceso);
  vigilarInactividad(() => { aviso("Sesión cerrada por 30 minutos de inactividad."); mostrarAcceso(); });
}

function mostrarAcceso() {
  history.replaceState(null, "", location.pathname);
  renderAcceso(raiz, entrar);
}

async function arrancar() {
  const p = await perfilActual();
  if (p && p.activo) entrar(p); else mostrarAcceso();
}

void arrancar();
