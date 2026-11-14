/**
 * presentacion/clientes.ts — Cartera, invitaciones y asignaciones del instructor
 * (RS-03, CU-02 gestionar cartera, CU-03 código de invitación, CU-04 asignar programa).
 * El entrenador asigna rutinas; el nutriólogo, planes (Act. 12, actor Instructor).
 */
import type { Asignacion } from "@/tipos";
import {
  cancelarInvitacion, crearAsignacion, crearInvitacion, eliminarAsignacion, listarAsignaciones,
  listarCartera, listarInvitacionesPendientes, reemitirInvitacion, validarAltaCliente,
  type AsignacionVista, type ClienteCartera, type Invitacion,
} from "@/datos/clientes";
import { listarRutinas } from "@/datos/rutinas";
import { listarPlanes } from "@/datos/planes";
import { estadoInvitacion, VIGENCIA_HORAS } from "@/negocio/invitacion";
import { estaVigente } from "@/negocio/asignaciones";
import type { Contexto } from "./app";
import { $, $$, aviso, cargando, conBoton, confirmar, esc, fechaCorta, hoyISO, mostrarErrores, sumarDiasISO } from "./dom";

interface Estado {
  cartera: ClienteCartera[];
  invitaciones: Invitacion[];
  asignaciones: AsignacionVista[];
  programas: { id: number; nombre: string }[];
}

export async function pantallaClientes(ctx: Contexto) {
  cargando(ctx.cont);
  const esEntrenador = ctx.perfil.rol === "ENTRENADOR";
  const [cartera, invitaciones, asignaciones, programas] = await Promise.all([
    listarCartera(), listarInvitacionesPendientes(), listarAsignaciones(),
    esEntrenador ? listarRutinas() : listarPlanes(),
  ]);
  render(ctx, { cartera, invitaciones, asignaciones, programas });
}

