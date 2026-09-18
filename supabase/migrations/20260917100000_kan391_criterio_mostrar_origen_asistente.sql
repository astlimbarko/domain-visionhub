-- VisionHub -- KAN-391 (2026-09-17, pedido explícito del owner): criterio
-- configurable por Supervisión para que Líder/Sublíder de CdP vean (o no)
-- de qué CdP/iglesia viene un asistente encontrado por el buscador
-- unificado. Líder de Red y Supervisor siempre lo ven -- ese gate es en el
-- frontend por rol, este criterio solo controla la vista de Líder/Sublíder
-- de CdP. Reusa el motor genérico de configuración (fn_config_formulario,
-- categoría FORMULARIO_REPORTE) -- sin RPC nueva, el panel de Supervisión
-- ya lo muestra solo con este INSERT.

INSERT INTO configuracion_definicion (codigo, nombre, descripcion, tipo, valor_defecto, categoria, modulo, orden)
VALUES (
  'REPORTE_MOSTRAR_ORIGEN_ASISTENTE',
  'Mostrar origen del asistente a Líder/Sublíder de CdP',
  'Cuando el líder busca a un asistente que ya existe en el sistema pero no es de su Casa de Paz, muestra de qué CdP viene. Líder de Red y Supervisor siempre lo ven, sin importar este criterio.',
  'BOOLEANO',
  'true',
  'FORMULARIO_REPORTE',
  1,
  40
);
