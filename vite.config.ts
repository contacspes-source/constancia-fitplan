import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

// Frontend estático: `npm run build` genera dist/ listo para Cloudflare Pages.
// La lógica de negocio sensible y el control de acceso viven en Supabase
// (PostgreSQL + RLS), no aquí. Ver docs/DECISIONES.md (ADR-002).
export default defineConfig({
  base: "./",
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: { outDir: "dist", emptyOutDir: true, target: "es2020" },
});