function render(ctx: Contexto, st: Estado) {
  const { cont, perfil } = ctx;
  const esEntrenador = perfil.rol === "ENTRENADOR";
  const tipoProg = esEntrenador ? "rutina" : "plan";
  const hoy = hoyISO();

  cont.innerHTML = `
    <div class="encabezado"><h2>Mis clientes</h2></div>

    <details class="tarjeta" id="invitar" ${st.cartera.length === 0 ? "open" : ""}>
      <summary><strong>+ Registrar cliente</strong></summary>
      <form novalidate id="f-invitar">
        <p class="ayuda">Se genera un código de invitación válido por ${VIGENCIA_HORAS} horas. El cliente lo canjea en la pestaña "Tengo un código".</p>
        <label for="inv-nombre">Nombre</label><input id="inv-nombre" autocomplete="off" />
        <label for="inv-correo">Correo</label><input id="inv-correo" type="email" autocomplete="off" />
        <div class="error" data-err hidden></div>
        <button type="submit">Generar código</button>
      </form>
      <div id="codigo-generado"></div>
    </details>

    ${st.invitaciones.length ? `
      <h3>Invitaciones pendientes</h3>
      ${st.invitaciones.map((i) => {
        const estado = estadoInvitacion(i);
        return `
        <div class="tarjeta fila-lista">
          <div>
            <strong>${esc(i.nombre)}</strong> <span class="meta">${esc(i.correo)}</span>
            <div class="meta">${estado === "CADUCADA" ? `<span class="etiqueta alerta">Caducada</span>` : `Vence ${new Date(i.expira_en).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}`}</div>
            ${estado === "VIGENTE" ? `<code class="token">${esc(i.token)}</code>` : ""}
          </div>
          <div class="acciones">
            ${estado === "VIGENTE" ? `<button class="secundario chico" data-copiar="${esc(i.token)}">Copiar código</button>` : ""}
            <button class="secundario chico" data-reemitir="${i.id}">Reemitir</button>
            <button class="peligro chico" data-cancelar="${i.id}" data-nombre="${esc(i.nombre)}">Cancelar</button>
          </div>
        </div>`;
      }).join("")}` : ""}

    <h3>Cartera (${st.cartera.length})</h3>
    ${st.cartera.length === 0 ? `<div class="tarjeta vacio">Cuando un cliente canjee su código aparecerá aquí.</div>` : ""}
    ${st.cartera.map((c) => {
      const propias = st.asignaciones.filter((a) => a.cliente_id === c.usuario_id);
      return `
      <div class="tarjeta" data-cliente="${esc(c.usuario_id)}">
        <div class="fila-lista">
          <div><strong>${esc(c.nombre)}</strong> <span class="meta">${esc(c.correo)}</span></div>
          <button class="chico" data-abrir-asignar>Asignar ${tipoProg}</button>
        </div>
        ${propias.length ? `<ul class="asignaciones">${propias.map((a) => {
          const esMia = esEntrenador ? a.rutina_id !== null : a.plan_id !== null;
          const vigente = estaVigente(a, hoy);
          const nombre = a.programa ?? (a.rutina_id !== null ? "Rutina de su entrenador" : "Plan de su nutriólogo");
          return `<li>
            <span class="etiqueta ${vigente ? "ok" : ""}">${vigente ? "Vigente" : a.fecha_inicio > hoy ? "Programada" : "Concluida"}</span>
            ${a.rutina_id !== null ? "🏋️" : "🥗"} ${esc(nombre)}
            <span class="meta">${fechaCorta(a.fecha_inicio)} – ${fechaCorta(a.fecha_fin)}</span>
            ${esMia ? `<button class="enlace" data-quitar-asig="${a.id}" data-nombre="${esc(nombre)}">quitar</button>` : ""}
          </li>`;
        }).join("")}</ul>` : `<p class="meta">Sin programas asignados.</p>`}
        <form novalidate class="f-asignar" hidden>
          ${st.programas.length === 0
            ? `<p class="ayuda">Primero crea una ${tipoProg} en la pestaña ${esEntrenador ? "Rutinas" : "Planes"}.</p>`
            : `<label>${esEntrenador ? "Rutina" : "Plan"}<select data-c="programa">${st.programas.map((p) => `<option value="${p.id}">${esc(p.nombre)}</option>`).join("")}</select></label>
               <div class="rejilla">
                 <label>Fecha de inicio<input type="date" data-c="inicio" value="${hoy}" /></label>
                 <label>Fecha de fin<input type="date" data-c="fin" value="${sumarDiasISO(hoy, 27)}" /></label>
               </div>
               <div class="error" data-err hidden></div>
               <button type="submit">Guardar asignación</button>`}
        </form>
      </div>`;
    }).join("")}`;

  // ---- Registrar cliente (CU-02 + CU-03)
  const fInv = $<HTMLFormElement>("#f-invitar", cont);
  fInv.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const nombre = $<HTMLInputElement>("#inv-nombre", fInv).value, correo = $<HTMLInputElement>("#inv-correo", fInv).value;
    const err = $("[data-err]", fInv);
    const errores = validarAltaCliente(nombre, correo);
    mostrarErrores(err, errores);
    if (errores.length) return;
    try {
      const inv = await conBoton($<HTMLButtonElement>("button[type=submit]", fInv), () => crearInvitacion(perfil.id, nombre, correo));
      if (!inv) return;
      st.invitaciones = [inv, ...st.invitaciones];
      render(ctx, st);
      const det = $<HTMLDetailsElement>("#invitar", cont);
      det.open = true;
      $("#codigo-generado", cont).innerHTML = `
        <div class="codigo-ok">
          <p>Código para <strong>${esc(inv.nombre)}</strong>. Compártelo por el medio que prefieras:</p>
          <code class="token">${esc(inv.token)}</code>
          <button class="chico" data-copiar="${esc(inv.token)}">Copiar código</button>
        </div>`;
    } catch (e) { mostrarErrores(err, [(e as Error).message]); }
  });

  // ---- Acciones de invitaciones y asignaciones (delegadas en elementos recreados)
  cont.querySelectorAll<HTMLButtonElement>("[data-copiar]").forEach((b) => b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(b.dataset.copiar ?? ""); aviso("Código copiado."); }
    catch { aviso("No se pudo copiar; selecciona el código y cópialo manualmente.", "error"); }
  }));
  $$<HTMLButtonElement>("[data-reemitir]", cont).forEach((b) => b.addEventListener("click", async () => {
    try {
      const nueva = await reemitirInvitacion(Number(b.dataset.reemitir));
      st.invitaciones = st.invitaciones.map((i) => (i.id === nueva.id ? nueva : i));
      aviso("Código reemitido: el anterior ya no sirve."); render(ctx, st);
    } catch (e) { aviso((e as Error).message, "error"); }
  }));
  $$<HTMLButtonElement>("[data-cancelar]", cont).forEach((b) => b.addEventListener("click", async () => {
    if (!(await confirmar(`¿Cancelar la invitación de ${b.dataset.nombre}? El código dejará de funcionar.`, "Cancelar invitación"))) return;
    try {
      await cancelarInvitacion(Number(b.dataset.cancelar));
      st.invitaciones = st.invitaciones.filter((i) => i.id !== Number(b.dataset.cancelar));
      render(ctx, st);
    } catch (e) { aviso((e as Error).message, "error"); }
  }));
  $$<HTMLButtonElement>("[data-quitar-asig]", cont).forEach((b) => b.addEventListener("click", async () => {
    if (!(await confirmar(`¿Quitar la asignación de "${b.dataset.nombre}"? El cliente dejará de verla en su día.`, "Quitar"))) return;
    try {
      await eliminarAsignacion(Number(b.dataset.quitarAsig));
      st.asignaciones = await listarAsignaciones();
      render(ctx, st);
    } catch (e) { aviso((e as Error).message, "error"); }
  }));

  // ---- Asignar programa (CU-04)
  $$("[data-cliente]", cont).forEach((tarjeta) => {
    const clienteId = tarjeta.dataset.cliente!;
    const form = $<HTMLFormElement>(".f-asignar", tarjeta);
    $("[data-abrir-asignar]", tarjeta).addEventListener("click", () => { form.hidden = !form.hidden; });
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const err = $("[data-err]", form);
      const progId = Number($<HTMLSelectElement>('[data-c="programa"]', form).value);
      const nueva: Asignacion = {
        cliente_id: clienteId, asignado_por: perfil.id,
        rutina_id: esEntrenador ? progId : null, plan_id: esEntrenador ? null : progId,
        fecha_inicio: $<HTMLInputElement>('[data-c="inicio"]', form).value,
        fecha_fin: $<HTMLInputElement>('[data-c="fin"]', form).value,
      };
      try {
        await conBoton($<HTMLButtonElement>("button[type=submit]", form),
          () => crearAsignacion(nueva, st.asignaciones.filter((a) => a.cliente_id === clienteId)));
        aviso("Programa asignado.");
        st.asignaciones = await listarAsignaciones();
        render(ctx, st);
      } catch (e) { mostrarErrores(err, [(e as Error).message]); }
    });
  });
}
