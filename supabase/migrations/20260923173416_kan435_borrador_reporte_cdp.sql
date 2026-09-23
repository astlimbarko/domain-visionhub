-- KAN-435 (2026-09-23, pedido explícito del owner): autoguardado del
-- Reporte de Casa de Paz. La idea: si el dispositivo se apaga a mitad de
-- carga, o si el líder abre la misma cuenta desde otro dispositivo, el
-- reporte tiene que aparecer hasta donde se guardó -- pero NADA de esto
-- cuenta como un reporte real (no aparece en el calendario, no cuenta
-- para cumplimiento) hasta que se toque "Enviar reporte".
--
-- Por eso es una tabla separada, no un estado "borrador" dentro de
-- casa_de_paz_reporte: esa tabla tiene un trigger (fn_validar_tema_libro)
-- y una vista de totales (v_reporte_totales) que no deberían enterarse de
-- un reporte a medio llenar. El payload completo (todo lo que hoy vive en
-- estado local de React en Reportes.tsx: asistentes, visitas nuevas,
-- diezmos, testimonios, etc.) se guarda tal cual como JSON -- no hay
-- veinte columnas que mantener sincronizadas con el formulario.
--
-- Un borrador por (Casa de Paz, fecha de reunión) -- mismo criterio que la
-- unicidad del reporte real (uq_reporte_cdp_fecha). Con la clave sin la
-- fecha, empezar el reporte de hoy Y (aparte) completar una semana
-- atrasada desde el círculo rojo del calendario se pisarían entre sí --
-- la fecha vive DENTRO del payload (es parte del formulario), por eso el
-- índice único es una expresión sobre el JSON, no una columna aparte.
-- No lleva fecha_eliminacion/trg_no_delete como el resto de las tablas
-- del proyecto: un borrador es información de trabajo descartable, no un
-- registro de negocio con necesidad de auditoría -- se borra de verdad
-- (DELETE) en cuanto se envía el reporte real o cuando el líder decide
-- arrancar de cero.

CREATE TABLE casa_de_paz_reporte_borrador (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id           UUID NOT NULL REFERENCES iglesia(id),
  casa_de_paz_id       UUID NOT NULL REFERENCES casa_de_paz(id),
  payload              JSONB NOT NULL,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por      UUID REFERENCES auth.users(id)
);

CREATE UNIQUE INDEX uq_reporte_borrador_cdp_fecha
  ON casa_de_paz_reporte_borrador (casa_de_paz_id, (payload ->> 'fecha_reunion'));

ALTER TABLE casa_de_paz_reporte_borrador ENABLE ROW LEVEL SECURITY;

-- Mismo criterio de permiso que ya usa casa_de_paz_reporte para poder
-- cargar un reporte de esa CdP (pol_casa_de_paz_reporte_insert): estar en
-- una de mis iglesias Y tener permiso de reportar para esa CdP puntual.
CREATE POLICY pol_reporte_borrador_select ON casa_de_paz_reporte_borrador
  FOR SELECT
  USING (iglesia_id IN (SELECT fn_mis_iglesias()) AND fn_puede_reportar_cdp(casa_de_paz_id));

CREATE POLICY pol_reporte_borrador_insert ON casa_de_paz_reporte_borrador
  FOR INSERT
  WITH CHECK (iglesia_id IN (SELECT fn_mis_iglesias()) AND fn_puede_reportar_cdp(casa_de_paz_id));

CREATE POLICY pol_reporte_borrador_update ON casa_de_paz_reporte_borrador
  FOR UPDATE
  USING (iglesia_id IN (SELECT fn_mis_iglesias()) AND fn_puede_reportar_cdp(casa_de_paz_id));

CREATE POLICY pol_reporte_borrador_delete ON casa_de_paz_reporte_borrador
  FOR DELETE
  USING (iglesia_id IN (SELECT fn_mis_iglesias()) AND fn_puede_reportar_cdp(casa_de_paz_id));

-- Bug real encontrado en vivo (2026-09-23): el esquema no otorga DELETE a
-- `authenticated` por defecto en tablas nuevas -- consistente con la
-- convención del proyecto de nunca hacer DELETE real (soft-delete en
-- todos lados). Esta tabla es la excepción deliberada, así que necesita
-- el GRANT explícito; sin esto, cualquier DELETE devuelve 403 aunque la
-- policy de arriba esté bien.
GRANT DELETE ON casa_de_paz_reporte_borrador TO authenticated;
