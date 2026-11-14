/** datos/catalogos.ts — Lectura de los catálogos base (RS-09, RS-02). Solo lectura para instructores. */
import { supabase } from "./supabase";
import { exigir } from "./errores";
import type { Alimento, Ejercicio } from "@/tipos";

let cacheEj: Ejercicio[] | null = null;
let cacheAl: Alimento[] | null = null;

export async function listarEjercicios(): Promise<Ejercicio[]> {
  if (!cacheEj) cacheEj = exigir(await supabase.from("ejercicio").select("*").order("grupo_muscular").order("nombre"), "cargar el catálogo de ejercicios") as Ejercicio[];
  return cacheEj;
}

export async function listarAlimentos(): Promise<Alimento[]> {
  if (!cacheAl) {
    const filas = exigir(await supabase.from("alimento").select("*").order("nombre"), "cargar el catálogo de alimentos") as Alimento[];
    // numeric de PostgreSQL llega como texto o número según el driver: normalizar.
    cacheAl = filas.map((a) => ({ ...a,
      kcal_100: Number(a.kcal_100), proteina_100: Number(a.proteina_100),
      carbohidratos_100: Number(a.carbohidratos_100), grasa_100: Number(a.grasa_100),
      gramos_por_pieza: a.gramos_por_pieza === null ? null : Number(a.gramos_por_pieza) }));
  }
  return cacheAl;
}

export function limpiarCacheCatalogos() { cacheEj = null; cacheAl = null; }
