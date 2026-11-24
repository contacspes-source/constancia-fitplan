/** presentacion/planes.ts — Planes alimenticios del nutriólogo con cálculo en tiempo real (RS-02, CU-10, CU-11). */
import { eliminarPlan, guardarPlan, listarAlimentos, listarPlanes, obtenerPlan } from "@/datos/repositorios";
import { aportePorcion, redondearTotales, sumarTotales, validarPlan } from "@/negocio/nutricion";
import { ETIQUETA_COMIDA, TIPOS_COMIDA } from "@/tipos";
import type { Alimento, Perfil, PlanAlimenticio, PorcionAlimento, TiempoComida, Totales, Unidad } from "@/tipos";
import { $, avisar, cargando, confirmar, esc, mostrarErrores } from "./ui";

export function textoTotales(t: Totales): string {
  const r = redondearTotales(t);
  return `<span><b>${r.kcal}</b> kcal</span><span>P ${r.proteina} g</span><span>C ${r.carbohidratos} g</span><span>G ${r.grasa} g</span>`;
}

export async function vistaPlanes(cont: HTMLElement, perfil: Perfil) {
  cargando(cont);
  try {
    const planes = await listarPlanes();
    cont.innerHTML = `
      <div class="fila-titulo"><h2>Mis planes alimenticios</h2><button id="nuevo">+ Nuevo plan</button></div>
      ${planes.length === 0 ? `<p class="vacio">Aún no tienes planes. Crea el primero para poder asignarlo.</p>` : ""}
      ${planes.map(p => `
        <div class="tarjeta item">
          <div><strong>${esc(p.nombre)}</strong><div class="sub">${p.tiempos} tiempo${p.tiempos === 1 ? "" : "s"} de comida</div></div>
          <div class="acciones">
            <button class="secundario chico" data-editar="${p.id}">Editar</button>
            <button class="peligro chico" data-eliminar="${p.id}" data-nombre="${esc(p.nombre)}">Eliminar</button>
          </div>
        </div>`).join("")}`;
    $(cont, "#nuevo").addEventListener("click", () => void editorPlan(cont, perfil));
    cont.querySelectorAll<HTMLButtonElement>("[data-editar]").forEach(b =>
      b.addEventListener("click", () => void editorPlan(cont, perfil, Number(b.dataset.editar))));
    cont.querySelectorAll<HTMLButtonElement>("[data-eliminar]").forEach(b =>
      b.addEventListener("click", async () => {
        const ok = await confirmar(`¿Está seguro de eliminar el plan '${b.dataset.nombre}'? Esta acción no se puede deshacer.`);
        if (!ok) return;
        try { await eliminarPlan(Number(b.dataset.eliminar)); avisar("Plan eliminado."); void vistaPlanes(cont, perfil); }
        catch (e) { avisar((e as Error).message, "error"); }
      }));
  } catch (e) { cont.innerHTML = `<p class="error">${esc((e as Error).message)}</p>`; }
}

