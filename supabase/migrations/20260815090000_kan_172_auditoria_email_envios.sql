-- VisionHub -- KAN-172: auditoria ligera y desacoplada de la latencia real
-- de los correos transaccionales OTP (Brevo SMTP), separada de usuario_otp
-- (que sigue siendo solo generacion/hash/expiracion/uso del OTP en si).
--
-- Fuera de esta migracion, documentado como pendiente externo: el paso 3 del
-- ciclo (Brevo reporta "Delivered" via webhook) requiere que alguien
-- registre la URL del webhook en el panel de Brevo -- columna
-- entregado_en queda lista para recibirlo despues, sin nada mas armado
-- todavia (no hay endpoint HTTP nuevo en esta migracion).

begin;

create table public.auditoria_email_envios (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  otp_id uuid references public.usuario_otp(id) on delete set null,
  tipo text not null,
  proveedor text not null default 'brevo',
  estado text not null default 'INICIADO'
    check (estado in ('INICIADO', 'ACEPTADO', 'ERROR', 'ENTREGADO')),
  creado_en timestamptz not null default now(),
  envio_iniciado_en timestamptz,
  proveedor_acepto_en timestamptz,
  entregado_en timestamptz,
  proveedor_message_id text,
  error_codigo text
);

-- Protegida por completo: nunca expuesta al cliente via PostgREST, solo
-- accesible desde las funciones SECURITY DEFINER de abajo.
alter table public.auditoria_email_envios enable row level security;
revoke all on public.auditoria_email_envios from public, anon, authenticated;

-- fn_generar_otp no devolvia el id de la fila insertada -- hace falta para
-- poder vincular auditoria_email_envios.otp_id. Unico consumidor real hoy:
-- supabase/functions/solicitar-otp/index.ts (se actualiza en el mismo
-- commit). Cambiar el RETURNS TABLE exige DROP + CREATE (Postgres no
-- permite CREATE OR REPLACE con distinta forma de retorno) -- eso resetea
-- el ACL al default de Postgres (ejecucion publica), asi que el
-- revoke/grant de mas abajo es obligatorio, no opcional (mismo patron de
-- regresion real encontrado y corregido hoy en KAN-135).
drop function if exists public.fn_generar_otp(character varying);

create function public.fn_generar_otp(p_proposito character varying default 'ACCION_SENSIBLE'::character varying)
returns table(id uuid, codigo text, expira_en timestamp with time zone)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
DECLARE
  v_ultimo  TIMESTAMPTZ;
  v_codigo  TEXT;
  v_expira  TIMESTAMPTZ;
  v_id      UUID;
BEGIN
  SELECT fecha_creacion INTO v_ultimo FROM usuario_otp
  WHERE usuario_id = auth.uid()
  ORDER BY fecha_creacion DESC LIMIT 1;

  IF v_ultimo IS NOT NULL AND v_ultimo > now() - interval '120 seconds' THEN
    RAISE EXCEPTION 'OTP_MUY_SEGUIDO: espera unos segundos antes de pedir otro codigo'
      USING ERRCODE = 'P0001';
  END IF;

  v_codigo := lpad(floor(random() * 1000000)::text, 6, '0');
  v_expira := now() + interval '10 minutes';

  INSERT INTO usuario_otp (usuario_id, codigo_hash, proposito, expira_en)
  VALUES (auth.uid(), crypt(v_codigo, gen_salt('bf')), p_proposito, v_expira)
  RETURNING usuario_otp.id INTO v_id;

  RETURN QUERY SELECT v_id, v_codigo, v_expira;
END;
$function$;

revoke all on function public.fn_generar_otp(character varying) from public, anon;
grant execute on function public.fn_generar_otp(character varying) to authenticated;

-- Registrar el inicio del envio (modo COMPLETA). Devuelve el id de la fila
-- para que la Edge Function la actualice despues de sendMail.
create or replace function public.fn_auditoria_email_iniciar(
  p_otp_id uuid,
  p_tipo text,
  p_proveedor text default 'brevo'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  insert into public.auditoria_email_envios (usuario_id, otp_id, tipo, proveedor, estado, envio_iniciado_en)
  values ((select auth.uid()), p_otp_id, p_tipo, p_proveedor, 'INICIADO', now())
  returning id into v_id;

  return v_id;
end;
$function$;

-- Cierra el ciclo (modo COMPLETA): Brevo acepto o rechazo el envio.
create or replace function public.fn_auditoria_email_actualizar(
  p_id uuid,
  p_estado text,
  p_proveedor_message_id text default null,
  p_error_codigo text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  update public.auditoria_email_envios
  set estado = p_estado,
      proveedor_acepto_en = case when p_estado = 'ACEPTADO' then now() else proveedor_acepto_en end,
      proveedor_message_id = coalesce(p_proveedor_message_id, proveedor_message_id),
      error_codigo = coalesce(p_error_codigo, error_codigo)
  -- usuario_id filtra ademas de id: nadie puede tocar la fila de otro
  -- usando este RPC, aunque adivine el uuid.
  where id = p_id and usuario_id = (select auth.uid());
end;
$function$;

-- Registro directo de un fallo (modo ERRORES): un solo insert, sin pasar
-- por iniciar/actualizar -- ese modo no le interesa el ciclo completo,
-- solo dejar rastro de que algo fallo.
create or replace function public.fn_auditoria_email_registrar_error(
  p_otp_id uuid,
  p_tipo text,
  p_proveedor text,
  p_error_codigo text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  insert into public.auditoria_email_envios (usuario_id, otp_id, tipo, proveedor, estado, envio_iniciado_en, error_codigo)
  values ((select auth.uid()), p_otp_id, p_tipo, p_proveedor, 'ERROR', now(), p_error_codigo);
end;
$function$;

revoke all on function public.fn_auditoria_email_iniciar(uuid, text, text) from public, anon;
grant execute on function public.fn_auditoria_email_iniciar(uuid, text, text) to authenticated;
revoke all on function public.fn_auditoria_email_actualizar(uuid, text, text, text) from public, anon;
grant execute on function public.fn_auditoria_email_actualizar(uuid, text, text, text) to authenticated;
revoke all on function public.fn_auditoria_email_registrar_error(uuid, text, text, text) from public, anon;
grant execute on function public.fn_auditoria_email_registrar_error(uuid, text, text, text) to authenticated;

commit;
