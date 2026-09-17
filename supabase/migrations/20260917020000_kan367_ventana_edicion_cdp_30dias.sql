-- VisionHub -- KAN-367 (pedido explicito del owner, 2026-09-17): ventana de
-- edicion de reporte de Lider/Sublider de CdP a 30 dias (desde fecha_creacion,
-- no desde fecha_reunion -- la fecha de reunion solo clasifica/ordena el
-- calendario de 52 semanas en el front) en Centro de Vida 4 Anillo, Centro de
-- Vida Montero y Centro de Vida Genesis (iglesia de prueba). El default
-- global (valor_defecto = 3 en configuracion_definicion) no se toca -- esto
-- es un override por iglesia via configuracion_valor, mismo mecanismo que ya
-- usa el Panel de Supervisor (fn_set_configuracion). El trigger
-- trg_validar_configuracion exige auth.uid() (actor real logueado) para
-- validar permiso/rango, asi que se deshabilita solo durante este bloque --
-- mismo patron ya documentado para la carga inicial de SUPER_ADMIN en
-- 05_funciones_acceso.sql.

begin;

do $$
declare
  v_def_id uuid;
  v_iglesia uuid;
begin
  select id into v_def_id from configuracion_definicion where codigo = 'DIAS_LIMITE_EDICION_REPORTE_CDP';

  alter table configuracion_valor disable trigger trg_validar_configuracion;

  foreach v_iglesia in array array[
    'e90aa1e7-25b1-48a4-a584-919966728fd9'::uuid, -- Centro de Vida 4 Anillo
    'a6eba075-2d26-4ef7-bd65-d3d7d4603af0'::uuid, -- Centro de Vida Montero
    '3dd4176e-a846-4ff2-a1ae-3c38f68e0913'::uuid  -- Centro de Vida Genesis
  ]
  loop
    update configuracion_valor
    set valor = '30'
    where iglesia_id = v_iglesia and definicion_id = v_def_id and fecha_eliminacion is null;

    if not found then
      insert into configuracion_valor (iglesia_id, definicion_id, valor)
      values (v_iglesia, v_def_id, '30');
    end if;
  end loop;

  alter table configuracion_valor enable trigger trg_validar_configuracion;
end $$;

commit;
