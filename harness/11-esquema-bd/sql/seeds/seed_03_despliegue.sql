-- VisionHub -- seed_03_despliegue.sql
-- Cobertura + las 2 iglesias reales del despliegue. Cochabamba NO se crea todavia
-- (queda como iglesia_padre_id = NULL en ambas hasta que exista).

INSERT INTO cobertura (nombre, sede)
VALUES ('Red Apostolica del Ap. Edgar Ortuno', 'Santa Cruz de la Sierra')
ON CONFLICT DO NOTHING;

-- Iglesia madre: Santa Cruz (prefijo/sufijo, decision del owner mirar.txt #7, 2026-07-19)
INSERT INTO iglesia (prefijo, sufijo, ciudad, cobertura_id, moneda_defecto_id)
SELECT 'Centro de Vida', '4 Anillo', 'Santa Cruz de la Sierra',
       (SELECT id FROM cobertura WHERE nombre = 'Red Apostolica del Ap. Edgar Ortuno'),
       (SELECT id FROM moneda WHERE codigo = 'BOB')
WHERE NOT EXISTS (SELECT 1 FROM iglesia WHERE sufijo = '4 Anillo');

-- Iglesia hija: Montero
INSERT INTO iglesia (prefijo, sufijo, ciudad, cobertura_id, moneda_defecto_id)
SELECT 'Centro de Vida', 'Montero', 'Montero',
       (SELECT id FROM cobertura WHERE nombre = 'Red Apostolica del Ap. Edgar Ortuno'),
       (SELECT id FROM moneda WHERE codigo = 'BOB')
WHERE NOT EXISTS (SELECT 1 FROM iglesia WHERE sufijo = 'Montero');

-- BOB y USD activas para cada iglesia (mirar.txt #2: USD secundaria pero ya activa)
INSERT INTO iglesia_moneda (iglesia_id, moneda_id, activa)
SELECT i.id, m.id, true
FROM iglesia i
CROSS JOIN moneda m
WHERE i.sufijo IN ('4 Anillo', 'Montero') AND m.codigo IN ('BOB', 'USD')
  AND NOT EXISTS (SELECT 1 FROM iglesia_moneda im WHERE im.iglesia_id = i.id AND im.moneda_id = m.id);

-- NOTA: la primera iglesia se crea antes que su Pastor (ciclo 1, 04_persona.sql).
-- Pasos siguientes (manuales, fuera de este script):
--   1. Crear el usuario del Pastor en Supabase Auth.
--   2. Insertar su fila en persona con iglesia_id de la iglesia correspondiente.
--   3. UPDATE iglesia SET pastor_id = <persona.id> WHERE id = <iglesia.id>.
--   4. Bootstrap del primer SUPER_ADMIN: ver 05_funciones_acceso.sql.