async function editorPlan(cont: HTMLElement, perfil: Perfil, id?: number) {
  cargando(cont);
  let alimentos: Alimento[]; let plan: PlanAlimenticio;
  try {
    [alimentos, plan] = await Promise.all([
      listarAlimentos(),
      id !== undefined ? obtenerPlan(id)
        : Promise.resolve<PlanAlimenticio>({ nutriologo_id: perfil.id, nombre: "", es_plantilla: false, origen_id: null, tiempos: [] }),
    ]);
  } catch (e) { cont.innerHTML = `<p class="error">${esc((e as Error).message)}</p>`; return; }
  const catalogo = new Map(alimentos.map(a => [a.id, a]));

  // Estado editable: los cinco tiempos siempre presentes en pantalla.
  const tiempos: TiempoComida[] = TIPOS_COMIDA.map(tipo => plan.tiempos.find(t => t.tipo === tipo) ?? { tipo, porciones: [] });

  cont.innerHTML = `
    <div class="fila-titulo"><h2>${id ? "Editar plan" : "Nuevo plan"}</h2><button class="secundario chico" id="cancelar">Volver</button></div>
    <div class="tarjeta">
      <label for="p-nombre">Nombre del plan</label>
      <input id="p-nombre" maxlength="100" value="${esc(plan.nombre)}" />
      <div class="error" id="e-nombre" hidden></div>
    </div>
    <div class="tarjeta totales-plan"><div class="sub">Total del día (calculado por el sistema)</div><div class="macros" id="total"></div></div>
    <div id="tiempos"></div>
    <div class="error caja" id="e-general" hidden></div>
    <div class="barra-guardar"><button id="guardar">Guardar plan</button></div>`;

  const contTiempos = $(cont, "#tiempos");
  const opcionesAlimento = (sel: number | null) => `<option value="">— Selecciona —</option>` + alimentos.map(a =>
    `<option value="${a.id}" ${a.id === sel ? "selected" : ""}>${esc(a.nombre)}</option>`).join("");

  const leer = () => {
    contTiempos.querySelectorAll<HTMLElement>(".tiempo").forEach((div, ti) => {
      tiempos[ti].porciones = [...div.querySelectorAll<HTMLElement>(".porcion")].map(p => {
        const sel = p.querySelector<HTMLSelectElement>("[name=alimento]")!;
        const alimento_id = sel.value ? Number(sel.value) : null;
        const a = alimento_id !== null ? catalogo.get(alimento_id) : undefined;
        const cant = p.querySelector<HTMLInputElement>("[name=cantidad]")!.value;
        return {
          alimento_id, nombre_copia: a?.nombre ?? p.dataset.copia ?? "",
          cantidad: cant === "" ? NaN : Number(cant), unidad: p.querySelector<HTMLSelectElement>("[name=unidad]")!.value as Unidad,
        } as PorcionAlimento;
      });
    });
  };

  const recalcular = () => {
    leer();
    let todos: (Totales | null)[] = [];
    contTiempos.querySelectorAll<HTMLElement>(".tiempo").forEach((div, ti) => {
      const aportes = tiempos[ti].porciones.map(p => aportePorcion(p, p.alimento_id !== null ? catalogo.get(p.alimento_id) ?? null : null));
      div.querySelectorAll<HTMLElement>(".porcion").forEach((p, i) => {
        const a = aportes[i];
        p.querySelector<HTMLElement>(".aporte")!.textContent = a ? `${Math.round(a.kcal)} kcal` : "—";
      });
      div.querySelector<HTMLElement>(".macros")!.innerHTML = textoTotales(sumarTotales(aportes));
      todos = todos.concat(aportes);
    });
    $(cont, "#total").innerHTML = textoTotales(sumarTotales(todos));
  };

  const pintar = () => {
    contTiempos.innerHTML = tiempos.map((t, ti) => `
      <div class="tarjeta tiempo">
        <div class="fila-titulo"><h3>${ETIQUETA_COMIDA[t.tipo]}</h3><div class="macros chicas"></div></div>
        ${t.porciones.map((p, i) => {
          const retirado = p.alimento_id === null || !catalogo.has(p.alimento_id);
          return `
          <div class="porcion" ${retirado ? `data-copia="${esc(p.nombre_copia)}"` : ""}>
            <select name="alimento" aria-label="Alimento">${opcionesAlimento(retirado ? null : p.alimento_id)}</select>
            ${retirado ? `<div class="sub">Antes: ${esc(p.nombre_copia)} (ya no está en el catálogo; elija un reemplazo)</div>` : ""}
            <div class="rejilla porcion-campos">
              <input name="cantidad" type="number" inputmode="decimal" min="0" step="any" placeholder="Porción" aria-label="Porción" value="${Number.isNaN(p.cantidad) ? "" : p.cantidad}" />
              <select name="unidad" aria-label="Unidad">
                ${(["G", "ML", "PIEZA"] as Unidad[]).map(u => `<option value="${u}" ${u === p.unidad ? "selected" : ""}>${u === "G" ? "g" : u === "ML" ? "ml" : "pieza(s)"}</option>`).join("")}
              </select>
              <span class="aporte sub"></span>
              <button class="enlace peligro-txt" data-quitar="${ti}:${i}" aria-label="Quitar alimento">✕</button>
            </div>
          </div>`;
        }).join("")}
        <button class="secundario chico" data-agregar="${ti}">+ Alimento</button>
      </div>`).join("");
    contTiempos.querySelectorAll<HTMLButtonElement>("[data-agregar]").forEach(b => b.addEventListener("click", () => {
      leer(); tiempos[Number(b.dataset.agregar)].porciones.push({ alimento_id: null, nombre_copia: "", cantidad: NaN, unidad: "G" }); pintar();
    }));
    contTiempos.querySelectorAll<HTMLButtonElement>("[data-quitar]").forEach(b => b.addEventListener("click", () => {
      leer(); const [ti, i] = b.dataset.quitar!.split(":").map(Number); tiempos[ti].porciones.splice(i, 1); pintar();
    }));
    recalcular();
  };
  contTiempos.addEventListener("input", recalcular);
  contTiempos.addEventListener("change", recalcular);
  pintar();

  $(cont, "#cancelar").addEventListener("click", () => void vistaPlanes(cont, perfil));
  $(cont, "#guardar").addEventListener("click", async () => {
    leer();
    const p: PlanAlimenticio = { ...plan, nombre: $<HTMLInputElement>(cont, "#p-nombre").value, tiempos };
    const res = validarPlan(p, catalogo);
    mostrarErrores($(cont, "#e-nombre"), res.errores.filter(m => m.includes("Nombre del plan")));
    mostrarErrores($(cont, "#e-general"), res.errores.filter(m => !m.includes("Nombre del plan")));
    if (!res.ok) { avisar("Hay campos por corregir.", "error"); return; }
    const btn = $<HTMLButtonElement>(cont, "#guardar"); btn.disabled = true;
    try { await guardarPlan(p); avisar("Plan guardado."); void vistaPlanes(cont, perfil); }
    catch (e) { mostrarErrores($(cont, "#e-general"), [(e as Error).message]); btn.disabled = false; }
  });
}
