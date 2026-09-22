-- KAN-420 fix: fn_visitas_cdp (20260922050000) rompia con error 42804
-- "Returned type character varying(5) does not match expected type text
-- in column 6" -- estado.sigla es varchar(5) en la tabla, pero la firma de
-- retorno declaraba estado_sigla como TEXT sin castear. Postgres es
-- estricto con el tipo exacto en RETURNS TABLE. Se agrega el cast
-- explicito e.sigla::text.

begin;

DROP FUNCTION IF EXISTS public.fn_visitas_cdp(uuid);

CREATE OR REPLACE FUNCTION public.fn_visitas_cdp(p_casa_de_paz_id uuid)
 RETURNS TABLE(persona_id uuid, nombre_completo text, sexo sexo_enum, tiene_fecha_nacimiento boolean, edad integer, estado_sigla text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not fn_puede_ver_cdp(p_casa_de_paz_id) then
    raise exception 'CDP_FUERA_DE_ALCANCE' using errcode = 'P0001';
  end if;

  return query
  select p.id, fn_nombre_completo(p), p.sexo, p.fecha_nacimiento is not null,
         case
           when p.fecha_nacimiento is not null then extract(year from age(p.fecha_nacimiento))::int
           else p.edad_aproximada
         end,
         e.sigla::text
  from persona p
  left join persona_estado pe on pe.persona_id = p.id and pe.fecha_fin is null and pe.fecha_eliminacion is null
  left join estado e on e.id = pe.estado_id
  where p.fecha_eliminacion is null
    and exists (
      select 1 from casa_de_paz_asistencia a
      join casa_de_paz_reporte r on r.id = a.reporte_id
      where a.persona_id = p.id and r.casa_de_paz_id = p_casa_de_paz_id
        and a.fecha_eliminacion is null and r.fecha_eliminacion is null
    )
    and not exists (
      select 1 from casa_de_paz_membresia cm
      where cm.persona_id = p.id and cm.casa_de_paz_id = p_casa_de_paz_id
        and cm.fecha_fin is null and cm.fecha_eliminacion is null
    );
end;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_visitas_cdp(uuid) TO authenticated;

commit;
