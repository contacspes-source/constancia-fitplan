/**
 * tipos/index.ts — Modelo de dominio de Constancia FitPlan.
 * Refleja el diagrama de clases de la Actividad 12 y las tablas de
 * supabase/migrations/0001_esquema.sql. Sin lógica: solo estructura.
 */

export type Rol = "ADMIN" | "ENTRENADOR" | "NUTRIOLOGO" | "CLIENTE";
export type TipoComida = "DESAYUNO" | "COLACION1" | "COMIDA" | "COLACION2" | "CENA";
export type Unidad = "G" | "ML" | "PIEZA";

export const TIPOS_COMIDA: readonly TipoComida[] = ["DESAYUNO", "COLACION1", "COMIDA", "COLACION2", "CENA"];
export const ETIQUETA_COMIDA: Record<TipoComida, string> = {
  DESAYUNO: "Desayuno", COLACION1: "Colación 1", COMIDA: "Comida", COLACION2: "Colación 2", CENA: "Cena",
};

export interface Perfil { id: string; nombre: string; correo: string; rol: Rol; activo: boolean }

export interface Cliente {
  usuario_id: string;
  entrenador_id: string | null;
  nutriologo_id: string | null;
  objetivo: string | null;
}

export interface Ejercicio {
  id: number; nombre: string; grupo_muscular: string;
  descripcion: string | null; url_demostracion: string | null; activo: boolean;
}

export interface Alimento {
  id: number; nombre: string;
  kcal_100: number; proteina_100: number; carbohidratos_100: number; grasa_100: number;
  gramos_por_pieza: number | null; activo: boolean;
}

/** Fila de RUTINA_EJERCICIO. `repeticiones` admite "12" o "10-12" (RS-01). */
export interface EjercicioRutina {
  id?: number;
  ejercicio_id: number;
  dia_semana: number;      // 1 = lunes … 7 = domingo
  series: number;          // 1..50
  repeticiones: string;    // "12" | "10-12"
  carga_kg: number;        // ≥ 0 (0 = peso corporal)
  descanso_seg: number;    // ≥ 0
  orden?: number;
}

export interface Rutina {
  id?: number; entrenador_id: string; nombre: string; objetivo: string | null;
  es_plantilla: boolean; origen_id: number | null;
  ejercicios: EjercicioRutina[];
}

export interface PorcionAlimento {
  id?: number;
  alimento_id: number | null;
  nombre_copia: string;
  cantidad: number;   // > 0
  unidad: Unidad;
}

export interface TiempoComida { id?: number; tipo: TipoComida; porciones: PorcionAlimento[] }

export interface PlanAlimenticio {
  id?: number; nutriologo_id: string; nombre: string;
  es_plantilla: boolean; origen_id: number | null;
  tiempos: TiempoComida[];
}

/** Totales nutricionales calculados por el sistema (RS-02): nunca capturados. */
export interface Totales { kcal: number; proteina: number; carbohidratos: number; grasa: number }

export interface Asignacion {
  id?: number;
  cliente_id: string;
  asignado_por: string;
  rutina_id: number | null;
  plan_id: number | null;
  fecha_inicio: string;   // ISO yyyy-mm-dd
  fecha_fin: string;      // ISO yyyy-mm-dd, ≥ fecha_inicio
}

export interface RegistroCumplimiento {
  id?: number;
  cliente_id: string;
  fecha: string;
  rutina_ejercicio_id: number | null;
  tiempo_comida_id: number | null;
  completado: boolean;
  marcado_en?: string;
}

/** Resultado de una validación: lista de mensajes con el formato exigido por RS-01. */
export interface ResultadoValidacion { ok: boolean; errores: string[] }
