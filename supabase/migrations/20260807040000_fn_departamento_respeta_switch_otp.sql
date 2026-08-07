-- VisionHub — bug real reportado por el owner (2026-08-07): asignar/quitar
-- Lider de Departamento (Afirmacion) pedia OTP siempre, sin importar el
-- switch "Proteccion OTP" del constructor -- estas 2 funciones son
-- anteriores a ese switch (KAN-77) y nunca se actualizaron para respetarlo,
-- a diferencia de las de Red (fn_estructura_asignar_cargo_red / quitar) que
-- ya usan private.fn_estructura_exigir_otp (solo exige codigo si el switch
-- de esa iglesia esta activo).

begin;

create or replace function public.fn_asignar_cargo_departamento(
  p_iglesia_id uuid, p_departamento_id uuid, p_persona_id uuid, p_cargo_id uuid, p_pin text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not (fn_es_super_admin() or fn_es_operativo_en(p_iglesia_id)) then
    raise exception 'DEPARTAMENTO_SOLO_OPERATIVO: se requiere ser Pastor o Supervisor de la iglesia para asignar un Lider de Departamento'
      using errcode = 'P0001';
  end if;

  perform private.fn_estructura_exigir_otp(p_iglesia_id, p_pin);

  update departamento_cargo set fecha_fin = current_date
  where departamento_id = p_departamento_id and fecha_fin is null and fecha_eliminacion is null;

  insert into departamento_cargo (iglesia_id, departamento_id, persona_id, cargo_id, fecha_inicio)
  values (p_iglesia_id, p_departamento_id, p_persona_id, p_cargo_id, current_date);
end;
$function$;

create or replace function public.fn_quitar_cargo_departamento(p_cargo_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_iglesia_id uuid;
begin
  select iglesia_id into v_iglesia_id from departamento_cargo
  where id = p_cargo_id and fecha_fin is null and fecha_eliminacion is null;
  if v_iglesia_id is null then
    raise exception 'DEPARTAMENTO_CARGO_INEXISTENTE: la asignacion no existe o ya no esta vigente' using errcode = 'P0001';
  end if;
  if not (fn_es_super_admin() or fn_es_operativo_en(v_iglesia_id)) then
    raise exception 'DEPARTAMENTO_SOLO_OPERATIVO: se requiere ser Pastor o Supervisor de la iglesia para quitar un Lider de Departamento'
      using errcode = 'P0001';
  end if;

  perform private.fn_estructura_exigir_otp(v_iglesia_id, p_pin);

  update departamento_cargo set fecha_fin = current_date where id = p_cargo_id;
end;
$function$;

commit;
