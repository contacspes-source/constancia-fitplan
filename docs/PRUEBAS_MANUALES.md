# Pruebas manuales de punta a punta — Constancia FitPlan v1.0

Guion para probar la interfaz contra el proyecto Supabase real antes de la
entrega (base de la Actividad 14). Marcar cada casilla y anotar defectos.

## 0. Preparación

- [X] Migraciones 0001 a 0006 aplicadas en orden (ya lo están en el proyecto real).
- [ ] Migración **0007_adherencia_por_area** aplicada (nueva, para la prueba 6.1).
- [ ] `.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`; `npm run dev`.
- [ ] Supabase → Authentication → Sign In / Providers → Email: decidir si
      **Confirm email** está activo. Si lo está, cada cuenta nueva debe
      confirmar su correo antes de entrar (la app lo indica). Para la demo es
      más ágil desactivarlo.
- [ ] Tener a mano 4 correos de prueba: entrenador, nutriólogo, cliente A, cliente B.

## 1. Cuentas (RS-10, CU-01, CU-12)

| # | Paso | Resultado esperado |
|---|---|---|
| 1.1 | "Soy entrenador o nutriólogo" → crear cuenta de **entrenador** | Entra al panel con pestañas Clientes / Rutinas | FUNCIONA
| 1.2 | Igual, cuenta de **nutriólogo** (otra ventana/incógnito) | Pestañas Clientes / Planes | FUNCIONA
| 1.3 | Login con contraseña incorrecta | "El correo o la contraseña no son válidos." (no dice cuál) | no dice si la contrasñea o el correo es la que esta mal, funciona, y de paso se me olvido una que puse jeje
| 1.4 | Registro con contraseña de 5 caracteres | Mensaje de mínimo 8, no se envía | FUNCIONA 

## 2. Entrenador (RS-01, RS-03)

| # | Paso | Resultado esperado |
|---|---|---|
| 2.1 | Clientes → Invitar: nombre + correo del cliente A | Aparece en "Invitaciones pendientes" con código de 64 caracteres y vencimiento a 72 h | FUNCIONA
| 2.2 | Rutinas → Nueva: nombre "ab", sin ejercicio elegido, series 0, reps "abc" | Mensajes "Error de validación: El campo … debe ser … Por favor corregir antes de guardar." junto a cada campo; no se guarda y los datos siguen en pantalla | FUNCIONA 
| 2.3 | Nueva rutina: la semana aparece con los 7 días en "😴 Descanso". Con "+ Ejercicio" agregar uno en el día de hoy y otro en otro día. Guardar | Arriba, los chips muestran en verde los 2 días con ejercicio y 😴 en los demás; en "Mis rutinas" dice "2 ejercicios" |
| 2.4 | Editar la rutina: cambiar series y agregar un ejercicio | Se guarda; al volver a abrir conserva los cambios | FUNCIONA 
| 2.5 | Eliminar una rutina **no** asignada | Modal: "¿Está seguro de eliminar la rutina '…'? Esta acción no se puede deshacer." | FUNCIONA 

## 3. Cliente A (RS-06, RS-07, CU-12)

| # | Paso | Resultado esperado |
|---|---|---|
| 3.1 | Copiar enlace de la invitación (2.1) y abrirlo en incógnito | Pantalla "Activar mi cuenta" con el código ya capturado | FUNCIONA 
| 3.2 | Activar con un correo **distinto** al invitado | "El código de invitación no corresponde a esta cuenta." y entra a la pantalla de código | FUNCIONA
| 3.3 | Activar con el correo correcto | Entra directo a **Hoy** (0 clics, RS-14) | FUNCIONA
| 3.4 | Sin asignación vigente | "No tienes ningún programa vigente… Contacta a tu entrenador" | FUNCIONA

## 4. Asignar y cumplir (RS-03, RS-06, RS-07)

