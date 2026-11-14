/**
 * presentacion/hoy.ts — Vista única del día del cliente (RS-06, CU-13) y registro
 * de cumplimiento (RS-07, CU-14). Es la pantalla de entrada del cliente: se llega
 * con un solo clic desde el inicio de sesión (RS-14).
 * Las marcas se reflejan al instante y se revierten si el servidor las rechaza.
 */
import { ETIQUETA_COMIDA } from "@/tipos";
import { marcarCumplimiento, obtenerVistaDelDia, type Elemento } from "@/datos/dia";
import { estadoDelDia, progresoDelDia, textoCarga, textoDescanso, textoPorcion, totalesComida, type VistaDelDia } from "@/negocio/dia";
import { redondearTotales } from "@/negocio/nutricion";
import type { Contexto } from "./app";
import { $, aviso, cargando, esc } from "./dom";

/** Solo enlaces http(s): esc() evita romper el HTML, pero no bloquea "javascript:". */
const urlSegura = (u: string | null) => (u && /^https?:\/\//i.test(u.trim()) ? u.trim() : null);

const DIAS = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

function fechaLarga(iso: string, dow: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const mes = new Date(y, m - 1, d).toLocaleDateString("es-MX", { month: "long" });
  return `${DIAS[dow]} ${d} de ${mes}`;
}

export async function pantallaHoy(ctx: Contexto) {
  cargando(ctx.cont, "Cargando tu día…");
  const vista = await obtenerVistaDelDia();
  render(ctx, vista);
}

function marca(completado: boolean, e: Elemento, etiqueta: string) {
  return `<button class="check ${completado ? "hecho" : ""}" data-tipo="${e.tipo}" data-id="${e.id}"
    aria-pressed="${completado}" aria-label="${completado ? "Desmarcar" : "Marcar como hecho"}: ${esc(etiqueta)}">${completado ? "✓" : ""}</button>`;
}

function render({ cont, perfil }: Contexto, v: VistaDelDia) {
  const estado = estadoDelDia(v);
  const nombre = perfil.nombre.split(" ")[0];
  const encabezado = `<div class="encabezado"><div><h2>Hola, ${esc(nombre)}</h2><div class="meta">Hoy es ${fechaLarga(v.fecha, v.dia_semana)}</div></div></div>`;

  if (estado === "SIN_PROGRAMA") {
    cont.innerHTML = `${encabezado}
      <div class="tarjeta vacio">
        <p><strong>Aún no tienes un programa vigente.</strong></p>
        <p>Contacta a tu entrenador o nutriólogo para que te asigne tu rutina y tu plan de alimentación.</p>
      </div>`;
    return;
  }
  if (estado === "DESCANSO") {
    cont.innerHTML = `${encabezado}
      <div class="tarjeta vacio descanso"><p class="grande">🧘</p><p><strong>Hoy es día de descanso programado. ¡Recupera energías!</strong></p></div>`;
    return;
  }

  const p = progresoDelDia(v);
  cont.innerHTML = `${encabezado}
    <div class="tarjeta progreso" aria-live="polite">
      <div class="progreso-txt"><strong id="p-hechos">${p.hechos} de ${p.total}</strong> <span class="meta">completados hoy</span></div>
      <div class="barra-progreso"><div id="p-barra" style="width:${p.porcentaje}%"></div></div>
    </div>

    ${v.ejercicios.length ? `
      <h3>🏋️ Entrenamiento ${v.rutina ? `<span class="meta">· ${esc(v.rutina)}</span>` : ""}</h3>
      ${v.ejercicios.map((e) => `
        <div class="tarjeta item ${e.completado ? "item-hecho" : ""}" data-item="ejercicio-${e.id}">
          ${marca(e.completado, { tipo: "ejercicio", id: e.id }, e.nombre)}
          <div class="item-cuerpo">
            <strong>${esc(e.nombre)}</strong>
            <div class="chips">
              <span>${e.series} × ${esc(e.repeticiones)}</span>
              <span>${textoCarga(e.carga_kg)}</span>
              <span>Descanso ${textoDescanso(e.descanso_seg)}</span>
            </div>
            <details class="guia">
              <summary>Cómo hacerlo</summary>
              <p>${e.descripcion ? esc(e.descripcion) : "Sin descripción disponible."}</p>
              ${urlSegura(e.url_demostracion) ? `<a href="${esc(urlSegura(e.url_demostracion))}" target="_blank" rel="noopener">Ver demostración</a>` : `<p class="meta">No hay demostración en video para este ejercicio.</p>`}
            </details>
          </div>
        </div>`).join("")}` : `<div class="tarjeta meta">Hoy no tienes entrenamiento programado.</div>`}

    ${v.comidas.length ? `
      <h3>🥗 Alimentación ${v.plan ? `<span class="meta">· ${esc(v.plan)}</span>` : ""}</h3>
      ${v.comidas.map((c) => {
        const t = redondearTotales(totalesComida(c), 0);
        return `
        <div class="tarjeta item ${c.completado ? "item-hecho" : ""}" data-item="comida-${c.id}">
          ${marca(c.completado, { tipo: "comida", id: c.id }, ETIQUETA_COMIDA[c.tipo])}
          <div class="item-cuerpo">
            <strong>${ETIQUETA_COMIDA[c.tipo]}</strong> <span class="meta">${t.kcal} kcal · P ${t.proteina} · C ${t.carbohidratos} · G ${t.grasa}</span>
            <ul class="porciones-dia">${c.porciones.map((po) => `<li>${esc(po.nombre)} <span class="meta">${textoPorcion(po)}</span></li>`).join("")}</ul>
          </div>
        </div>`;
      }).join("")}` : `<div class="tarjeta meta">Hoy no tienes plan de alimentación asignado.</div>`}
    <p class="ayuda centrado">Puedes marcar y desmarcar hasta las 23:59 de hoy. Después, el día queda registrado.</p>`;

  const actualizarProgreso = () => {
    const pr = progresoDelDia(v);
    $("#p-hechos", cont).textContent = `${pr.hechos} de ${pr.total}`;
    $("#p-barra", cont).style.width = `${pr.porcentaje}%`;
  };

  cont.querySelectorAll<HTMLButtonElement>(".check").forEach((b) => b.addEventListener("click", async () => {
    const e: Elemento = { tipo: b.dataset.tipo as Elemento["tipo"], id: Number(b.dataset.id) };
    const lista = e.tipo === "ejercicio" ? v.ejercicios : v.comidas;
    const item = lista.find((x) => x.id === e.id)!;
    const nuevo = !item.completado;
    const pintar = (val: boolean) => {
      item.completado = val;
      b.classList.toggle("hecho", val); b.textContent = val ? "✓" : ""; b.setAttribute("aria-pressed", String(val));
      b.closest(".item")?.classList.toggle("item-hecho", val);
      actualizarProgreso();
    };
    pintar(nuevo);                      // respuesta inmediata
    b.disabled = true;
    try { await marcarCumplimiento(e, nuevo); }
    catch (err) { pintar(!nuevo); aviso((err as Error).message, "error"); }   // revertir si el servidor rechaza
    finally { b.disabled = false; }
  }));
}
