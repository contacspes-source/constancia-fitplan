/**
 * presentacion/planes.ts — Gestión de planes alimenticios del nutriólogo (RS-02, CU-10, CU-11).
 * Rutas: #/planes · #/planes/nuevo · #/planes/:id.
 * Los totales (kcal, proteína, carbohidratos, grasa) se recalculan en tiempo real
 * con cada cambio y nunca son capturables por el usuario (RS-02).
 */
import type { Alimento, PlanAlimenticio, PorcionAlimento, TiempoComida, TipoComida, Totales, Unidad } from "@/tipos";
import { ETIQUETA_COMIDA, TIPOS_COMIDA } from "@/tipos";
import { listarAlimentos } from "@/datos/catalogos";
import { eliminarPlan, guardarPlan, listarPlanes, obtenerPlan } from "@/datos/planes";
import { aportePorcion, redondearTotales, sumarTotales } from "@/negocio/nutricion";
import { validarPlan } from "@/negocio/planes";
import type { Contexto } from "./app";
import { ir } from "./app";
import { $, $$, aviso, cargando, conBoton, confirmar, esc, fechaCorta, mostrarErrores } from "./dom";

const UNIDADES: { v: Unidad; t: string }[] = [{ v: "G", t: "g" }, { v: "ML", t: "ml" }, { v: "PIEZA", t: "pieza(s)" }];

export async function pantallaPlanes(ctx: Contexto) {
  const [p] = ctx.params;
  if (!p) return lista(ctx);
  if (p === "nuevo") return formulario(ctx, null);
  const id = Number(p);
  if (!Number.isInteger(id)) return ir("planes");
  return formulario(ctx, id);
}

async function lista({ cont }: Contexto) {
  cargando(cont);
  const planes = await listarPlanes();
  cont.innerHTML = `
    <div class="encabezado">
      <h2>Mis planes alimenticios</h2>
      <a class="boton" href="#/planes/nuevo">+ Nuevo plan</a>
    </div>
    ${planes.length === 0
      ? `<div class="tarjeta vacio">Aún no tienes planes. Crea el primero para poder asignarlo a tus clientes.</div>`
      : planes.map((p) => `
        <div class="tarjeta fila-lista">
          <div>
            <strong>${esc(p.nombre)}</strong>
            <div class="meta">${p.num_tiempos} tiempo${p.num_tiempos === 1 ? "" : "s"} de comida · creado ${fechaCorta(p.creado_en)}</div>
          </div>
          <div class="acciones">
            <a class="boton secundario chico" href="#/planes/${p.id}">Editar</a>
            <button class="peligro chico" data-borrar="${p.id}" data-nombre="${esc(p.nombre)}">Eliminar</button>
          </div>
        </div>`).join("")}`;

  $$<HTMLButtonElement>("[data-borrar]", cont).forEach((b) => b.addEventListener("click", async () => {
    const nombre = b.dataset.nombre ?? "";
    if (!(await confirmar(`¿Está seguro de eliminar el plan '${nombre}'? Esta acción no se puede deshacer.`))) return;
    try { await eliminarPlan(Number(b.dataset.borrar)); aviso(`Plan "${nombre}" eliminado.`); void lista({ cont } as Contexto); }
    catch (e) { aviso((e as Error).message, "error"); }
  }));
}

function opcionesAlimento(catalogo: Alimento[], sel: number | null, copia?: string) {
  const retirado = sel !== null && !catalogo.some((a) => a.id === sel);
  return `<option value="">— Elige un alimento —</option>` +
    (sel === null && copia ? `<option value="" selected>${esc(copia)} (retirado del catálogo)</option>` : "") +
    (retirado ? `<option value="${sel}" selected>${esc(copia ?? "Alimento")} (retirado del catálogo)</option>` : "") +
    catalogo.map((a) => `<option value="${a.id}" ${a.id === sel ? "selected" : ""}>${esc(a.nombre)}</option>`).join("");
}

