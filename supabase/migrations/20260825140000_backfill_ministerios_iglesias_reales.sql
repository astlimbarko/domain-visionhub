-- VisionHub -- 20260825140000_backfill_ministerios_iglesias_reales.sql
-- KAN-252 (seguimiento): al revisar produccion se encontro que solo 2 de las
-- 8 iglesias reales (El Eden y su satelite La Esperanza) tenian el catalogo
-- estandar de 14 ministerios cargado (seed_04_por_iglesia.sql vive en
-- harness/ como script de diseno/dev -- nunca se corrio contra las iglesias
-- reales creadas antes de existir ese seed). 4 Anillo, Apocalipsis,
-- cdv radial 26, Guabira, Genesis y Montero tenian 0. Mismo INSERT que el
-- seed original, idempotente via el indice unico (iglesia_id, codigo) WHERE
-- fecha_eliminacion IS NULL -- no duplica nada donde ya existe.
INSERT INTO ministerio (iglesia_id, codigo, nombre, orden)
SELECT i.id, m.codigo, m.nombre, m.orden
FROM iglesia i
CROSS JOIN (VALUES
  ('ALABANZA', 'Alabanza', 1),
  ('DANZA', 'Danza', 2),
  ('COMUNICACION', 'Comunicacion', 3),
  ('NINOS', 'Ninos', 4),
  ('JOVENES', 'Jovenes', 5),
  ('PROTOCOLO', 'Protocolo', 6),
  ('UJIERES', 'Ujieres', 7),
  ('PARQUEO', 'Parqueo', 8),
  ('COCINA', 'Cocina', 9),
  ('EVANGELISMO', 'Evangelismo', 10),
  ('SONIDO', 'Sonido', 11),
  ('TESTIMONIOS', 'Testimonios', 12),
  ('ESCUDEROS', 'Escuderos', 13),
  ('INTERCESION', 'Intercesion', 14)
) AS m(codigo, nombre, orden)
WHERE i.fecha_eliminacion IS NULL
ON CONFLICT (iglesia_id, codigo) WHERE fecha_eliminacion IS NULL DO NOTHING;
