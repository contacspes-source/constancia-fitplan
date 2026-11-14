/**
 * presentacion/rutinas.ts — Gestión de rutinas del entrenador (RS-01, CU-08, CU-09).
 * Rutas: #/rutinas (lista) · #/rutinas/nueva · #/rutinas/:id (editar).
 * Al fallar la validación se conservan los datos capturados y cada mensaje
 * aparece junto al campo o ejercicio que lo originó (RS-01).
 */
import type { Ejercicio, EjercicioRutina, Rutina } from "@/tipos";
import { listarEjercicios } from "@/datos/catalogos";
import { eliminarRutina, guardarRutina, listarRutinas, obtenerRutina } from "@/datos/rutinas";
import { validarRutina } from "@/negocio/validacion";
import type { Contexto } from "./app";
import { ir } from "./app";
import { $, $$, aviso, cargando, conBoton, confirmar, esc, fechaCorta, mostrarErrores } from "./dom";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export async function pantallaRutinas(ctx: Contexto) {
  const [p] = ctx.params;
  if (!p) return lista(ctx);
  if (p === "nueva") return formulario(ctx, null);
  const id = Number(p);
  if (!Number.isInteger(id)) return ir("rutinas");
  return formulario(ctx, id);
}

async function lista({ cont }: Contexto) {
  cargando(cont);
  const rutinas = await listarRutinas();
  cont.innerHTML = `
    <div class="encabezado">
      <h2>Mis rutinas</h2>
      <a class="boton" href="#/rutinas/nueva">+ Nueva rutina</a>
    </div>
    ${rutinas.length === 0
      ? `<div class="tarjeta vacio">Aún no tienes rutinas. Crea la primera para poder asignarla a tus clientes.</div>`
      : rutinas.map((r) => `
        <div class="tarjeta fila-lista">
          <div>
            <strong>${esc(r.nombre)}</strong>
            <div class="meta">${r.num_ejercicios} ejercicio${r.num_ejercicios === 1 ? "" : "s"} · creada ${fechaCorta(r.creado_en)}</div>
            ${r.objetivo ? `<div class="meta">${esc(r.objetivo)}</div>` : ""}
          </div>
          <div class="acciones">
            <a class="boton secundario chico" href="#/rutinas/${r.id}">Editar</a>
            <button class="peligro chico" data-borrar="${r.id}" data-nombre="${esc(r.nombre)}">Eliminar</button>
          </div>
        </div>`).join("")}`;

  $$<HTMLButtonElement>("[data-borrar]", cont).forEach((b) => b.addEventListener("click", async () => {
    const nombre = b.dataset.nombre ?? "";
    // Texto exacto de RS-01.
    if (!(await confirmar(`¿Está seguro de eliminar la rutina '${nombre}'? Esta acción no se puede deshacer.`))) return;
    try { await eliminarRutina(Number(b.dataset.borrar)); aviso(`Rutina "${nombre}" eliminada.`); void lista({ cont } as Contexto); }
    catch (e) { aviso((e as Error).message, "error"); }
  }));
}

function opcionesEjercicio(catalogo: Ejercicio[], seleccionado?: number) {
  const grupos = new Map<string, Ejercicio[]>();
  catalogo.forEach((e) => grupos.set(e.grupo_muscular, [...(grupos.get(e.grupo_muscular) ?? []), e]));
  return `<option value="">— Elige un ejercicio —</option>` + [...grupos].map(([g, lista]) =>
    `<optgroup label="${esc(g)}">${lista.map((e) =>
      `<option value="${e.id}" ${e.id === seleccionado ? "selected" : ""}>${esc(e.nombre)}</option>`).join("")}</optgroup>`).join("");
}

function filaEjercicio(catalogo: Ejercicio[], e: Partial<EjercicioRutina>, n: number) {
  return `
    <div class="tarjeta ejercicio" data-fila ${e.id !== undefined ? `data-id="${e.id}"` : ""}>
      <div class="ejercicio-cab">
        <strong>Ejercicio <span data-num>${n}</span></strong>
        <button type="button" class="secundario chico" data-quitar aria-label="Quitar ejercicio">Quitar</button>
      </div>
      <label>Ejercicio del catálogo<select data-c="ejercicio_id">${opcionesEjercicio(catalogo, e.ejercicio_id)}</select></label>
      <div class="rejilla">
        <label>Día<select data-c="dia_semana">${DIAS.map((d, i) =>
          `<option value="${i + 1}" ${e.dia_semana === i + 1 ? "selected" : ""}>${d}</option>`).join("")}</select></label>
        <label>Series<input data-c="series" type="number" inputmode="numeric" min="1" max="50" step="1" value="${esc(e.series ?? 3)}" /></label>
        <label>Repeticiones<input data-c="repeticiones" type="text" placeholder="12 o 10-12" value="${esc(e.repeticiones ?? "10-12")}" /></label>
        <label>Carga (kg)<input data-c="carga_kg" type="number" inputmode="decimal" min="0" step="0.5" value="${esc(e.carga_kg ?? 0)}" /></label>
        <label>Descanso (s)<input data-c="descanso_seg" type="number" inputmode="numeric" min="0" step="5" value="${esc(e.descanso_seg ?? 60)}" /></label>
      </div>
      <div class="error" data-err-fila hidden></div>
    </div>`;
}

