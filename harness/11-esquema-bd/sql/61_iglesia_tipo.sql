-- VisionHub -- 61_iglesia_tipo.sql
-- 15-gestion-administrativa, Panel 4 (adelantado a pedido del owner,
-- 2026-07-31): iglesia hija vs satelite. Aditivo -- DEFAULT 'HIJA' deja
-- todas las iglesias existentes exactamente como estaban, sin migracion de
-- datos y sin tocar ninguna RLS/dashboard que hoy se basa en
-- iglesia_padre_id/fn_mis_iglesias(). Hoy la diferencia es solo conceptual
-- (REQ-IS-2, 15-gestion-administrativa/requirements.md): mismo
-- comportamiento funcional, el campo solo etiqueta el tipo.

CREATE TYPE iglesia_tipo_enum AS ENUM ('HIJA', 'SATELITE');

ALTER TABLE iglesia
  ADD COLUMN tipo iglesia_tipo_enum NOT NULL DEFAULT 'HIJA';
