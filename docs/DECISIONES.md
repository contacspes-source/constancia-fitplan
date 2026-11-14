# Registro de decisiones de arquitectura (ADR) — Constancia FitPlan

Formato: contexto, decisión, consecuencias. Una entrada por decisión que
cambia el rumbo del proyecto. Se referencia desde la presentación final
(Actividad 13, punto "Evolución y desarrollo").

## ADR-001 · Construir desde cero sobre la ERS, no sobre la app personal (7 nov 2026)

**Contexto.** La Actividad 10 documentó una arquitectura en capas sobre una
app personal preexistente (TypeScript + Vite, datos en el navegador). La
Actividad 12 ya señaló (sección 7) que ese esquema no puede cumplir RS-10
(RBAC en servidor) ni RS-13 (aislamiento entre clientes), y modeló el sistema
como cliente-servidor con base relacional. Además, el código de esa app
no existía en ninguna carpeta del equipo al momento de iniciar la construcción.

**Decisión.** Iniciar un repositorio nuevo cuyo único insumo son los
entregables de la materia: ERS (Act. 6), arquitectura en capas (Act. 10),
casos de uso, clases y modelo E-R (Act. 12) y el plan de trabajo (Act. 8).

**Consecuencias.** Trazabilidad directa requerimiento → tabla → función →
prueba. Se pierde el trabajo previo, que de todas formas no encajaba con el
modelo aprobado. La Act. 10 se cita en la presentación como etapa superada.

## ADR-002 · Supabase (PostgreSQL + Auth + RLS) como servidor; frontend estático en Cloudflare Pages

**Contexto.** La ERS exige (§2.4): cliente-servidor, lógica y validaciones en
el servidor, base relacional, contraseñas con hash robusto, TLS 1.3 y sesión
que caduca a los 30 minutos. Quedan 4 semanas y el equipo ya trabaja con
Supabase, GitHub y Cloudflare.

**Decisión.** La capa de negocio y datos vive en PostgreSQL (Supabase):
restricciones CHECK/UNIQUE para los rangos de RS-01, RS-02 y RS-07, trigger
para el no-solape de RS-03, funciones SQL para activación de cuenta y
adherencia, y políticas RLS para el RBAC. Supabase Auth cubre hash (bcrypt),
sesiones y TLS. El frontend es TypeScript + Vite publicado como archivos
estáticos; conserva una copia de las validaciones solo para mostrar mensajes
junto al campo (RS-01), nunca como única defensa.

**Consecuencias.** No se escribe un backend propio (Node/Express), lo que
ahorra ~1.5 semanas. La "lógica en el servidor" se demuestra con RLS y SQL,
no con controladores HTTP. Riesgo: el equipo debe aprender a leer políticas
RLS; mitigación: cada política lleva el requerimiento que implementa.

## ADR-003 · Adaptaciones del modelo E-R al implementarlo

1. **USUARIO → auth.users + perfil.** Supabase gestiona credenciales en su
   esquema `auth`; `perfil` conserva nombre, rol y activo. Un trigger crea el
   perfil al registrarse. Nadie puede registrarse como ADMIN desde la interfaz.
2. **INVITACION antes que CLIENTE.** En el ER, INVITACION depende de CLIENTE,
   pero el flujo de RS-03 es: el instructor captura nombre y correo → código
   de 72 h → el cliente activa su cuenta. La fila CLIENTE nace en la activación
   (`activar_invitacion`). El ER conserva la relación, invertida en el tiempo.
3. **ALIMENTO.gramos_por_pieza.** RS-02 admite porciones en piezas, pero el
   catálogo solo tenía valores por 100 g. Sin equivalencia no hay cálculo.
4. **CLIENTE.entrenador_id admite nulo.** Con el actor Nutriólogo (Act. 12 §7)
   un cliente puede ser invitado primero por su nutriólogo. Se exige al menos
   uno de los dos instructores.
5. **Fecha del servidor.** `fecha_servidor()` fija la zona America/Mexico_City;
   RS-06 y RS-07 la usan en lugar de la fecha del dispositivo.

## ADR-004 · Alcance de la versión 1.0 (entrega 6 dic 2026)

Se construyen RS-01, RS-02, RS-03, RS-06, RS-10 (Must) y RS-05, RS-07
(Should). Quedan fuera y se declaran en la presentación: RS-04 plantillas,
RS-08 historial gráfico, RS-09 material multimedia (el catálogo existe solo
como datos), CU-15 comentarios (tabla creada, sin interfaz) y la interfaz
del Administrador (catálogos por SQL). Base: priorización MoSCoW de la ERS
y modelo incremental de la Actividad 4.
