-- KAN-423 fix: pol_cdp_reporte_testimonio_insert usaba fn_puede_reportar_cdp
-- (permiso para CREAR un reporte nuevo, acotado al Líder/Sublíder de esa
-- CdP puntual) -- pero reemplazarTestimoniosCategorizados() también corre
-- desde actualizarReporte() (edición), donde quien edita puede ser Líder/
-- Supervisor de Red, Pastor o Supervisor de la Visión en Acción editando el
-- reporte de una CdP ajena -- roles que fn_puede_reportar_cdp no reconoce,
-- así que el INSERT de testimonios se hubiera bloqueado por RLS en ese
-- camino. fn_puede_editar_reporte_cdp ya cubre ambos casos (un reporte
-- recién creado está siempre dentro de su propia ventana de edición), así
-- que se usa esa sola función para INSERT también.

begin;

DROP POLICY IF EXISTS pol_cdp_reporte_testimonio_insert ON public.casa_de_paz_reporte_testimonio;

CREATE POLICY pol_cdp_reporte_testimonio_insert ON public.casa_de_paz_reporte_testimonio
  FOR INSERT
  WITH CHECK (public.fn_puede_editar_reporte_cdp(reporte_id));

commit;
