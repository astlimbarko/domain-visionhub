-- VisionHub — fn_puede_invitar_lider no consideraba a Super Admin (solo
-- fn_es_operativo_en = Supervisor de la Visión, o Líder de Red para su
-- propia Red/CdP). Bug real encontrado probando "Designar por correo" como
-- Super Admin desde el Constructor de Estructura Organizacional (REQ-PER-1:
-- Super Admin administra cualquier iglesia). Mismo criterio ya usado en
-- private.fn_estructura_puede_administrar.

begin;

create or replace function public.fn_puede_invitar_lider(
  p_rol public.rol_sistema_enum, p_red_id uuid, p_casa_de_paz_id uuid, p_departamento_id uuid default null
)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  v_iglesia_id uuid;
  v_red_de_cdp uuid;
begin
  if p_departamento_id is not null then
    select iglesia_id into v_iglesia_id from departamento where id = p_departamento_id;
    return v_iglesia_id is not null and (fn_es_super_admin() or fn_es_operativo_en(v_iglesia_id));
  end if;

  if p_rol = 'LIDER_RED' then
    if p_red_id is null then return false; end if;
    select iglesia_id into v_iglesia_id from red where id = p_red_id;
    return v_iglesia_id is not null and (fn_es_super_admin() or fn_es_operativo_en(v_iglesia_id));

  elsif p_rol in ('LIDER_CDP', 'SUBLIDER_CDP') then
    if p_casa_de_paz_id is null then return false; end if;
    select iglesia_id into v_iglesia_id from casa_de_paz where id = p_casa_de_paz_id;
    if v_iglesia_id is null then return false; end if;
    if fn_es_super_admin() or fn_es_operativo_en(v_iglesia_id) then return true; end if;

    select cr.red_id into v_red_de_cdp from casa_de_paz_red cr
    where cr.casa_de_paz_id = p_casa_de_paz_id and cr.fecha_eliminacion is null;
    return v_red_de_cdp is not null and fn_es_lider_de_red(v_red_de_cdp);

  else
    return false;
  end if;
end;
$$;

commit;