/** Lee el formulario tal cual lo capturó el usuario; la validación decide si es correcto. */
function leerEjercicios(cont: HTMLElement): EjercicioRutina[] {
  return $$("[data-fila]", cont).map((f) => {
    const v = (c: string) => $<HTMLInputElement>(`[data-c="${c}"]`, f).value.trim();
    const num = (c: string) => (v(c) === "" ? NaN : Number(v(c)));
    return {
      id: f.dataset.id ? Number(f.dataset.id) : undefined,
      ejercicio_id: num("ejercicio_id"), dia_semana: num("dia_semana"), series: num("series"),
      repeticiones: v("repeticiones"), carga_kg: num("carga_kg"), descanso_seg: num("descanso_seg"),
    };
  });
}

async function formulario({ cont, perfil }: Contexto, id: number | null) {
  cargando(cont);
  const [catalogo, rutina] = await Promise.all([listarEjercicios(), id === null ? Promise.resolve(null) : obtenerRutina(id)]);
  const inicial: Partial<EjercicioRutina>[] = rutina?.ejercicios.length ? rutina.ejercicios : [{ dia_semana: 1 }];

  cont.innerHTML = `
    <div class="encabezado">
      <h2>${rutina ? "Editar rutina" : "Nueva rutina"}</h2>
      <a class="boton secundario" href="#/rutinas">Volver</a>
    </div>
    <form novalidate id="f-rutina">
      <div class="tarjeta">
        <label for="nombre">Nombre de la rutina</label>
        <input id="nombre" maxlength="100" value="${esc(rutina?.nombre ?? "")}" placeholder="Ej. Fuerza tren superior" />
        <div class="error" id="err-nombre" hidden></div>
        <label for="objetivo">Descripción u objetivo (opcional)</label>
        <textarea id="objetivo" rows="2">${esc(rutina?.objetivo ?? "")}</textarea>
      </div>
      <div id="ejercicios">${inicial.map((e, i) => filaEjercicio(catalogo, e, i + 1)).join("")}</div>
      <div class="error" id="err-lista" hidden></div>
      <button type="button" class="secundario" id="agregar">+ Agregar ejercicio</button>
      <div class="pie-form"><button type="submit">Guardar rutina</button></div>
    </form>`;

  const lista = $("#ejercicios", cont);
  const renumerar = () => $$("[data-num]", lista).forEach((s, i) => (s.textContent = String(i + 1)));

  $("#agregar", cont).addEventListener("click", () => {
    const previos = leerEjercicios(cont);
    const ultimo = previos[previos.length - 1];
    lista.insertAdjacentHTML("beforeend", filaEjercicio(catalogo, { dia_semana: ultimo?.dia_semana || 1 }, lista.children.length + 1));
    lista.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  lista.addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest("[data-quitar]");
    if (b) { b.closest("[data-fila]")?.remove(); renumerar(); }
  });

  const form = $<HTMLFormElement>("#f-rutina", cont);
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const datos: Rutina = {
      id: rutina?.id, entrenador_id: rutina?.entrenador_id ?? perfil.id,
      nombre: $<HTMLInputElement>("#nombre", cont).value, objetivo: $<HTMLTextAreaElement>("#objetivo", cont).value,
      es_plantilla: rutina?.es_plantilla ?? false, origen_id: rutina?.origen_id ?? null,
      ejercicios: leerEjercicios(cont),
    };
    const v = validarRutina(datos);

    // Repartir cada mensaje junto a su campo.
    const filas = $$("[data-fila]", lista);
    mostrarErrores($("#err-nombre", cont), v.errores.filter((e) => e.includes("Nombre de la rutina")));
    mostrarErrores($("#err-lista", cont), v.errores.filter((e) => e.includes("Lista de ejercicios")));
    filas.forEach((f, i) => mostrarErrores($("[data-err-fila]", f), v.errores
      .filter((e) => e.startsWith(`Ejercicio ${i + 1}: `)).map((e) => e.replace(/^Ejercicio \d+: /, ""))));
    if (!v.ok) { cont.querySelector<HTMLElement>(".error:not([hidden])")?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }

    try {
      await conBoton($<HTMLButtonElement>("button[type=submit]", form), () => guardarRutina(datos));
      aviso(rutina ? "Rutina actualizada." : "Rutina creada.");
      ir("rutinas");
    } catch (e) {
      mostrarErrores($("#err-lista", cont), [(e as Error).message]);   // datos capturados se conservan
    }
  });
}
