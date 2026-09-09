-- KAN-210: Supabase Storage para fotos de perfil, mismo patron que el bucket
-- `anuncios` (20260808290000) pero mas simple: el path YA codifica el scope
-- de permiso ({iglesiaId}/{personaId}.jpg, deterministico + upsert en el
-- front), no hace falta join a otra tabla para saber a que iglesia
-- pertenece un objeto.
--
-- Permisos (mismo criterio ya usado en persona_censo_membresia, 20260821050000):
-- - SELECT: cualquier autenticado de la MISMA iglesia (igual que la propia
--   tabla persona -- ver pol_persona_select en 16_rls.sql, ahi cualquiera del
--   tenant puede ver cualquier persona del tenant, no hay barrera por rol).
-- - INSERT/UPDATE/DELETE: la propia persona (fn_mi_persona_id(), autoservicio
--   -- pedido explicito del owner: "foto de perfil para todos los usuarios")
--   o alguien operativo en esa iglesia (fn_es_operativo_en -- Pastor/Super
--   Admin/Supervisor de la Vision en Accion), para poder cargarla a nombre de
--   una persona que todavia no tiene cuenta.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-perfil', 'fotos-perfil', false, 1048576, array['image/jpeg'])
on conflict (id) do nothing;

alter table persona add column if not exists foto_perfil_path text null;

create policy pol_storage_fotos_perfil_select on storage.objects for select to authenticated using (
  bucket_id = 'fotos-perfil'
  and (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  and ((storage.foldername(name))[1])::uuid in (select fn_mis_iglesias())
);

create policy pol_storage_fotos_perfil_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'fotos-perfil'
  and (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  and ((storage.foldername(name))[1])::uuid in (select fn_mis_iglesias())
  and (
    regexp_replace(split_part(name, '/', 2), '\.jpg$', '') = (select fn_mi_persona_id())::text
    or fn_es_operativo_en(((storage.foldername(name))[1])::uuid)
  )
);

create policy pol_storage_fotos_perfil_update on storage.objects for update to authenticated using (
  bucket_id = 'fotos-perfil'
  and (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  and ((storage.foldername(name))[1])::uuid in (select fn_mis_iglesias())
  and (
    regexp_replace(split_part(name, '/', 2), '\.jpg$', '') = (select fn_mi_persona_id())::text
    or fn_es_operativo_en(((storage.foldername(name))[1])::uuid)
  )
);

create policy pol_storage_fotos_perfil_delete on storage.objects for delete to authenticated using (
  bucket_id = 'fotos-perfil'
  and (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  and ((storage.foldername(name))[1])::uuid in (select fn_mis_iglesias())
  and (
    regexp_replace(split_part(name, '/', 2), '\.jpg$', '') = (select fn_mi_persona_id())::text
    or fn_es_operativo_en(((storage.foldername(name))[1])::uuid)
  )
);
