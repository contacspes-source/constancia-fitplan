/**
 * presentacion/clientes.ts — Cartera del instructor: panel de adherencia (RS-05),
 * asignaciones con fechas (RS-03, CU-04) e invitaciones de 72 h (RS-03, CU-03).
 * La usan el entrenador (asigna rutinas) y el nutriólogo (asigna planes).
 */
import {
  adherenciaCartera, crearAsignacion, crearInvitacion, eliminarAsignacion, eliminarInvitacion,
  fechaServidor, listarAsignaciones, listarClientes, listarInvitaciones, listarPlanes, listarRutinas,
  reemitirInvitacion, type AsignacionDetalle, type ClienteCartera, type Invitacion,
} from "@/datos/repositorios";
import { ordenarPorRiesgo, textoAdherencia, type Ventana } from "@/negocio/adherencia";
import { estaVigente, validarAsignacion } from "@/negocio/asignaciones";
import type { Asignacion, Perfil } from "@/tipos";
import { $, avisar, cargando, confirmar, esc, mostrarErrores } from "./ui";

let ventana: Ventana = 7;

export async function vistaClientes(cont: HTMLElement, perfil: Perfil) {
  cargando(cont);
  const esEntrenador = perfil.rol === "ENTRENADOR";
  try {
    const [clientes, asignaciones, invitaciones, programas, hoy] = await Promise.all([
      listarClientes(), listarAsignaciones(perfil.id), listarInvitaciones(),
      esEntrenador ? listarRutinas() : listarPlanes(), fechaServidor(),
    ]);
    cont.innerHTML = `
      <section class="tarjeta">
        <div class="fila-titulo">
          <h2>Adherencia</h2>
          <div class="segmentado" role="group" aria-label="Ventana">
            <button data-v="7" class="${ventana === 7 ? "activa" : ""}">7 días</button>
            <button data-v="30" class="${ventana === 30 ? "activa" : ""}">30 días</button>
          </div>
        </div>
        <p class="sub">De menor a mayor cumplimiento ${esEntrenador ? "del entrenamiento" : "de la alimentación"}: arriba están los clientes en riesgo. El total suma ejercicios y comidas (RS-05).</p>
        <div id="adherencia"><p class="vacio">Cargando…</p></div>
      </section>

      <section class="tarjeta">
        <h2>Asignar ${esEntrenador ? "rutina" : "plan alimenticio"}</h2>
        ${clientes.length === 0 ? `<p class="vacio">Primero invita a un cliente.</p>`
          : programas.length === 0 ? `<p class="vacio">Primero crea ${esEntrenador ? "una rutina" : "un plan"}.</p>` : `
        <form id="f-asig" novalidate>
          <label for="a-cliente">Cliente</label>
          <select id="a-cliente">${clientes.map(c => `<option value="${c.usuario_id}">${esc(c.nombre)}</option>`).join("")}</select>
          <label for="a-programa">${esEntrenador ? "Rutina" : "Plan"}</label>
          <select id="a-programa">${programas.map(p => `<option value="${p.id}">${esc(p.nombre)}</option>`).join("")}</select>
          <div class="rejilla">
            <div><label for="a-inicio">Fecha de inicio</label><input id="a-inicio" type="date" value="${hoy}" /></div>
            <div><label for="a-fin">Fecha de fin</label><input id="a-fin" type="date" /></div>
          </div>
          <div class="error" id="e-asig" hidden></div>
          <button type="submit">Asignar</button>
        </form>`}
      </section>

      <section>
        <h2>Mis clientes</h2>
        <div id="lista-clientes"></div>
      </section>

      <section class="tarjeta">
        <h2>Invitar cliente</h2>
        <form id="f-inv" novalidate>
          <div class="rejilla">
            <div><label for="i-nombre">Nombre</label><input id="i-nombre" maxlength="100" autocomplete="off" /></div>
            <div><label for="i-correo">Correo</label><input id="i-correo" type="email" maxlength="120" autocomplete="off" /></div>
          </div>
          <div class="error" id="e-inv" hidden></div>
          <button type="submit">Generar código (72 h)</button>
        </form>
        <div id="invitaciones"></div>
      </section>`;

    void pintarAdherencia(cont, perfil);
    cont.querySelectorAll<HTMLButtonElement>(".segmentado button").forEach(b => b.addEventListener("click", () => {
      ventana = Number(b.dataset.v) as Ventana;
      cont.querySelectorAll(".segmentado button").forEach(x => x.classList.toggle("activa", x === b));
      void pintarAdherencia(cont, perfil);
    }));

    pintarClientes(cont, perfil, clientes, asignaciones, hoy);
    pintarInvitaciones(cont, perfil, invitaciones);

    cont.querySelector<HTMLFormElement>("#f-asig")?.addEventListener("submit", async ev => {
      ev.preventDefault();
      const prog = Number($<HTMLSelectElement>(cont, "#a-programa").value);
      const nueva: Asignacion = {
        cliente_id: $<HTMLSelectElement>(cont, "#a-cliente").value, asignado_por: perfil.id,
        rutina_id: esEntrenador ? prog : null, plan_id: esEntrenador ? null : prog,
        fecha_inicio: $<HTMLInputElement>(cont, "#a-inicio").value, fecha_fin: $<HTMLInputElement>(cont, "#a-fin").value,
      };
      const res = validarAsignacion(nueva, asignaciones);
      const err = $(cont, "#e-asig");
      if (!res.ok) { mostrarErrores(err, res.errores); return; }
      mostrarErrores(err, []);
      try { await crearAsignacion(nueva); avisar("Asignación guardada."); void vistaClientes(cont, perfil); }
      catch (e) { mostrarErrores(err, [(e as Error).message]); }
    });

    $<HTMLFormElement>(cont, "#f-inv").addEventListener("submit", async ev => {
      ev.preventDefault();
      const nombre = $<HTMLInputElement>(cont, "#i-nombre").value.trim();
      const correo = $<HTMLInputElement>(cont, "#i-correo").value.trim();
      const errores: string[] = [];
      if (nombre.length < 2 || nombre.length > 100) errores.push("El nombre debe tener de 2 a 100 caracteres.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) errores.push("Capture un correo electrónico válido.");
      const err = $(cont, "#e-inv");
      mostrarErrores(err, errores);
      if (errores.length) return;
      try {
        await crearInvitacion(perfil.id, nombre, correo);
        avisar("Código generado. Compártelo con tu cliente.");
        pintarInvitaciones(cont, perfil, await listarInvitaciones());
        (ev.target as HTMLFormElement).reset();
      } catch (e) { mostrarErrores(err, [(e as Error).message]); }
    });
  } catch (e) { cont.innerHTML = `<p class="error">${esc((e as Error).message)}</p>`; }
}

type Area = { programados: number; completados: number; adherencia: number | null };

function nivel(a: number | null) { return a === null ? "nd" : a < 50 ? "baja" : a < 80 ? "media" : "alta"; }

function filaArea(titulo: string, a: Area, principal: boolean) {
  return `<div class="area ${principal ? "principal" : ""} nivel-${nivel(a.adherencia)}">
    <div class="fila-titulo"><span>${titulo}</span><strong>${textoAdherencia(a.adherencia)}</strong></div>
    <div class="barra"><span style="width:${a.adherencia ?? 0}%"></span></div>
    <div class="sub">${a.programados === 0 ? "Sin programa en la ventana" : `${a.completados} de ${a.programados} completados`}</div>
  </div>`;
}

async function pintarAdherencia(cont: HTMLElement, perfil: Perfil) {
  const caja = $(cont, "#adherencia");
  try {
    const datos = await adherenciaCartera(ventana);
    if (datos.length === 0) { caja.innerHTML = `<p class="vacio">Sin clientes todavía.</p>`; return; }
    const conDesglose = datos.some(c => c.entrenamiento.programados + c.alimentacion.programados > 0) || datos.every(c => c.programados === 0);
    const propia = perfil.rol === "ENTRENADOR" ? "entrenamiento" : "alimentacion";
    const otra = propia === "entrenamiento" ? "alimentacion" : "entrenamiento";
    const titulo = { entrenamiento: "🏋️ Entrenamiento", alimentacion: "🍽️ Alimentación" };
    // Se ordena por el área del instructor (la que él puede corregir); sin desglose, por el total de RS-05.
    const lista = conDesglose
      ? ordenarPorRiesgo(datos.map(c => ({ ...c, orden: c, adherencia: c[propia].adherencia }))).map(x => x.orden)
      : ordenarPorRiesgo(datos);
    caja.innerHTML = `<ul class="adherencia">${lista.map(c => `<li>
        <div class="fila-titulo"><strong>${esc(c.nombre)}</strong><span class="sub">Total: ${textoAdherencia(c.adherencia)}</span></div>
        ${conDesglose
          ? filaArea(titulo[propia], c[propia], true) + filaArea(titulo[otra], c[otra], false)
          : filaArea("Total (ejercicios + comidas)", c, true)}
      </li>`).join("")}</ul>`;
  } catch (e) { caja.innerHTML = `<p class="error">${esc((e as Error).message)}</p>`; }
}

function pintarClientes(cont: HTMLElement, perfil: Perfil, clientes: ClienteCartera[], asignaciones: AsignacionDetalle[], hoy: string) {
  const caja = $(cont, "#lista-clientes");
  if (clientes.length === 0) { caja.innerHTML = `<p class="vacio">Aún no tienes clientes. Invítalos abajo.</p>`; return; }
  caja.innerHTML = clientes.map(c => {
    const suyas = asignaciones.filter(a => a.cliente_id === c.usuario_id);
    return `<div class="tarjeta">
      <strong>${esc(c.nombre)}</strong> <span class="sub">${esc(c.correo)}</span>
      ${suyas.length === 0 ? `<p class="sub">Sin asignaciones.</p>` : `<ul class="asignaciones">${suyas.map(a => {
        const estado = estaVigente(a, hoy) ? "vigente" : a.fecha_fin < hoy ? "terminada" : "próxima";
        return `<li>
          <span class="etiqueta ${estado === "vigente" ? "ok" : ""}">${estado}</span>
          ${a.rutina_id ? "🏋️" : "🍽️"} ${esc(a.nombre_programa)} · ${a.fecha_inicio} → ${a.fecha_fin}
          ${a.propia ? `<button class="enlace peligro-txt" data-quitar-asig="${a.id}" data-nombre="${esc(a.nombre_programa)}">Quitar</button>` : ""}
        </li>`;
      }).join("")}</ul>`}
    </div>`;
  }).join("");
  caja.querySelectorAll<HTMLButtonElement>("[data-quitar-asig]").forEach(b => b.addEventListener("click", async () => {
    const ok = await confirmar(`¿Quitar la asignación '${b.dataset.nombre}'? Las marcas de cumplimiento ya registradas se conservan.`, "Quitar");
    if (!ok) return;
    try { await eliminarAsignacion(Number(b.dataset.quitarAsig)); avisar("Asignación eliminada."); void vistaClientes(cont, perfil); }
    catch (e) { avisar((e as Error).message, "error"); }
  }));
}

function enlaceActivacion(token: string): string {
  return `${location.origin}${location.pathname}#activar=${token}`;
}

function pintarInvitaciones(cont: HTMLElement, perfil: Perfil, invitaciones: Invitacion[]) {
  const caja = $(cont, "#invitaciones");
  const pendientes = invitaciones.filter(i => !i.usada_en);
  if (pendientes.length === 0) { caja.innerHTML = ""; return; }
  const ahora = Date.now();
  caja.innerHTML = `<h3>Invitaciones pendientes</h3>` + pendientes.map(i => {
    const caducada = new Date(i.expira_en).getTime() < ahora;
    return `<div class="invitacion ${caducada ? "caducada" : ""}">
      <div><strong>${esc(i.nombre)}</strong> <span class="sub">${esc(i.correo)}</span></div>
      <div class="sub">${caducada ? "Caducada" : "Vence " + new Date(i.expira_en).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</div>
      ${caducada ? "" : `<code class="codigo">${esc(i.token)}</code>`}
      <div class="acciones">
        ${caducada ? `<button class="chico" data-reemitir="${i.id}">Reemitir código</button>`
          : `<button class="secundario chico" data-copiar="${esc(enlaceActivacion(i.token))}">Copiar enlace</button>
             <button class="secundario chico" data-copiar="${esc(i.token)}">Copiar código</button>`}
        <button class="enlace peligro-txt" data-borrar="${i.id}" data-nombre="${esc(i.nombre)}">Cancelar</button>
      </div>
    </div>`;
  }).join("");
  caja.querySelectorAll<HTMLButtonElement>("[data-copiar]").forEach(b => b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(b.dataset.copiar!); avisar("Copiado."); }
    catch { avisar("No se pudo copiar; selecciónalo manualmente.", "error"); }
  }));
  caja.querySelectorAll<HTMLButtonElement>("[data-reemitir]").forEach(b => b.addEventListener("click", async () => {
    try { await reemitirInvitacion(Number(b.dataset.reemitir)); avisar("Nuevo código emitido (72 h)."); pintarInvitaciones(cont, perfil, await listarInvitaciones()); }
    catch (e) { avisar((e as Error).message, "error"); }
  }));
  caja.querySelectorAll<HTMLButtonElement>("[data-borrar]").forEach(b => b.addEventListener("click", async () => {
    if (!await confirmar(`¿Cancelar la invitación de '${b.dataset.nombre}'? El código dejará de funcionar.`, "Cancelar invitación")) return;
    try { await eliminarInvitacion(Number(b.dataset.borrar)); pintarInvitaciones(cont, perfil, await listarInvitaciones()); }
    catch (e) { avisar((e as Error).message, "error"); }
  }));
}
