# Constancia FitPlan — Reporte de avance

Proyecto integrador · Ingeniería en Software (D06, CUCEI-UDG) · Equipo GigaChads
Corte: 25 de noviembre de 2026 · Entrega final: 6 de diciembre de 2026

## Dónde ver el proyecto

| Qué | Dirección |
|---|---|
| Aplicación publicada | https://constancia-fitplan.contacspes.workers.dev |
| Código fuente | https://github.com/contacspes-source/constancia-fitplan |
| Decisiones de arquitectura | `docs/DECISIONES.md` (ADR-001 a ADR-005) |
| Guion de pruebas manuales con resultados | `docs/PRUEBAS_MANUALES.md` |

## Estado general

La versión 1.0 está **construida, desplegada y probada de punta a punta** contra
la base de datos real, para el alcance acordado en el ADR-004. Cada push a
`main` vuelve a publicar la aplicación automáticamente.

## Avance por requerimiento (ERS, Actividad 6)

| Requerimiento | Prioridad | Estado |
|---|---|---|
| RS-01 Rutinas (crear, editar, eliminar, validaciones, mensajes de error con el formato de la ERS) | Must | Hecho y probado |
| RS-02 Planes alimenticios con cálculo automático de calorías y macronutrientes | Must | Hecho y probado |
| RS-03 Cartera de clientes, invitación con código de 72 h, asignaciones sin solapes | Must | Hecho y probado |
| RS-05 Panel de adherencia (7 y 30 días), ordenado de menor a mayor, "no determinable" sin programa | Should | Hecho y probado; además se desglosa por entrenamiento y alimentación |
| RS-06 Vista del Día del cliente (descanso, sin programa vigente) | Must | Hecho y probado |
| RS-07 Marcar y desmarcar cumplimiento, solo el día en curso, sin duplicados | Should | Hecho y probado |
| RS-10 / RS-13 Acceso por rol y aislamiento entre clientes (en el servidor, con RLS) | Must | Hecho y probado |
| RS-12 Credenciales con hash, sesión que caduca a los 30 min | Must | Hecho (Supabase Auth + cierre por inactividad) |
| RS-14 Cliente llega a su día sin clics adicionales | Should | Hecho |
| RS-16 Diseño adaptable desde 360 px | Should | Diseñado mobile-first; **pendiente la prueba en celular** |
| RS-04 Plantillas | Should | Fuera de la v1.0 (ADR-004) |
| RS-08 Historial gráfico | Could | Fuera de la v1.0 (ADR-004) |
| RS-09 Material multimedia | Could | Fuera de la v1.0 (el catálogo existe solo como datos) |
| CU-15 Comentarios | Could | Tabla creada, sin interfaz |
| Interfaz del Administrador | — | Fuera de la v1.0 (catálogos por SQL) |

## Pruebas

- **Automáticas:** 45 pruebas unitarias (vitest) sobre la lógica de negocio:
  validación de rutinas y planes, cálculo nutricional, solapes de asignaciones
  y adherencia. Se ejecutan con `npm run test`.
- **De servidor:** guiones SQL en `tests/sql/` que actúan como cada rol para
  comprobar políticas RLS, triggers y funciones.
- **Manuales:** `docs/PRUEBAS_MANUALES.md`, ejecutado contra el Supabase real.
  Aprobadas las secciones de cuentas, entrenador, cliente, asignaciones,
  nutriólogo, adherencia y seguridad (un cliente no ve filas de otro; un
  instructor no modifica rutinas ajenas).

### Defectos encontrados y corregidos durante las pruebas

| Defecto | Corrección |
|---|---|
| Catálogos duplicados al ejecutar dos veces el script de datos | Migración 0004: nombres únicos |
| Un instructor podía borrar o modificar asignaciones de otro (D7, D8) | Migración 0005: permisos por autor |
| El upsert de marcas no funcionaba con la API de Supabase (D11) | Migración 0006: funciones en el servidor |
| La adherencia mezclaba ejercicios y comidas en un solo número | Migración 0007: desglose por área |
| El editor de rutinas no mostraba los días de descanso | Editor reorganizado por semana |
| Publicación en blanco por variables de entorno mal capturadas | Corregidas y vueltas a compilar |

## Arquitectura (Actividades 10 y 12)

Cliente-servidor en capas. Interfaz en TypeScript + Vite publicada como sitio
estático en Cloudflare. Servidor en Supabase: PostgreSQL con restricciones,
triggers, funciones y Row Level Security. Los permisos se verifican en el
servidor y no dependen de lo que muestre la interfaz.

## Pendiente para la entrega final

1. Probar la aplicación publicada desde un celular (RS-16) y repetir las
   pruebas 1.1, 3.3 y 4.5 en esa dirección.
2. Repetir la prueba 4.7 (día de descanso) con el editor semanal nuevo.
3. Configurar en Supabase la dirección publicada (Authentication → URL Configuration).
4. Documento de pruebas (Actividad 14) y presentación final (Actividad 13).

## Cuentas para revisar la aplicación

Las cuentas de demostración no se publican en el repositorio. Se entregan por
separado. También se puede crear una cuenta propia desde la pantalla de inicio
("Soy entrenador o nutriólogo: crear cuenta"); los clientes entran con el
enlace de invitación que genera su instructor.

## Equipo

| Integrante | Rol (ERS §1.3) |
|---|---|
| Jorge Duarte Landeros | Analista de requisitos, integración |
| Juan Pablo Eusebio Nuñez | Líder de proyecto, lógica de negocio |
| Manuel Venegas Villalobos | Frontend |
| David Rodriguez Barajas | Base de datos |
| Luis Angel Amaya Oroz | Pruebas y calidad |