function filaPorcion(catalogo: Alimento[], p: Partial<PorcionAlimento>) {
  return `
    <div class="porcion" data-porcion data-copia="${esc(p.nombre_copia ?? "")}">
      <select data-c="alimento" aria-label="Alimento">${opcionesAlimento(catalogo, p.alimento_id ?? null, p.nombre_copia)}</select>
      <input data-c="cantidad" type="number" inputmode="decimal" min="0" step="any" value="${esc(p.cantidad ?? 100)}" aria-label="Cantidad" />
      <select data-c="unidad" aria-label="Unidad">${UNIDADES.map((u) => `<option value="${u.v}" ${u.v === (p.unidad ?? "G") ? "selected" : ""}>${u.t}</option>`).join("")}</select>
      <span class="kcal" data-kcal>—</span>
      <button type="button" class="secundario chico" data-quitar aria-label="Quitar alimento">✕</button>
    </div>`;
}

function seccionTiempo(catalogo: Alimento[], tipo: TipoComida, t?: TiempoComida) {
  return `
    <div class="tarjeta tiempo" data-tiempo="${tipo}">
      <div class="ejercicio-cab">
        <strong>${ETIQUETA_COMIDA[tipo]}</strong>
        <span class="meta" data-subtotal></span>
      </div>
      <div data-porciones>${(t?.porciones ?? []).map((p) => filaPorcion(catalogo, p)).join("")}</div>
      <button type="button" class="secundario chico" data-agregar>+ Agregar alimento</button>
      <div class="error" data-err-tiempo hidden></div>
    </div>`;
}

/** Lee el formulario. Los tiempos sin alimentos no forman parte del plan. */
function leerTiempos(cont: HTMLElement, catalogo: Map<number, Alimento>): TiempoComida[] {
  return $$("[data-tiempo]", cont).map((sec) => ({
    tipo: sec.dataset.tiempo as TipoComida,
    porciones: $$("[data-porcion]", sec).map((f): PorcionAlimento => {
      const idTxt = $<HTMLSelectElement>('[data-c="alimento"]', f).value;
      const alimento_id = idTxt === "" ? null : Number(idTxt);
      const cantTxt = $<HTMLInputElement>('[data-c="cantidad"]', f).value.trim();
      return {
        alimento_id,
        nombre_copia: alimento_id !== null ? catalogo.get(alimento_id)?.nombre ?? f.dataset.copia ?? "" : f.dataset.copia ?? "",
        cantidad: cantTxt === "" ? NaN : Number(cantTxt),
        unidad: $<HTMLSelectElement>('[data-c="unidad"]', f).value as Unidad,
      };
    }),
  })).filter((t) => t.porciones.length > 0);
}

const fmt = (t: Totales) => {
  const r = redondearTotales(t, 0);
  return { kcal: r.kcal.toLocaleString("es-MX"), p: r.proteina, c: r.carbohidratos, g: r.grasa };
};

