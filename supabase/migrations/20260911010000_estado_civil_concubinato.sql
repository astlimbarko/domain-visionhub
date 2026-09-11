-- VisionHub -- estado_civil_concubinato.sql
-- Pedido del owner (2026-09-10): agregar "Concubinato" a la lista de estado
-- civil. estado_civil_enum es un ENUM real de Postgres (no un catálogo tabla
-- como tipo_discipulado) -- ALTER TYPE ... ADD VALUE no puede usarse en la
-- misma transacción en la que después se USA el valor nuevo, así que esta
-- migración contiene SOLO este statement (nada más en el archivo).

alter type public.estado_civil_enum add value if not exists 'CONCUBINATO';
