-- ============================================================================
-- Constancia FitPlan · Migración 0003 · Catálogos base (RS-09, RS-02)
-- Conjunto inicial de uso frecuente (T3.2 de la Actividad 8). El mantenimiento
-- posterior corresponde al rol ADMIN. Valores nutricionales por 100 g/ml,
-- aproximados a partir de tablas de composición de alimentos de uso general.
-- ============================================================================

insert into ejercicio (nombre, grupo_muscular, descripcion) values
  ('Sentadilla con barra',        'Piernas',   'Barra en la espalda alta; baja hasta que el muslo quede paralelo al piso, rodillas alineadas con la punta del pie.'),
  ('Peso muerto convencional',    'Espalda',   'Barra pegada a las espinillas; espalda neutra; extiende cadera y rodilla a la vez.'),
  ('Press de banca',              'Pecho',     'Escápulas retraídas, pies firmes; baja la barra a la altura del pecho y empuja.'),
  ('Press militar',               'Hombro',    'De pie o sentado; barra desde la clavícula hasta la extensión completa sin arquear la espalda.'),
  ('Dominadas',                   'Espalda',   'Agarre prono; sube hasta que la barbilla supere la barra; baja controlado.'),
  ('Remo con barra',              'Espalda',   'Torso inclinado 45°; lleva la barra al abdomen bajo manteniendo la espalda neutra.'),
  ('Zancadas',                    'Piernas',   'Paso largo al frente; rodilla trasera cerca del piso; empuja con el talón delantero.'),
  ('Prensa de piernas',           'Piernas',   'Pies a la anchura de hombros; baja hasta 90° sin despegar la cadera del respaldo.'),
  ('Curl de bíceps con mancuerna','Brazo',     'Codos fijos al costado; sube sin balancear el torso.'),
  ('Extensión de tríceps en polea','Brazo',    'Codos pegados al cuerpo; extiende completamente y regresa controlado.'),
  ('Elevaciones laterales',       'Hombro',    'Brazos casi rectos; sube hasta la altura del hombro sin encoger los trapecios.'),
  ('Plancha abdominal',           'Core',      'Antebrazos en el piso; cuerpo en línea recta; respira sin dejar caer la cadera.'),
  ('Hip thrust',                  'Glúteo',    'Espalda alta apoyada en banco; empuja la cadera hasta alinear tronco y muslo.'),
  ('Caminata en caminadora',      'Cardio',    'Ritmo que permita hablar; registrar los minutos en "repeticiones".'),
  ('Burpees',                     'Cardio',    'Sentadilla, plancha, flexión, salto. Mantener la técnica aunque baje la velocidad.');

insert into alimento (nombre, kcal_100, proteina_100, carbohidratos_100, grasa_100, gramos_por_pieza) values
  ('Pechuga de pollo (cocida)',   165, 31.0,  0.0,  3.6, null),
  ('Huevo entero',                155, 13.0,  1.1, 11.0, 50),
  ('Clara de huevo',               52, 11.0,  0.7,  0.2, 33),
  ('Arroz blanco (cocido)',       130,  2.7, 28.0,  0.3, null),
  ('Avena (en hojuelas, cruda)',  389, 16.9, 66.0,  6.9, null),
  ('Tortilla de maíz',            218,  5.7, 44.6,  2.9, 30),
  ('Frijoles negros (cocidos)',   132,  8.9, 23.7,  0.5, null),
  ('Plátano',                      89,  1.1, 22.8,  0.3, 120),
  ('Manzana',                      52,  0.3, 13.8,  0.2, 180),
  ('Leche entera',                 61,  3.2,  4.8,  3.3, null),
  ('Yogur griego natural',         59, 10.0,  3.6,  0.4, null),
  ('Atún en agua (escurrido)',    116, 25.5,  0.0,  0.8, null),
  ('Salmón (cocido)',             206, 22.0,  0.0, 12.0, null),
  ('Aguacate',                    160,  2.0,  8.5, 14.7, 150),
  ('Aceite de oliva',             884,  0.0,  0.0,100.0, null),
  ('Almendras',                   579, 21.2, 21.6, 49.9, 1.2),
  ('Pan integral',                247, 13.0, 41.0,  4.2, 30),
  ('Papa (cocida)',                87,  1.9, 20.1,  0.1, null),
  ('Brócoli (cocido)',             35,  2.4,  7.2,  0.4, null),
  ('Proteína en polvo (whey)',    400, 80.0, 10.0,  5.0, 30);
