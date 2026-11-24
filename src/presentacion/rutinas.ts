/** presentacion/rutinas.ts — Gestión de rutinas del entrenador (RS-01, CU-07..CU-09). */
import { eliminarRutina, guardarRutina, listarEjercicios, listarRutinas, obtenerRutina } from "@/datos/repositorios";
import { validarEjercicio, validarRutina } from "@/negocio/validacion";
import type { Ejercicio, EjercicioRutina, Perfil, Rutina } from "@/tipos";
import { $, avisar, cargando, confirmar, DIAS, esc, mostrarErrores } from "./ui";

export async function vistaRutinas(cont: HTMLElement, perfil: Perfil) {
  cargando(cont);
  try {
    const rutinas = await listarRutinas();
    cont.innerHTML = `
      <div class="fila-titulo"><h2>Mis rutinas</h2><button id="nueva">+ Nueva rutina</button></div>
      ${rutinas.length === 0 ? `<p class="vacio">Aún no tienes rutinas. Crea la primera para poder asignarla.</p>` : ""}
      ${rutinas.map(r => `
        <div class="tarjeta item">
          <div>
            <strong>${esc(r.nombre)}</strong>
            <div class="sub">${r.ejercicios} ejercicio${r.ejercicios === 1 ? "" : "s"}${r.objetivo ? " · " + esc(r.objetivo) : ""}</div>
          </div>
          <div class="acciones">
            <button class="secundario chico" data-editar="${r.id}">Editar</button>
            <button class="peligro chico" data-eliminar="${r.id}" data-nombre="${esc(r.nombre)}">Eliminar</button>
          </div>
        </div>`).join("")}`;
    $(cont, "#nueva").addEventListener("click", () => void editorRutina(cont, perfil));
    cont.querySelectorAll<HTMLButtonElement>("[data-editar]").forEach(b =>
      b.addEventListener("click", () => void editorRutina(cont, perfil, Number(b.dataset.editar))));
    cont.querySelectorAll<HTMLButtonElement>("[data-eliminar]").forEach(b =>
      b.addEventListener("click", async () => {
        const ok = await confirmar(`¿Está seguro de eliminar la rutina '${b.dataset.nombre}'? Esta acción no se puede deshacer.`);
        if (!ok) return;
        try { await eliminarRutina(Number(b.dataset.eliminar)); avisar("Rutina eliminada."); void vistaRutinas(cont, perfil); }
        catch (e) { avisar((e as Error).message, "error"); }
      }));
  } catch (e) { cont.innerHTML = `<p class="error">${esc((e as Error).message)}</p>`; }
}

function filaVacia(dia = 1): EjercicioRutina {
  return { ejercicio_id: 0, dia_semana: dia, series: 3, repeticiones: "10-12", carga_kg: 0, descanso_seg: 60 };
}