| # | Paso | Resultado esperado |
|---|---|---|
| 4.1 | Entrenador → Asignar la rutina al cliente A, fin **antes** del inicio | "La fecha de fin debe ser igual o posterior…" | FUNCIONA 
| 4.2 | Asignar hoy → +30 días | Aparece como "vigente" bajo el cliente | FUNCIONA 
| 4.3 | Asignar otra rutina que se traslape | Rechazo indicando la asignación en conflicto (fechas) | FUNCIONA
| 4.4 | Cliente A recarga Hoy | Ve los ejercicios del día de hoy con series × reps, carga, descanso | FUNCIONA
| 4.5 | Marcar 1 ejercicio, recargar | Sigue marcado; contador "1 / N" | FUNCIONA 
| 4.6 | Desmarcar y volver a marcar varias veces rápido | No hay duplicados (en Table Editor: 1 fila en `registro_cumplimiento`) y `marcado_en` cambia | FUNCIONA 
| 4.7 | Con un cliente **sin plan alimenticio** y con rutina vigente: editar esa rutina y en el día de hoy dar clic en "Hacer día de descanso". Guardar. El cliente recarga Hoy | "Hoy es día de descanso programado. ¡Recupera energías!" |

## 5. Nutriólogo (RS-02)

| # | Paso | Resultado esperado |
|---|---|---|
| 5.1 | Invitar al **cliente A** (mismo correo) | Código emitido |  funciona
| 5.2 | Cliente A → Hoy → "Tengo un código de otro instructor" → pegar | "Código activado"; el cliente queda con entrenador y nutriólogo | funciona 
| 5.3 | Planes → Nuevo: agregar huevo 3 piezas, pollo 150 g | Totales por tiempo y del día se actualizan al teclear | funciona
| 5.4 | Pollo en "pieza(s)" | Error: no se mide por pieza | funciona
| 5.5 | Guardar y asignar al cliente A | Cliente ve la sección Alimentación con totales y puede marcar cada tiempo | funciona

## 6. Adherencia (RS-05)

| # | Paso | Resultado esperado |
|---|---|---|
| 6.1 | Entrenador → Clientes → Adherencia 7 días (requiere 0007) | Cada cliente muestra **Entrenamiento** y **Alimentación** por separado, más el total. El entrenador ve primero entrenamiento; el nutriólogo, alimentación. La lista se ordena por esa área | FUNCIONA (repetida tras aplicar 0007) funciona, pero suma el total de todos, cuando lo interesante es ver independiente lo de cada uno, lo del instructor y lo del nutriologo, no todo junto
| 6.2 | Invitar y activar cliente B sin asignación | B aparece al final con "No determinable" (nunca 0 %) | funciona 
| 6.3 | Cambiar a 30 días | Cuenta el último mes en vez de la última semana. Con datos de pocos días los porcentajes pueden salir **iguales**: es normal. Lo que sí debe crecer es "X de **N** completados" si la asignación empezó hace más de 7 días | no se que tiene que recalcular 

## 7. Seguridad (RS-10, RS-13)

| # | Paso | Resultado esperado |
|---|---|---|
| 7.1 | Cliente B no ve nada de cliente A (Hoy vacío) | Correcto | funciona 
| 7.2 | En la ventana del **cliente B**: F12 → pestaña **Console** → pegar `(await import('/src/datos/supabase.ts')).supabase.from('registro_cumplimiento').select('*').then(r => console.log(r.data))` y Enter (si Chrome pide escribir "allow pasting", escribirlo y volver a pegar) | Sale `[]` o solo filas de B: **ninguna** de las marcas de A, aunque se pidió "todo" | FUNCIONA: 3 filas propias, 0 ajenas
| 7.3 | En la ventana del **nutriólogo**: F12 → Console → pegar `(await import('/src/datos/supabase.ts')).supabase.from('rutina').update({ nombre: 'hackeada' }).neq('id', 0).select().then(r => console.log(r.data, r.error))` | Sale `[]` (0 rutinas modificadas). En la pestaña Rutinas del entrenador, los nombres siguen igual | FUNCIONA: `[] null`, 0 rutinas modificadas
| 7.4 | Dejar la sesión 30 min inactiva | Regresa al login | ok

## 8. Despliegue

- [ ] `npm run build` sin errores; publicar `dist/` en Cloudflare Pages con las dos variables de entorno.
- [ ] Supabase → Authentication → URL Configuration: agregar la URL de Pages como Site URL / Redirect URL (para los correos de confirmación).
- [ ] Repetir 1.1, 3.3 y 4.5 en la URL publicada, desde un celular (360 px, RS-16).