async function formulario({ cont, perfil }: Contexto, id: number | null) {
  cargando(cont);
  const [alimentos, plan] = await Promise.all([listarAlimentos(), id === null ? Promise.resolve(null) : obtenerPlan(id)]);
  const catalogo = new Map(alimentos.map((a) => [a.id, a]));
  const porTipo = new Map((plan?.tiempos ?? []).map((t) => [t.tipo, t]));

  cont.innerHTML = `
    <div class="encabezado">
      <h2>${plan ? "Editar plan" : "Nuevo plan alimenticio"}</h2>
      <a class="boton secundario" href="#/planes">Volver</a>
    </div>
    <form novalidate id="f-plan">
      <div class="tarjeta">
        <label for="nombre">Nombre del plan</label>
        <input id="nombre" maxlength="100" value="${esc(plan?.nombre ?? "")}" placeholder="Ej. Definición 1,800 kcal" />
        <div class="error" id="err-nombre" hidden></div>
      </div>
      <div class="tarjeta totales" aria-live="polite">
        <div><span id="t-kcal">0</span><small>kcal</small></div>
        <div><span id="t-p">0</span><small>proteína (g)</small></div>
        <div><span id="t-c">0</span><small>carbohidratos (g)</small></div>
        <div><span id="t-g">0</span><small>grasa (g)</small></div>
      </div>
      <p class="ayuda">Calculado automáticamente a partir del catálogo; no se captura. Deja vacíos los tiempos que el plan no incluya.</p>
      ${TIPOS_COMIDA.map((t) => seccionTiempo(alimentos, t, porTipo.get(t))).join("")}
      <div class="error" id="err-plan" hidden></div>
      <div class="pie-form"><button type="submit">Guardar plan</button></div>
    </form>`;

  /** Recalcula fila por fila, subtotal por tiempo y total del plan (CU-11). */
  const recalcular = () => {
    const subtotales: Totales[] = [];
    $$("[data-tiempo]", cont).forEach((sec) => {
      const aportes = $$("[data-porcion]", sec).map((f) => {
        const idTxt = $<HTMLSelectElement>('[data-c="alimento"]', f).value;
        const a = idTxt ? catalogo.get(Number(idTxt)) ?? null : null;
        const p: PorcionAlimento = { alimento_id: a?.id ?? null, nombre_copia: a?.nombre ?? "",
          cantidad: Number($<HTMLInputElement>('[data-c="cantidad"]', f).value), unidad: $<HTMLSelectElement>('[data-c="unidad"]', f).value as Unidad };
        const ap = aportePorcion(p, a);
        $("[data-kcal]", f).textContent = ap ? `${Math.round(ap.kcal)} kcal` : "—";
        return ap;
      });
      const sub = sumarTotales(aportes);
      subtotales.push(sub);
      $("[data-subtotal]", sec).textContent = aportes.length ? `${fmt(sub).kcal} kcal` : "";
    });
    const t = fmt(sumarTotales(subtotales));
    $("#t-kcal", cont).textContent = t.kcal;
    $("#t-p", cont).textContent = String(t.p);
    $("#t-c", cont).textContent = String(t.c);
    $("#t-g", cont).textContent = String(t.g);
  };

  // Escuchadores en el formulario (se recrea en cada visita), no en #vista, que persiste.
  const form = $<HTMLFormElement>("#f-plan", cont);
  form.addEventListener("input", recalcular);
  form.addEventListener("change", recalcular);
  form.addEventListener("click", (ev) => {
    const el = ev.target as HTMLElement;
    if (el.closest("[data-agregar]")) {
      const sec = el.closest<HTMLElement>("[data-tiempo]")!;
      $("[data-porciones]", sec).insertAdjacentHTML("beforeend", filaPorcion(alimentos, {}));
      recalcular();
    } else if (el.closest("[data-quitar]")) {
      el.closest("[data-porcion]")?.remove();
      recalcular();
    }
  });
  recalcular();

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const datos: PlanAlimenticio = {
      id: plan?.id, nutriologo_id: plan?.nutriologo_id ?? perfil.id,
      nombre: $<HTMLInputElement>("#nombre", cont).value,
      es_plantilla: plan?.es_plantilla ?? false, origen_id: plan?.origen_id ?? null,
      tiempos: leerTiempos(cont, catalogo),
    };
    const v = validarPlan(datos, catalogo);

    mostrarErrores($("#err-nombre", cont), v.errores.filter((e) => e.includes("Nombre del plan")));
    mostrarErrores($("#err-plan", cont), v.errores.filter((e) => e.includes("Tiempos de comida")));
    $$("[data-tiempo]", cont).forEach((sec) => {
      const etiqueta = ETIQUETA_COMIDA[sec.dataset.tiempo as TipoComida];
      mostrarErrores($("[data-err-tiempo]", sec), v.errores.filter((e) => e.startsWith(`${etiqueta}:`) || e.startsWith(`${etiqueta},`)));
    });
    if (!v.ok) { cont.querySelector<HTMLElement>(".error:not([hidden])")?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }

    try {
      await conBoton($<HTMLButtonElement>("button[type=submit]", form), () => guardarPlan(datos));
      aviso(plan ? "Plan actualizado." : "Plan creado.");
      ir("planes");
    } catch (e) {
      mostrarErrores($("#err-plan", cont), [(e as Error).message]);
    }
  });
}
