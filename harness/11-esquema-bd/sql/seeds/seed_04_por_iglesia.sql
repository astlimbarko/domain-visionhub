-- VisionHub -- seed_04_por_iglesia.sql
-- 14 ministerios y 4 departamentos, por cada iglesia. Los temas (cdp_tema) NO
-- se siembran aca: son 9 provisionales globales, ver seed_01.

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

INSERT INTO departamento (iglesia_id, codigo, nombre)
SELECT i.id, d.codigo, d.nombre
FROM iglesia i
CROSS JOIN (VALUES
  ('EVANGELISMO', 'Evangelismo'),
  ('AFIRMACION', 'Afirmacion'),
  ('DISCIPULADO', 'Discipulado'),
  ('ENVIO', 'Envio')
) AS d(codigo, nombre)
WHERE i.fecha_eliminacion IS NULL
  AND NOT EXISTS (SELECT 1 FROM departamento dd WHERE dd.iglesia_id = i.id AND dd.codigo = d.codigo AND dd.fecha_eliminacion IS NULL);
