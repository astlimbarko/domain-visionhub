-- VisionHub — fn_asignar_cargo_departamento / fn_quitar_cargo_departamento
-- no consideraban a Super Admin (solo fn_es_operativo_en = Supervisor de la
-- Visión en Acción de esa iglesia especifica). Mismo gap ya encontrado y
-- corregido 3 veces antes en esta epica (fn_puede_invitar_lider,
-- fn_validar_asignacion_rol, fn_cancelar_invitacion_lider) -- ninguna de
-- esas correcciones tocó estas dos funciones, que quedaron con el mismo
-- hueco (KAN-84).
--
-- Bug real reportado por el owner (2026-08-06): al intentar quitar al Líder
-- de Afirmación en "Centro de Vida El Eden" (donde es Super Admin y Pastor,
-- pero NO Supervisor de la Visión), la funcion explotaba con
-- DEPARTAMENTO_SOLO_OPERATIVO *antes* de llegar siquiera a validar el OTP
-- -- por eso el codigo, aunque correcto, nunca se marcaba como usado
-- (confirmado en usuario_otp: la fila de ese intento quedo con usado_en
-- NULL, prueba de que fn_verificar_otp nunca se ejecuto). El usuario percibio
-- esto como "el OTP correcto fue rechazado", pero el OTP nunca se llego a
-- revisar.

begin;

create or replace function public.fn_asignar_cargo_departamento(
  p_iglesia_id uuid, p_departamento_id uuid, p_persona_id uuid, p_cargo_id uuid, p_pin text
)
returns void
language plpgsql security definer set search_path = 'public'
as $$
begin
  if not (fn_es_super_admin() or fn_es_operativo_en(p_iglesia_id)) then
    raise exception 'DEPARTAMENTO_SOLO_OPERATIVO: se requiere ser Pastor o Supervisor de la iglesia para asignar un Lider de Departamento'
      using errcode = 'P0001';
  end if;
  if not fn_verificar_otp(p_pin) then
    raise exception 'PIN_INCORRECTO: el codigo de confirmacion es incorrecto, expiro, o no fue solicitado'
      using errcode = 'P0001';
  end if;

  update departamento_cargo set fecha_fin = current_date
  where departamento_id = p_departamento_id and fecha_fin is null and fecha_eliminacion is null;

  insert into departamento_cargo (iglesia_id, departamento_id, persona_id, cargo_id, fecha_inicio)
  values (p_iglesia_id, p_departamento_id, p_persona_id, p_cargo_id, current_date);
end;
$$;

create or replace function public.fn_quitar_cargo_departamento(p_cargo_id uuid, p_pin text)
returns void
language plpgsql security definer set search_path = 'public'
as $$
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
  if not fn_verificar_otp(p_pin) then
    raise exception 'PIN_INCORRECTO: el codigo de confirmacion es incorrecto, expiro, o no fue solicitado'
      using errcode = 'P0001';
  end if;

  update departamento_cargo set fecha_fin = current_date where id = p_cargo_id;
end;
$$;

commit;
