-- KAN-497 paso 7: "Registro" del formulario de membresía de nuevos. Se reusa la
-- tabla de procesos de Afirmación como registro de quién cargó a cada persona
-- (mismo patrón que Altar/Bautismo/RSIL: no se borra, un colaborador ve solo lo
-- suyo, Afirmación ve todo).
-- ALTER TYPE ... ADD VALUE no puede combinarse con otras sentencias en la misma
-- transacción, por eso este archivo tiene UNA sola sentencia.
ALTER TYPE proceso_afirmacion_codigo_enum ADD VALUE IF NOT EXISTS 'MEMBRESIA_NUEVOS';
