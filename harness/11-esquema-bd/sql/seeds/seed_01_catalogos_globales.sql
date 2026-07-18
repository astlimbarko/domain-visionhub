-- VisionHub -- seed_01_catalogos_globales.sql
-- Idempotente: ON CONFLICT DO UPDATE permite corregir reejecutando.

-- moneda (BOB/USD activas desde el dia uno; BRL/ARS/PYG en catalogo, se activan
-- por iglesia via iglesia_moneda cuando el Supervisor las necesite)
INSERT INTO moneda (codigo, nombre, simbolo, decimales, orden) VALUES
  ('BOB', 'Boliviano', 'Bs', 2, 1),
  ('USD', 'Dolar estadounidense', '$', 2, 2),
  ('BRL', 'Real brasileno', 'R$', 2, 3),
  ('ARS', 'Peso argentino', '$', 2, 4),
  ('PYG', 'Guarani paraguayo', '₲', 0, 5)
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, simbolo = EXCLUDED.simbolo, decimales = EXCLUDED.decimales;

-- cargo (21). SUPERVISOR_VISION_ACCION unifica el codigo con el front (decision
-- del owner, PENDIENTES.md #9).
INSERT INTO cargo (codigo, nombre, tipo, nivel, orden) VALUES
  ('APOSTOL', 'Apostol', 'A', 'IGLESIA', 1),
  ('PASTOR', 'Pastor', 'A', 'IGLESIA', 2),
  ('PROFETA', 'Profeta', 'A', 'IGLESIA', 3),
  ('EVANGELISTA', 'Evangelista', 'A', 'IGLESIA', 4),
  ('MAESTRO', 'Maestro', 'A', 'IGLESIA', 5),
  ('MINISTRO', 'Ministro', 'A', 'IGLESIA', 6),
  ('ANCIANO', 'Anciano', 'A', 'IGLESIA', 7),
  ('DIACONO', 'Diacono', 'A', 'IGLESIA', 8),
  ('SUPERVISOR_VISION_ACCION', 'Supervisor de la Vision en Accion', 'B', 'VISION', 9),
  ('ENCARGADO_DEPARTAMENTOS_VISION', 'Encargado de Departamentos (Vision)', 'B', 'VISION', 10),
  ('ENCARGADO_MINISTERIOS_VISION', 'Encargado General de Ministerios (Vision)', 'B', 'VISION', 11),
  ('LIDER_RED', 'Lider de Red', 'B', 'RED', 12),
  ('SUBLIDER_RED', 'Sublider de Red', 'B', 'RED', 13),
  ('ENCARGADO_DEPARTAMENTOS_RED', 'Encargado de Departamentos de Red', 'B', 'RED', 14),
  ('ENCARGADO_MINISTERIO_RED', 'Encargado de Ministerio de Red', 'B', 'RED', 15),
  ('LIDER_CDP', 'Lider de Casa de Paz', 'B', 'CDP', 16),
  ('SUBLIDER_CDP', 'Sublider de Casa de Paz', 'B', 'CDP', 17),
  ('LIDER_MINISTERIO', 'Lider de Ministerio', 'B', 'IGLESIA', 18),
  ('LIDER_DEPARTAMENTO', 'Lider de Departamento', 'B', 'IGLESIA', 19),
  ('OPERADOR', 'Operador', 'B', 'IGLESIA', 20),
  ('ANFITRION', 'Anfitrion', 'B', 'CDP', 21)
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, tipo = EXCLUDED.tipo, nivel = EXCLUDED.nivel;

-- estado (6). DA y DI inactivos (Modulo 4).
INSERT INTO estado (sigla, nombre, orden, activo) VALUES
  ('SIM', 'Simpatizante', 1, true),
  ('NC', 'Nuevo Convertido', 2, true),
  ('CRE', 'Creyente', 3, true),
  ('RE', 'Reconciliado', 4, true),
  ('DA', 'Discipulo Activo', 5, false),
  ('DI', 'Discipulo Inactivo', 6, false)
ON CONFLICT (sigla) DO UPDATE SET nombre = EXCLUDED.nombre, orden = EXCLUDED.orden, activo = EXCLUDED.activo;

-- tipo_relacion (12). cuenta_para_familia se movio a configuracion_valor (seed_02).
INSERT INTO tipo_relacion (codigo, nombre, orden) VALUES
  ('CONYUGE', 'Conyuge', 1),
  ('PADRE', 'Padre/Madre', 2),
  ('HIJO', 'Hijo/Hija', 3),
  ('ABUELO', 'Abuelo/Abuela', 4),
  ('NIETO', 'Nieto/Nieta', 5),
  ('HERMANO', 'Hermano/Hermana', 6),
  ('TIO', 'Tio/Tia', 7),
  ('SOBRINO', 'Sobrino/Sobrina', 8),
  ('PRIMO', 'Primo/Prima', 9),
  ('CUNADO', 'Cunado/Cunada', 10),
  ('SUEGRO', 'Suegro/Suegra', 11),
  ('YERNO', 'Yerno/Nuera', 12)
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, orden = EXCLUDED.orden;

UPDATE tipo_relacion t SET inverso_id = i.id
FROM tipo_relacion i
WHERE (t.codigo, i.codigo) IN (
  ('PADRE','HIJO'), ('HIJO','PADRE'), ('ABUELO','NIETO'), ('NIETO','ABUELO'),
  ('CONYUGE','CONYUGE'), ('HERMANO','HERMANO'), ('PRIMO','PRIMO'),
  ('TIO','SOBRINO'), ('SOBRINO','TIO'), ('CUNADO','CUNADO'),
  ('SUEGRO','YERNO'), ('YERNO','SUEGRO')
);

-- Se agrega recien aqui (no en 09_parentela.sql): NOT VALID no exime a los
-- INSERT nuevos, solo a las filas ya existentes al momento del ALTER. Con los
-- inversos ya enlazados arriba, se puede validar de una sola vez.
ALTER TABLE tipo_relacion ADD CONSTRAINT chk_tipo_relacion_inverso CHECK (inverso_id IS NOT NULL);

-- tipo_telefono (5)
INSERT INTO tipo_telefono (codigo, nombre, orden) VALUES
  ('CELULAR', 'Celular', 1),
  ('WHATSAPP', 'WhatsApp', 2),
  ('CASA', 'Casa', 3),
  ('TRABAJO', 'Trabajo', 4),
  ('OTRO', 'Otro', 5)
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, orden = EXCLUDED.orden;

-- motivo_llegada (5)
INSERT INTO motivo_llegada (codigo, nombre, orden) VALUES
  ('INVITACION_PERSONAL', 'Invitacion personal', 1),
  ('EVANGELISMO', 'Evangelismo', 2),
  ('REDES_SOCIALES', 'Redes sociales', 3),
  ('VISITA_CASA_DE_PAZ', 'Visita a Casa de Paz', 4),
  ('OTRO', 'Otro', 5)
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, orden = EXCLUDED.orden;

-- cdp_libro (7). Los 7 tomos existen; solo los 3 primeros tienen temas cargados (ver abajo).
INSERT INTO cdp_libro (numero, nombre, orden) VALUES
  (1, '52 Lecciones de Vida', 1), (2, '52 Lecciones de Vida', 2), (3, '52 Lecciones de Vida', 3),
  (4, '52 Lecciones de Vida', 4), (5, '52 Lecciones de Vida', 5),
  (6, '52 Lecciones de Vida', 6), (7, '52 Lecciones de Vida', 7)
ON CONFLICT (numero) WHERE fecha_eliminacion IS NULL DO NOTHING;

-- cdp_tema (9): SOLO Libros 1-3, Temas 1-3 de cada uno (provisional, PENDIENTES.md #3).
-- Ampliar los Temas 4-52 y los Libros 4-7 es un INSERT igual a este, sin migracion.
INSERT INTO cdp_tema (libro_id, numero, nombre, orden)
SELECT l.id, t.numero, 'Libro ' || l.numero || ' -- Tema ' || t.numero, t.numero
FROM cdp_libro l
CROSS JOIN (SELECT generate_series(1,3) AS numero) t
WHERE l.numero IN (1,2,3)
ON CONFLICT (libro_id, numero) WHERE iglesia_id IS NULL AND fecha_eliminacion IS NULL
  DO UPDATE SET nombre = EXCLUDED.nombre;

-- tipo_evento (8): renombres confirmados por el owner (PENDIENTES.md #4, 2026-07-17)
INSERT INTO tipo_evento (codigo, nombre, descripcion, color, orden) VALUES
  ('RMS', 'RMS (Remanente)', 'Congreso de jovenes. Evento masivo a nivel ciudad, regional o nacional.', '#8B5CF6', 1),
  ('AVIVATE', 'Avivate', 'Evento evangelistico de gran alcance, orientado a la predicacion del evangelio y la invitacion de nuevos asistentes.', '#EC4899', 2),
  ('ELITE_LINAJE_ESCOGIDO', 'Elite Linaje Escogido', 'Evento masivo dirigido al ministerio de hombres (antes llamado Hombres).', '#3B82F6', 3),
  ('MUJERES_DEL_AHORA', 'Mujeres del Ahora', 'Evento masivo dirigido al ministerio de mujeres (antes llamado Debora/Deboras).', '#F59E0B', 4),
  ('MOS', 'MOS (Movimiento Sobrenatural)', 'Evento congregacional de gran magnitud enfocado en ministracion, renovacion espiritual y crecimiento de la iglesia.', '#10B981', 5),
  ('REUNION', 'Reunion', 'Reunion general sin categoria especial.', '#6B7280', 6),
  ('MEGA_FIESTA', 'Mega Fiesta de Casa de Paz', 'Reunion especial de casas de paz a nivel de red, en lugar de la reunion semanal normal.', '#EF4444', 7),
  ('CUMPLEANOS', 'Cumpleanos', 'Generado, no registrado -- ver fn_cumpleanos_cdp.', '#F472B6', 8)
ON CONFLICT (COALESCE(iglesia_id, '00000000-0000-0000-0000-000000000000'::uuid), codigo) WHERE fecha_eliminacion IS NULL
  DO UPDATE SET nombre = EXCLUDED.nombre, descripcion = EXCLUDED.descripcion, color = EXCLUDED.color;

-- finanzas_tipo_ingreso (4)
INSERT INTO finanzas_tipo_ingreso (codigo, nombre, orden) VALUES
  ('OFRENDA', 'Ofrenda', 1),
  ('DIEZMO', 'Diezmo', 2),
  ('PRIMICIA', 'Primicia', 3),
  ('PACTO', 'Pacto', 4)
ON CONFLICT (COALESCE(iglesia_id, '00000000-0000-0000-0000-000000000000'::uuid), codigo) WHERE fecha_eliminacion IS NULL
  DO UPDATE SET nombre = EXCLUDED.nombre;
