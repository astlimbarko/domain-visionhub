-- VisionHub -- fix real encontrado probando en vivo (2026-08-15): las
-- funciones private.fn_anuncio_* usadas DENTRO de policies de RLS
-- (pol_anuncio_select/insert/update, pol_storage_anuncios_*) fallaban con
-- "permission denied for function ..." al publicar el primer anuncio de
-- prueba (storage.objects INSERT, error 403 real de Supabase Storage).
--
-- Motivo: una politica RLS se evalua en el contexto del ROL que hace la
-- query real (authenticated via PostgREST/Storage), no del dueno de una
-- funcion SECURITY DEFINER -- eso solo aplica cuando una funcion llama a
-- otra function por dentro (ahi si corre como el dueno). private.fn_anuncio_
-- es_supervisor/es_encargado/puede_gestionar_iglesia/fila_administrable/
-- es_destinatario nunca tuvieron GRANT EXECUTE a authenticated (ni en el
-- codigo original de Matias del 08/08 ni en las nuevas de hoy) -- solo
-- funcionaban cuando se llamaban desde adentro de una RPC SECURITY DEFINER
-- (fn_anuncio_crear, fn_mis_anuncios_gestion, etc.), nunca se habia
-- ejercitado el camino real de RLS porque nadie probo esto en vivo hasta
-- ahora.

begin;

grant execute on function private.fn_anuncio_es_supervisor(uuid) to authenticated;
grant execute on function private.fn_anuncio_es_encargado(uuid) to authenticated;
grant execute on function private.fn_anuncio_puede_gestionar_iglesia(uuid) to authenticated;
grant execute on function private.fn_anuncio_fila_administrable(uuid) to authenticated;
grant execute on function private.fn_anuncio_es_destinatario(uuid) to authenticated;

commit;
