# Constancia FitPlan

Plataforma web para que entrenadores y nutriólogos diseñen, asignen y den
seguimiento a programas de entrenamiento y alimentación, y para que cada
cliente vea lo que le toca hoy y registre su cumplimiento.

Proyecto integrador · Ingeniería en Software (D06, CUCEI-UDG) · Equipo GigaChads.
Especificación: ERS (Actividad 6, IEEE 830). Modelo: Actividad 12. Plan: Actividad 8.

## Arquitectura

Cliente-servidor en capas (Actividad 10 + Actividad 12 §7):

| Capa | Dónde vive | Qué contiene |
|---|---|---|
| Presentación | `src/presentacion/` (navegador) | Pantallas por rol, router, estilos |
| Negocio | `src/negocio/` (navegador, para mensajes) **y** PostgreSQL (autoridad) | Validaciones RS-01, cálculo RS-02, solapes RS-03, adherencia RS-05 |
| Datos | `src/datos/` → Supabase | Cliente, sesión, repositorios; esquema en `supabase/migrations/` |

El control de acceso por rol (RS-10, RS-13) se aplica con Row Level Security en
el servidor, independientemente de lo que muestre la interfaz.

## Estructura

```
supabase/migrations/   0001 esquema · 0002 acceso y RLS · 0003 catálogos · 0004 catálogos únicos · 0005 permisos de asignaciones
src/tipos/             modelo de dominio (diagrama de clases)
src/negocio/           lógica pura, sin UI ni red (probada en tests/)
src/datos/             acceso a Supabase y sesión
src/presentacion/      pantallas
tests/                 pruebas unitarias (vitest) — base de la Actividad 14
tests/sql/             pruebas de servidor por rol (PostgreSQL local, NO en Supabase)
docs/DECISIONES.md     registro de decisiones (ADR)
```

## Pantallas (v1.0 en construcción)

| Rol | Pantallas | Requerimientos |
|---|---|---|
| Todos | Entrar · Soy instructor (registro) · Tengo un código (activar cuenta) | RS-10, RS-03 (CU-01, CU-12) |
| Entrenador | Rutinas (crear, editar, eliminar) · Clientes (invitar, asignar rutina) | RS-01, RS-03 |
| Nutriólogo | Planes con macros en vivo · Clientes (invitar, asignar plan) | RS-02, RS-03 |
| Cliente | Hoy (iteración 3) | RS-06, RS-07 |

## Cómo trabajar

```bash
npm install
cp .env.example .env     # pegar URL y anon key del proyecto Supabase
npm run dev              # http://localhost:5173
npm run test             # pruebas unitarias
npm run typecheck
npm run build            # dist/ → Cloudflare Pages
```

Base de datos: ejecutar las migraciones de `supabase/migrations/` en orden
en el SQL Editor del proyecto (o con `supabase db push`).

## Despliegue (Cloudflare Pages)

Build command `npm run build`, output `dist`, variables de entorno
`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

## Equipo

| Integrante | Rol (ERS §1.3) |
|---|---|
| Jorge Duarte Landeros | Analista de requisitos, integración |
| Juan Pablo Eusebio Nuñez | Líder de proyecto, lógica de negocio |
| Manuel Venegas Villalobos | Frontend |
| David Rodriguez Barajas | Base de datos |
| Luis Angel Amaya Oroz | Pruebas y calidad |
