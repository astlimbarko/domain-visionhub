-- VisionHub -- KAN-367 (seguimiento KAN-374/375), pedido explicito del owner
-- 2026-09-14: la ventana de edicion de un reporte de Casa de Paz pasa de
-- estar anclada en fecha_reunion (fecha de celebracion) a fecha_creacion
-- (fecha en que se cargo el reporte). Con el ancla anterior, un reporte
-- atrasado (cargado hoy con fecha de celebracion de varias semanas atras)
-- nacia ya fuera de la ventana de edicion -- si el Lider/Sublider se
-- equivocaba al cargarlo, no tenia forma de corregirlo. Este es el caso
-- real reportado en KAN-367 (sublider Viviana, CdP del Lider Daniel
-- Justiniano Lara).
--
-- Se aprovecha el mismo cambio para separar la ventana unica
-- (DIAS_LIMITE_EDICION_REPORTE) en 2 valores independientes por nivel de
-- rol -- Lider/Sublider de CdP (ventana corta) vs Lider/Supervisor de Red
-- (ventana mas larga) -- y para que Pastor/Supervisor de la Vision en
-- Accion dejen de tener paso libre incondicional (fn_es_operativo_en) y
-- pasen a compartir la ventana larga de Red. El escape para editar fuera
-- de esa ventana (justificacion + OTP), exclusivo de Pastor/Supervisor,
-- se implementa aparte en una funcion dedicada (fn_editar_reporte_fuera_
-- de_ventana, fase siguiente) -- no se toca en esta migracion.

begin;

-- ============================================================
-- 1) Config: DIAS_LIMITE_EDICION_REPORTE_CDP / _RED reemplazan a
--    DIAS_LIMITE_EDICION_REPORTE (KAN-375).
-- ============================================================

insert into public.configuracion_definicion
  (codigo, nombre, descripcion, tipo, valor_defecto, valor_min, valor_max, unidad, categoria, orden)
values
  (
    'DIAS_LIMITE_EDICION_REPORTE_CDP',
    'Días límite para editar un reporte (Líder/Sublíder de CdP)',
    'Días desde que se CARGÓ el reporte (no desde la fecha de la reunión) dentro de los cuales el Líder o Sublíder de esa Casa de Paz puede editarlo.',
    'NUMERICO',
    '3',
    '1',
    '60',
    'días',
    'CONTROL_REPORTES',
    42
  ),
  (
    'DIAS_LIMITE_EDICION_REPORTE_RED',
    'Días límite para editar un reporte (Líder/Supervisor de Red, Pastor, Supervisor)',
    'Días desde que se CARGÓ el reporte dentro de los cuales el Líder/Supervisor de Red (de cualquier CdP de su red), el Pastor o el Supervisor de la Visión en Acción pueden editarlo sin pedir justificación.',
    'NUMERICO',
    '30',
    '1',
    '90',
    'días',
    'CONTROL_REPORTES',
    43
  )
on conflict (codigo) do update set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  valor_min = excluded.valor_min,
  valor_max = excluded.valor_max,
  orden = excluded.orden;

-- La fila vieja deja de tener consumidores despues de este cambio (ningun
-- codigo la referencia mas abajo) -- se marca eliminada (borrado logico,
-- trg_no_delete/fn_bloquear_delete prohibe el DELETE fisico en esta tabla
-- como en el resto del proyecto) para que no quede suelta en Panel
-- Supervisor mostrando un valor que ya no hace nada.
update public.configuracion_definicion
set fecha_eliminacion = now()
where codigo = 'DIAS_LIMITE_EDICION_REPORTE' and fecha_eliminacion is null;

-- ============================================================
-- 2) fn_puede_editar_reporte_cdp: ancla fecha_creacion, ventana por rol.
-- ============================================================

create or replace function public.fn_puede_editar_reporte_cdp(p_reporte_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select
    (
      fn_es_super_admin()
      or (
        -- CdP: Lider/Sublider de su propia CdP, ventana corta.
        r.fecha_creacion::date >= current_date - fn_criterio(r.iglesia_id, 'DIAS_LIMITE_EDICION_REPORTE_CDP')::int
        and (fn_es_lider_cdp(r.casa_de_paz_id) or fn_es_sublider_cdp(r.casa_de_paz_id))
      )
      or (
        -- Red: Lider/Supervisor de Red de cualquier CdP de su red, ventana larga.
        r.fecha_creacion::date >= current_date - fn_criterio(r.iglesia_id, 'DIAS_LIMITE_EDICION_REPORTE_RED')::int
        and exists (
          select 1 from casa_de_paz_red cdr
          where cdr.casa_de_paz_id = r.casa_de_paz_id
            and cdr.fecha_fin is null and cdr.fecha_eliminacion is null
            and fn_es_lider_de_red(cdr.red_id)
        )
      )
      or (
        -- Pastor / Supervisor de la Vision en Accion: misma ventana larga
        -- sin friccion. Fuera de esta ventana, solo por
        -- fn_editar_reporte_fuera_de_ventana (justificacion + OTP), no por acá.
        r.fecha_creacion::date >= current_date - fn_criterio(r.iglesia_id, 'DIAS_LIMITE_EDICION_REPORTE_RED')::int
        and (fn_es_pastor_en(r.iglesia_id) or fn_es_supervisor_en(r.iglesia_id))
      )
    )
  from casa_de_paz_reporte r
  where r.id = p_reporte_id and r.fecha_eliminacion is null;
$$;

grant execute on function public.fn_puede_editar_reporte_cdp(uuid) to authenticated;

commit;
