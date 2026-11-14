/**
 * datos/supabase.ts — Cliente de acceso al servidor.
 * Única puerta de la capa de datos hacia Supabase (PostgreSQL + Auth).
 * Las credenciales son públicas (anon key): el acceso real lo controlan las
 * políticas RLS de supabase/migrations/0002_acceso_rls.sql (RS-10, RS-13).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anon) {
  throw new Error("Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (ver .env.example).");
}

export const supabase: SupabaseClient = createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true },
});
