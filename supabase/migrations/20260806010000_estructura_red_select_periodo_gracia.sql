-- La politica de SELECT de "red" ocultaba por completo las filas con
-- fecha_eliminacion asignada, impidiendo que el lienzo muestre la Red
-- eliminada agrisada durante su periodo de gracia de 1 año antes de
-- desaparecer (pedido explicito del owner, 2026-08-06).
drop policy if exists pol_red_select on public.red;

create policy pol_red_select on public.red
  for select
  to authenticated
  using (
    iglesia_id in (select fn_mis_iglesias())
    and (fecha_eliminacion is null or fecha_eliminacion >= now() - interval '1 year')
  );
