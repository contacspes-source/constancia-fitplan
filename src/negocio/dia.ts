/**
 * negocio/dia.ts — Lógica de la vista del día del cliente (RS-06, RS-07).
 * Tipos de la respuesta de vista_del_dia() y cálculos de presentación sin UI.
 */
import type { Alimento, PorcionAlimento, TipoComida, Totales, Unidad } from "@/tipos";
import { aportePorcion, sumarTotales } from "./nutricion";

export interface EjercicioDelDia {
  id: number; nombre: string; grupo_muscular: string | null; descripcion: string | null; url_demostracion: string | null;
  series: number; repeticiones: string; carga_kg: number; descanso_seg: number; completado: boolean;
}

export interface PorcionDelDia {
  nombre: string; cantidad: number; unidad: Unidad;
  alimento: (Omit<Alimento, "activo"> & { activo?: boolean }) | null;
}

export interface ComidaDelDia { id: number; tipo: TipoComida; completado: boolean; porciones: PorcionDelDia[] }

export interface VistaDelDia {
  fecha: string; dia_semana: number; tiene_programa: boolean;
  rutina: string | null; plan: string | null;
  ejercicios: EjercicioDelDia[]; comidas: ComidaDelDia[];
}

/** Estado de la pantalla según RS-06: sin programa, día de descanso o con actividades. */
export type EstadoDia = "SIN_PROGRAMA" | "DESCANSO" | "ACTIVO";

export function estadoDelDia(v: Pick<VistaDelDia, "tiene_programa" | "ejercicios" | "comidas">): EstadoDia {
  if (!v.tiene_programa) return "SIN_PROGRAMA";
  return v.ejercicios.length + v.comidas.length === 0 ? "DESCANSO" : "ACTIVO";
}

export interface Progreso { total: number; hechos: number; porcentaje: number }

export function progresoDelDia(v: Pick<VistaDelDia, "ejercicios" | "comidas">): Progreso {
  const items = [...v.ejercicios, ...v.comidas];
  const hechos = items.filter((i) => i.completado).length;
  return { total: items.length, hechos, porcentaje: items.length ? Math.round((hechos / items.length) * 100) : 0 };
}

/** Totales de una comida con el mismo cálculo que usa el nutriólogo (RS-02). */
export function totalesComida(c: ComidaDelDia): Totales {
  return sumarTotales(c.porciones.map((p) => {
    const a = p.alimento ? { ...p.alimento, activo: true,
      kcal_100: Number(p.alimento.kcal_100), proteina_100: Number(p.alimento.proteina_100),
      carbohidratos_100: Number(p.alimento.carbohidratos_100), grasa_100: Number(p.alimento.grasa_100),
      gramos_por_pieza: p.alimento.gramos_por_pieza === null ? null : Number(p.alimento.gramos_por_pieza) } as Alimento : null;
    const porcion: PorcionAlimento = { alimento_id: a?.id ?? null, nombre_copia: p.nombre, cantidad: Number(p.cantidad), unidad: p.unidad };
    return aportePorcion(porcion, a);
  }));
}

export function textoCarga(kg: number): string {
  return Number(kg) === 0 ? "Peso corporal" : `${Number(kg).toLocaleString("es-MX")} kg`;
}

export function textoDescanso(seg: number): string {
  if (seg <= 0) return "Sin descanso";
  const m = Math.floor(seg / 60), s = seg % 60;
  if (m === 0) return `${s} s`;
  return s === 0 ? `${m} min` : `${m} min ${s} s`;
}

export function textoPorcion(p: Pick<PorcionDelDia, "cantidad" | "unidad">): string {
  const n = Number(p.cantidad).toLocaleString("es-MX");
  if (p.unidad === "PIEZA") return `${n} ${Number(p.cantidad) === 1 ? "pieza" : "piezas"}`;
  return `${n} ${p.unidad === "G" ? "g" : "ml"}`;
}
