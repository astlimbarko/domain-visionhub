-- VisionHub — bug real encontrado en vivo (2026-08-07): cambiar la
-- Proteccion OTP (activar O desactivar) rompia siempre con
-- "42703: record NEW has no field fecha_eliminacion". Causa: el trigger
-- trg_auditoria_estructura_organigrama usa la funcion generica fn_auditoria(),
-- pensada para tablas con soft-delete (fecha_eliminacion/eliminado_por) --
-- estructura_organigrama nunca tuvo esas columnas (es una fila de
-- configuracion por iglesia, no una entidad borrable). El UPDATE de
-- fn_estructura_configurar_otp siempre fallaba antes de llegar a guardar
-- nada, sin importar el OTP. Fix: trigger propio sin la logica de borrado.

begin;

create or replace function public.fn_auditoria_estructura_organigrama()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if TG_OP = 'INSERT' then
    NEW.fecha_creacion := now();
    NEW.creado_por := auth.uid();
    NEW.fecha_actualizacion := NULL;
    NEW.actualizado_por := NULL;
    return NEW;
  end if;

  if TG_OP = 'UPDATE' then
    NEW.fecha_creacion := OLD.fecha_creacion;
    NEW.creado_por := OLD.creado_por;
    NEW.fecha_actualizacion := now();
    NEW.actualizado_por := auth.uid();
    return NEW;
  end if;

  return NEW;
end;
$function$;

drop trigger if exists trg_auditoria_estructura_organigrama on public.estructura_organigrama;
create trigger trg_auditoria_estructura_organigrama
  before insert or update on public.estructura_organigrama
  for each row execute function public.fn_auditoria_estructura_organigrama();

commit;
