-- VisionHub -- tipo_discipulado_identidad_hijo.sql
-- Pedido del owner (2026-09-10): faltaba un discipulado en el catálogo,
-- "Identidad de Hijo" -- de ahora en adelante debe salir como checkbox en
-- los 3 formularios de membresía (público, invitación, Afirmación), sin
-- tocar membresías ya cargadas. tipo_discipulado es un catálogo 100%
-- dinámico (fn_listar_tipos_discipulado + fn_guardar_membresia_extendida no
-- hardcodean códigos), así que un simple INSERT alcanza -- sin tocar
-- frontend ni backend de guardado.

insert into public.tipo_discipulado (codigo, nombre, orden) values
  ('IDENTIDAD_HIJO', 'Identidad de Hijo', 7)
on conflict (codigo) do update set nombre = excluded.nombre, orden = excluded.orden;
