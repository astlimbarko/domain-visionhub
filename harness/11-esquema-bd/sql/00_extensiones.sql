-- VisionHub -- 00_extensiones.sql
-- Extensiones requeridas por el resto de las migraciones.

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS btree_gist; -- EXCLUDE USING gist con UUID + daterange
CREATE EXTENSION IF NOT EXISTS unaccent;   -- fn_slugificar (13-registro-publico-cdp)
