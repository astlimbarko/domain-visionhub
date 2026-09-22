-- KAN-423 (2026-09-22, pedido explícito del owner): el campo único
-- "Testimonio" del reporte de Casa de Paz se separa en 2 cosas distintas:
-- testimonios personales individuales (categoría + texto, se pueden agregar
-- varios con un botón "+") y una narración general de la reunión ("¿Qué se
-- desató en la CdP?", que sigue viviendo en la columna `testimonios` ya
-- existente -- solo cambia de significado/etiqueta en la UI, no de esquema).
--
-- Tabla nueva, patrón append-only ya usado en el resto del proyecto
-- (fecha_eliminacion en vez de DELETE físico). RLS calca exactamente el
-- mismo criterio que ya protege casa_de_paz_reporte (fn_puede_ver_cdp para
-- leer, fn_puede_reportar_cdp para crear, fn_puede_editar_reporte_cdp para
-- editar/dar de baja), vía el reporte_id que cada fila referencia.

begin;

CREATE TABLE public.casa_de_paz_reporte_testimonio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporte_id uuid NOT NULL REFERENCES public.casa_de_paz_reporte(id),
  categoria text NOT NULL CHECK (categoria IN ('FINANZAS', 'SANIDAD', 'RESTAURACION')),
  texto text NOT NULL,
  fecha_creacion timestamptz NOT NULL DEFAULT now(),
  fecha_eliminacion timestamptz
);

COMMENT ON TABLE public.casa_de_paz_reporte_testimonio IS
  'KAN-423: testimonios personales del reporte de CdP, uno o varios por reporte, cada uno con su categoría (Finanzas/Sanidad/Restauración). Distinto de casa_de_paz_reporte.testimonios, que es la narración general ("¿Qué se desató en la CdP?").';

CREATE INDEX idx_cdp_reporte_testimonio_reporte ON public.casa_de_paz_reporte_testimonio(reporte_id) WHERE fecha_eliminacion IS NULL;

ALTER TABLE public.casa_de_paz_reporte_testimonio ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_cdp_reporte_testimonio_select ON public.casa_de_paz_reporte_testimonio
  FOR SELECT
  USING (
    fecha_eliminacion IS NULL
    AND EXISTS (
      SELECT 1 FROM public.casa_de_paz_reporte r
      WHERE r.id = reporte_id AND public.fn_puede_ver_cdp(r.casa_de_paz_id)
    )
  );

CREATE POLICY pol_cdp_reporte_testimonio_insert ON public.casa_de_paz_reporte_testimonio
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.casa_de_paz_reporte r
      WHERE r.id = reporte_id AND public.fn_puede_reportar_cdp(r.casa_de_paz_id)
    )
  );

CREATE POLICY pol_cdp_reporte_testimonio_update ON public.casa_de_paz_reporte_testimonio
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.casa_de_paz_reporte r
      WHERE r.id = reporte_id AND public.fn_puede_editar_reporte_cdp(r.id)
    )
  );

commit;
