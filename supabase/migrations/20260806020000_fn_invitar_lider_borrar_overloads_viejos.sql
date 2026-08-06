-- Bug real encontrado revisando la rama antes del PR (2026-08-06): al agregar
-- p_departamento_id a fn_puede_invitar_lider/fn_invitar_lider (71_invitar_lider_
-- departamento.sql) se uso CREATE OR REPLACE con un parametro nuevo -- Postgres
-- no reemplaza la funcion cuando la firma cambia, crea un OVERLOAD aparte. Las
-- versiones viejas (3/5 parametros, sin p_departamento_id) quedaron vivas en
-- paralelo a las nuevas (4/6 parametros). Hoy no rompe nada porque los unicos
-- callers (Edge Functions invitar-lider/crear-red) siempre pasan todos los
-- parametros nuevos, pero cualquier llamado con la firma vieja explota
-- ("function ... is not unique", 42725) y la version vieja ademas difiere en
-- comportamiento para SUBLIDER_CDP. Se borran los 2 overloads viejos --
-- confirmado por grep que ningun caller real usa esa firma.

begin;

drop function if exists public.fn_puede_invitar_lider(rol_sistema_enum, uuid, uuid);
drop function if exists public.fn_invitar_lider(uuid, text, rol_sistema_enum, uuid, uuid);

commit;
