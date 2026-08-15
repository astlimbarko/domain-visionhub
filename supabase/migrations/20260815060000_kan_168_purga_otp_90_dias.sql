-- VisionHub -- KAN-168: borrar automaticamente los codigos OTP de mas de 90
-- dias. Los codigos OTP se guardan en usuario_otp para auditoria (quien
-- pidio un cambio protegido y cuando), pero acumularlos para siempre es
-- basura -- se borran de verdad los de mas de 90 dias, los mas recientes se
-- mantienen intactos para poder auditar. Mismo patron de pg_cron ya usado
-- para el barrido programado de Redes (20260806040000).

create extension if not exists pg_cron;

create or replace function public.fn_purgar_otp_antiguos()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.usuario_otp
  where fecha_creacion < now() - interval '90 days';
$$;

revoke all on function public.fn_purgar_otp_antiguos() from public, anon, authenticated;

select cron.schedule(
  'purgar-otp-90-dias',
  '0 3 * * *',
  $$select public.fn_purgar_otp_antiguos();$$
);
