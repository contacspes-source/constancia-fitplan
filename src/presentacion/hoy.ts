/**
 * presentacion/hoy.ts — Vista Única del Día del cliente (RS-06, RS-14) y
 * registro de cumplimiento (RS-07). La fecha la define el servidor.
 */
import { activarCodigo, cargarDia, clienteActivado, marcarCumplimiento, type DiaCliente } from "@/datos/repositorios";
import { aportePorcion, sumarTotales } from "@/negocio/nutricion";
import { ETIQUETA_COMIDA } from "@/tipos";
import type { Perfil } from "@/tipos";
import { tokenDelEnlace } from "./login";
import { textoTotales } from "./planes";
import { $, avisar, cargando, esc, formatoFecha, mostrarErrores } from "./ui";

export async function vistaHoy(cont: HTMLElement, perfil: Perfil) {
  cargando(cont);
  try {
    if (!(await clienteActivado(perfil.id))) return formularioCodigo(cont, perfil, true);
    pintar(cont, perfil, await cargarDia());
  } catch (e) { cont.innerHTML = `<p class="error">${esc((e as Error).message)}</p>`; }
}

function pintar(cont: HTMLElement, perfil: Perfil, dia: DiaCliente) {
  const total = dia.ejercicios.length + dia.comidas.length;
  const hechos = dia.ejercicios.filter(e => e.completado).length + dia.comidas.filter(c => c.completado).length;

  let cuerpo: string;
  if (!dia.tieneProgramaVigente) {
    cuerpo = `<div class="tarjeta vacio">No tienes ningún programa vigente.<br>Contacta a tu entrenador o nutriólogo para que te asigne uno.</div>`;
  } else if (total === 0) {
    cuerpo = `<div class="tarjeta vacio descanso">Hoy es día de descanso programado. ¡Recupera energías!</div>`;
  } else {
    cuerpo = `
      <div class="tarjeta progreso">
        <div class="fila-titulo"><span>Progreso de hoy</span><strong id="contador">${hechos} / ${total}</strong></div>
        <div class="barra"><span id="barra-hoy" style="width:${Math.round((hechos / total) * 100)}%"></span></div>
      </div>
      ${dia.ejercicios.length ? `
        <h2>🏋️ Entrenamiento <span class="sub">${esc(dia.rutina ?? "")}</span></h2>
        ${dia.ejercicios.map(e => `
          <label class="tarjeta check ${e.completado ? "hecho" : ""}">
            <input type="checkbox" data-ej="${e.id}" ${e.completado ? "checked" : ""} />
            <div>
              <strong>${esc(e.nombre)}</strong>
              <div class="datos"><span>${e.series} × ${esc(e.repeticiones)}</span><span>${e.carga_kg > 0 ? `${e.carga_kg} kg` : "Peso corporal"}</span><span>Descanso ${e.descanso_seg} s</span></div>
              ${e.descripcion ? `<details><summary>Técnica</summary><p class="sub">${esc(e.descripcion)}</p></details>` : ""}
            </div>
          </label>`).join("")}` : (dia.rutina ? `<div class="tarjeta vacio">Hoy no tienes ejercicios: día de descanso del entrenamiento.</div>` : "")}
      ${dia.comidas.length ? `
        <h2>🍽️ Alimentación <span class="sub">${esc(dia.plan ?? "")}</span></h2>
        <div class="tarjeta totales-plan"><div class="sub">Total del día</div><div class="macros">${textoTotales(sumarTotales(
          dia.comidas.flatMap(c => c.porciones.map(p => aportePorcion({ alimento_id: p.alimento?.id ?? null, nombre_copia: p.nombre, cantidad: p.cantidad, unidad: p.unidad }, p.alimento)))))}</div></div>
        ${dia.comidas.map(c => `
          <label class="tarjeta check ${c.completado ? "hecho" : ""}">
            <input type="checkbox" data-com="${c.id}" ${c.completado ? "checked" : ""} />
            <div>
              <strong>${ETIQUETA_COMIDA[c.tipo]}</strong>
              <ul class="porciones">${c.porciones.map(p =>
                `<li>${esc(p.nombre)} — ${p.cantidad} ${p.unidad === "G" ? "g" : p.unidad === "ML" ? "ml" : p.cantidad === 1 ? "pieza" : "piezas"}</li>`).join("")}</ul>
            </div>
          </label>`).join("")}` : ""}`;
  }

  cont.innerHTML = `
    <div class="hoy-encabezado"><h1>Hoy</h1><div class="sub">${esc(formatoFecha(dia.fecha))}</div></div>
    ${cuerpo}
    <details class="tarjeta"><summary>Tengo un código de otro instructor</summary><div id="caja-codigo"></div></details>`;
  formularioCodigo($(cont, "#caja-codigo"), perfil, false);

  cont.querySelectorAll<HTMLInputElement>("input[type=checkbox]").forEach(chk => chk.addEventListener("change", async () => {
    const elemento = chk.dataset.ej ? { rutina_ejercicio_id: Number(chk.dataset.ej) } : { tiempo_comida_id: Number(chk.dataset.com) };
    chk.disabled = true;
    try {
      await marcarCumplimiento(elemento, chk.checked);
      chk.closest(".check")!.classList.toggle("hecho", chk.checked);
      const n = cont.querySelectorAll<HTMLInputElement>("input[type=checkbox]:checked").length;
      $(cont, "#contador").textContent = `${n} / ${total}`;
      $(cont, "#barra-hoy").style.width = `${Math.round((n / total) * 100)}%`;
    } catch (e) {
      chk.checked = !chk.checked;
      avisar((e as Error).message, "error");
      // Si cambió el día en el servidor, se recarga la vista con la fecha nueva.
      if (/día en curso/.test((e as Error).message)) setTimeout(() => void vistaHoy(cont, perfil), 1500);
    } finally { chk.disabled = false; }
  }));
}

/** Formulario para capturar un código de invitación estando ya dentro de la cuenta (CU-12). */
function formularioCodigo(cont: HTMLElement, perfil: Perfil, pantallaCompleta: boolean) {
  cont.innerHTML = `
    ${pantallaCompleta ? `<div class="tarjeta"><h2>Activa tu cuenta</h2><p>Para ver tu programa, captura el código de invitación que te dio tu entrenador o nutriólogo.</p>` : ""}
    <form class="f-codigo" novalidate>
      <label>Código de invitación</label>
      <input name="token" value="${esc(tokenDelEnlace() ?? "")}" autocomplete="off" spellcheck="false" />
      <div class="error" hidden></div>
      <button type="submit">Activar código</button>
    </form>
    ${pantallaCompleta ? `</div>` : ""}`;
  const form = cont.querySelector<HTMLFormElement>(".f-codigo")!;
  form.addEventListener("submit", async ev => {
    ev.preventDefault();
    const tok = form.querySelector<HTMLInputElement>("[name=token]")!.value.trim();
    const err = form.querySelector<HTMLElement>(".error")!;
    if (!/^[0-9a-f]{64}$/i.test(tok)) { mostrarErrores(err, ["El código debe tener 64 caracteres (letras a-f y números)."]); return; }
    try {
      await activarCodigo(tok);
      history.replaceState(null, "", location.pathname);
      avisar("Código activado.");
      const raiz = document.getElementById("contenido") ?? cont;
      void vistaHoy(raiz, perfil);
    } catch (e) { mostrarErrores(err, [(e as Error).message]); }
  });
}
