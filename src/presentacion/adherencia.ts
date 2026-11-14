/**
 * presentacion/adherencia.ts — Panel de adherencia del instructor (RS-05, CU-06).
 * Ventanas fijas de 7 y 30 días; clientes ordenados de menor a mayor adherencia
 * para detectar primero a los que están en riesgo de abandonar.
 */
import { obtenerAdherencia } from "@/datos/dia";
import { ordenarPorRiesgo, textoAdherencia, type Ventana } from "@/negocio/adherencia";
import type { Contexto } from "./app";
import { $$, cargando, esc } from "./dom";

let ventana: Ventana = 7;

function nivel(a: number | null): string {
  if (a === null) return "nd";
  return a < 50 ? "bajo" : a < 80 ? "medio" : "alto";
}

export async function pantallaAdherencia(ctx: Contexto) {
  const { cont } = ctx;
  cargando(cont, "Calculando adherencia…");
  const filas = ordenarPorRiesgo(await obtenerAdherencia(ventana));
  cont.innerHTML = `
    <div class="encabezado">
      <h2>Adherencia</h2>
      <div class="pestanas compactas" role="tablist">
        ${[7, 30].map((d) => `<button role="tab" data-v="${d}" aria-selected="${d === ventana}">${d} días</button>`).join("")}
      </div>
    </div>
    <p class="ayuda">Ejercicios y comidas completados entre los programados en los últimos ${ventana} días. Los clientes con menor cumplimiento aparecen primero.</p>
    ${filas.length === 0 ? `<div class="tarjeta vacio">Aún no tienes clientes en tu cartera.</div>` : filas.map((f) => `
      <div class="tarjeta adh adh-${nivel(f.adherencia)}">
        <div class="fila-lista">
          <strong>${esc(f.nombre)}</strong>
          <span class="adh-valor">${textoAdherencia(f.adherencia)}</span>
        </div>
        ${f.adherencia === null
          ? `<div class="meta">No se puede determinar: no tuvo ejercicios ni comidas programados en esta ventana.</div>`
          : `<div class="barra-progreso"><div style="width:${f.adherencia}%"></div></div>
             <div class="meta">${f.completados} de ${f.programados} completados</div>`}
      </div>`).join("")}`;

  $$<HTMLButtonElement>("[data-v]", cont).forEach((b) => b.addEventListener("click", () => {
    ventana = Number(b.dataset.v) as Ventana;
    void pantallaAdherencia(ctx);
  }));
}