async function editorRutina(cont: HTMLElement, perfil: Perfil, id?: number) {
  cargando(cont);
  let catalogo: Ejercicio[]; let rutina: Rutina;
  try {
    [catalogo, rutina] = await Promise.all([
      listarEjercicios(),
      id !== undefined ? obtenerRutina(id)
        : Promise.resolve<Rutina>({ entrenador_id: perfil.id, nombre: "", objetivo: null, es_plantilla: false, origen_id: null, ejercicios: [] }),
    ]);
  } catch (e) { cont.innerHTML = `<p class="error">${esc((e as Error).message)}</p>`; return; }

  const grupos = [...new Set(catalogo.map(e => e.grupo_muscular))];
  const opcionesEjercicio = (sel: number) => `<option value="0">— Selecciona —</option>` + grupos.map(g =>
    `<optgroup label="${esc(g)}">${catalogo.filter(e => e.grupo_muscular === g).map(e =>
      `<option value="${e.id}" ${e.id === sel ? "selected" : ""}>${esc(e.nombre)}</option>`).join("")}</optgroup>`).join("");

  cont.innerHTML = `
    <div class="fila-titulo"><h2>${id ? "Editar rutina" : "Nueva rutina"}</h2><button class="secundario chico" id="cancelar">Volver</button></div>
    <div class="tarjeta">
      <label for="r-nombre">Nombre de la rutina</label>
      <input id="r-nombre" maxlength="100" value="${esc(rutina.nombre)}" />
      <div class="error" id="e-nombre" hidden></div>
      <label for="r-objetivo">Descripción / objetivo (opcional)</label>
      <textarea id="r-objetivo" rows="2">${esc(rutina.objetivo ?? "")}</textarea>
    </div>
    <h3>Semana</h3>
    <p class="sub">Los días sin ejercicios son días de descanso: el cliente verá "Hoy es día de descanso programado".</p>
    <div class="resumen-semana" id="resumen"></div>
    <div id="filas"></div>
    <div class="error" id="e-lista" hidden></div>
    <div class="error caja" id="e-general" hidden></div>
    <div class="barra-guardar"><button id="guardar">Guardar rutina</button></div>`;

  const filas = $(cont, "#filas");
  const leerFila = (div: HTMLElement): EjercicioRutina => {
    const v = (n: string) => div.querySelector<HTMLInputElement>(`[name=${n}]`)!.value.trim();
    const num = (n: string) => v(n) === "" ? NaN : Number(v(n));
    return {
      id: div.dataset.id ? Number(div.dataset.id) : undefined,
      ejercicio_id: Number(v("ejercicio_id")), dia_semana: Number(div.dataset.dia),
      series: num("series"), repeticiones: v("repeticiones"), carga_kg: num("carga_kg"), descanso_seg: num("descanso_seg"),
    };
  };
  // El orden del DOM (por día) es el orden de la lista: los índices coinciden.
  const leerTodas = () => [...filas.querySelectorAll<HTMLElement>(".fila-ej")].map(leerFila);

  const pintar = (entrada: EjercicioRutina[]) => {
    const lista = [...entrada].sort((a, b) => a.dia_semana - b.dia_semana);
    let n = 0;
    $(cont, "#resumen").innerHTML = DIAS.slice(1).map((d, k) => {
      const cuantos = lista.filter(e => e.dia_semana === k + 1).length;
      return `<a href="#dia-${k + 1}" class="chip ${cuantos ? "entrena" : "descansa"}" title="${d}">${d.slice(0, 2)}<small>${cuantos || "😴"}</small></a>`;
    }).join("");
    filas.innerHTML = DIAS.slice(1).map((nombreDia, k) => {
      const dia = k + 1;
      const delDia = lista.filter(e => e.dia_semana === dia);
      return `
      <div class="tarjeta dia ${delDia.length ? "" : "dia-descanso"}" id="dia-${dia}">
        <div class="fila-titulo">
          <h3>${nombreDia}</h3>
          ${delDia.length ? `<span class="sub">${delDia.length} ejercicio${delDia.length === 1 ? "" : "s"}</span>` : `<span class="etiqueta">😴 Descanso</span>`}
        </div>
        ${delDia.map(e => { const i = n++; return `
        <div class="fila-ej" data-dia="${dia}" ${e.id !== undefined ? `data-id="${e.id}"` : ""}>
          <div class="fila-titulo">
            <select name="ejercicio_id" aria-label="Ejercicio">${opcionesEjercicio(e.ejercicio_id)}</select>
            <button class="enlace peligro-txt" data-quitar="${i}" aria-label="Quitar ejercicio">Quitar</button>
          </div>
          <div class="rejilla">
            <div><label>Series (1-50)</label><input name="series" type="number" inputmode="numeric" min="1" max="50" step="1" value="${Number.isNaN(e.series) ? "" : e.series}" /></div>
            <div><label>Repeticiones</label><input name="repeticiones" placeholder="12 o 10-12" value="${esc(e.repeticiones)}" /></div>
            <div><label>Carga (kg)</label><input name="carga_kg" type="number" inputmode="decimal" min="0" step="0.5" value="${Number.isNaN(e.carga_kg) ? "" : e.carga_kg}" /></div>
            <div><label>Descanso (s)</label><input name="descanso_seg" type="number" inputmode="numeric" min="0" step="5" value="${Number.isNaN(e.descanso_seg) ? "" : e.descanso_seg}" /></div>
          </div>
          <div class="error" data-err hidden></div>
        </div>`; }).join("")}
        <div class="acciones">
          <button class="secundario chico" data-agregar="${dia}">+ Ejercicio</button>
          ${delDia.length ? `<button class="enlace" data-descanso="${dia}">Hacer día de descanso</button>` : ""}
        </div>
      </div>`;
    }).join("");
    filas.querySelectorAll<HTMLButtonElement>("[data-quitar]").forEach(b => b.addEventListener("click", () => {
      const l = leerTodas(); l.splice(Number(b.dataset.quitar), 1); pintar(l);
    }));
    filas.querySelectorAll<HTMLButtonElement>("[data-agregar]").forEach(b => b.addEventListener("click", () => {
      const dia = Number(b.dataset.agregar);
      const l = leerTodas(); l.push(filaVacia(dia)); pintar(l);
      const ultimos = filas.querySelectorAll<HTMLElement>(`.fila-ej[data-dia="${dia}"]`);
      ultimos[ultimos.length - 1]?.querySelector("select")?.focus();
    }));
    filas.querySelectorAll<HTMLButtonElement>("[data-descanso]").forEach(b => b.addEventListener("click", async () => {
      const dia = Number(b.dataset.descanso);
      if (!await confirmar(`¿Quitar todos los ejercicios del ${DIAS[dia].toLowerCase()} y dejarlo como día de descanso?`, "Hacer descanso")) return;
      pintar(leerTodas().filter(e => e.dia_semana !== dia));
    }));
  };
  pintar(rutina.ejercicios);

  $(cont, "#cancelar").addEventListener("click", () => void vistaRutinas(cont, perfil));

  $(cont, "#guardar").addEventListener("click", async () => {
    const r: Rutina = { ...rutina, nombre: $<HTMLInputElement>(cont, "#r-nombre").value, objetivo: $<HTMLTextAreaElement>(cont, "#r-objetivo").value, ejercicios: leerTodas() };
    const res = validarRutina(r);
    // Mensajes junto al campo que los origina (ERS §3.1.1): nombre, lista y cada ejercicio.
    const errNombre = res.errores.filter(m => m.includes("Nombre de la rutina"));
    mostrarErrores($(cont, "#e-nombre"), errNombre);
    mostrarErrores($(cont, "#e-lista"), res.errores.filter(m => m.includes("Lista de ejercicios")));
    filas.querySelectorAll<HTMLElement>(".fila-ej").forEach((div, i) =>
      mostrarErrores(div.querySelector<HTMLElement>("[data-err]")!, validarEjercicio(r.ejercicios[i])));
    mostrarErrores($(cont, "#e-general"), []);
    if (!res.ok) { avisar("Hay campos por corregir.", "error"); return; }
    const btn = $<HTMLButtonElement>(cont, "#guardar"); btn.disabled = true;
    try { await guardarRutina(r); avisar("Rutina guardada."); void vistaRutinas(cont, perfil); }
    catch (e) { mostrarErrores($(cont, "#e-general"), [(e as Error).message]); btn.disabled = false; }
  });
}

