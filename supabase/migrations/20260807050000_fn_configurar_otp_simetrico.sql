-- VisionHub — pedido del owner (2026-08-07): activar la Proteccion OTP
-- nunca pedia codigo (solo desactivar lo pedia). Ahora cualquier cambio de
-- estado (activar O desactivar) exige un OTP valido.

begin;

create or replace function public.fn_estructura_configurar_otp(p_iglesia_id uuid, p_requerido boolean, p_otp text default null::text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_anterior boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  if not private.fn_estructura_puede_administrar(p_iglesia_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  insert into public.estructura_organigrama (iglesia_id, creado_por)
  values (p_iglesia_id, (select auth.uid()))
  on conflict (iglesia_id) do nothing;

  select eo.otp_requerido
  into v_anterior
  from public.estructura_organigrama eo
  where eo.iglesia_id = p_iglesia_id
  for update;

  if v_anterior = p_requerido then
    return p_requerido;
  end if;

  -- Cualquier cambio de estado (activar o desactivar) exige un codigo valido.
  if not public.fn_verificar_otp(p_otp) then
    raise exception 'OTP_ESTRUCTURA_INVALIDO'
      using errcode = 'P0001';
  end if;

  update public.estructura_organigrama
  set otp_requerido = p_requerido,
      actualizado_por = (select auth.uid())
  where iglesia_id = p_iglesia_id;

  insert into public.estructura_otp_auditoria (
    iglesia_id, usuario_id, valor_anterior, valor_nuevo
  ) values (
    p_iglesia_id, (select auth.uid()), v_anterior, p_requerido
  );

  return p_requerido;
end;
$function$;

commit;
