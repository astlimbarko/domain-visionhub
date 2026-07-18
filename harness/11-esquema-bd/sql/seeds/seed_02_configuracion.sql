-- VisionHub -- seed_02_configuracion.sql
-- Motor unico de configuracion (10-panel-supervisor). Idempotente.

INSERT INTO configuracion_definicion (codigo, nombre, descripcion, tipo, valor_defecto, valor_min, valor_max, unidad, categoria, modulo, orden) VALUES
  -- Criterios CDP / SSVA (05-estados-ssva)
  ('VISITAS_PARA_MIEMBRO', 'Visitas para ser Miembro de CdP', 'Visitas consecutivas necesarias para que una persona se considere Miembro de la Casa de Paz.', 'NUMERICO', '2', 1, 20, 'visitas', 'CDP', 1, 1),
  ('VISITAS_PARA_CRE', 'Visitas para pasar a Creyente', 'Visitas consecutivas necesarias para que un Nuevo Convertido o Reconciliado pase a Creyente.', 'NUMERICO', '2', 1, 20, 'visitas', 'SSVA', 1, 2),
  ('VISITAS_PARA_MIGRAR', 'Visitas para proponer migracion', 'Visitas consecutivas a otra Casa de Paz para que el sistema proponga la migracion.', 'NUMERICO', '8', 2, 50, 'visitas', 'CDP', 1, 3),
  ('INASISTENCIAS_PARA_INACTIVO', 'Inasistencias para alertar inactividad', 'Reuniones reportadas consecutivas sin asistir para marcar a un miembro como inactivo en la alerta del Supervisor.', 'NUMERICO', '12', 1, 100, 'visitas', 'CDP', 1, 4),
  ('DIAS_PARA_RE', 'Dias sin asistir para Reconciliado', 'Dias sin asistir tras los cuales, al volver, la persona se marca como Reconciliada.', 'NUMERICO', '90', 7, 730, 'dias', 'SSVA', 1, 5),
  ('EDAD_MINIMA_CREYENTE', 'Edad minima para ser Creyente', 'Edad minima, en anios, para que una persona pueda pasar a estado Creyente.', 'NUMERICO', '12', 0, 30, 'anios', 'SSVA', 1, 6),
  ('CLASES_PARA_DI', 'Clases ausentes para Discipulo Inactivo', 'Clases de discipulado ausentes consecutivas para pasar a Discipulo Inactivo.', 'NUMERICO', '3', 1, 20, 'clases', 'SSVA', 4, 7),
  ('ASISTENCIAS_PARA_DA', 'Asistencias para Discipulo Activo', 'Asistencias a clases de discipulado para pasar a Discipulo Activo.', 'NUMERICO', '1', 1, 20, 'clases', 'SSVA', 4, 8),

  -- Semaforo de inactividad del dashboard del lider (09-dashboards, PENDIENTES.md #7)
  ('DIAS_SEMAFORO_AMARILLO', 'Dias para semaforo amarillo', 'Dias sin asistir a partir de los cuales un miembro aparece en amarillo en la lista del lider.', 'NUMERICO', '14', 1, 365, 'dias', 'CDP', 1, 9),
  ('DIAS_SEMAFORO_ROJO', 'Dias para semaforo rojo', 'Dias sin asistir a partir de los cuales un miembro aparece en rojo en la lista del lider.', 'NUMERICO', '28', 1, 365, 'dias', 'CDP', 1, 10),

  -- Dashboard del sublider (mínimo privilegio: todo apagado por defecto)
  ('SUBLIDER_VE_OFRENDAS', 'Sublider ve ofrendas', 'Permite que el sublider de CdP vea los montos de ofrendas y diezmos.', 'BOOLEANO', 'false', NULL, NULL, NULL, 'DASHBOARD_SUBLIDER', 1, 11),
  ('SUBLIDER_VE_GRAFICOS', 'Sublider ve graficos', 'Permite que el sublider de CdP vea los graficos del dashboard.', 'BOOLEANO', 'false', NULL, NULL, NULL, 'DASHBOARD_SUBLIDER', 1, 12),
  ('SUBLIDER_VE_HISTORIAL', 'Sublider ve historial', 'Permite que el sublider de CdP vea el historial de reportes.', 'BOOLEANO', 'false', NULL, NULL, NULL, 'DASHBOARD_SUBLIDER', 1, 13),
  ('SUBLIDER_PUEDE_EDITAR_REPORTE', 'Sublider puede editar el reporte', 'Permite que el sublider de CdP edite el reporte semanal ya enviado.', 'BOOLEANO', 'false', NULL, NULL, NULL, 'DASHBOARD_SUBLIDER', 1, 14),
  ('SUBLIDER_RECIBE_NOTIFICACIONES', 'Sublider recibe notificaciones', 'Permite que el sublider de CdP reciba notificaciones de proximos eventos.', 'BOOLEANO', 'false', NULL, NULL, NULL, 'DASHBOARD_SUBLIDER', 1, 15),

  -- Obligatoriedad de formularios
  ('MEMBRESIA_OCUPACION_OBLIGATORIO', 'Ocupacion obligatoria en membresia', 'Exige la ocupacion en el formulario de membresia.', 'BOOLEANO', 'false', NULL, NULL, NULL, 'FORMULARIO_MEMBRESIA', 1, 16),
  ('MEMBRESIA_CI_OBLIGATORIO', 'CI obligatorio en membresia', 'Exige el carnet de identidad en el formulario de membresia.', 'BOOLEANO', 'false', NULL, NULL, NULL, 'FORMULARIO_MEMBRESIA', 1, 17),
  ('MEMBRESIA_FECHA_NACIMIENTO_OBLIGATORIO', 'Fecha de nacimiento obligatoria en membresia', 'Exige la fecha de nacimiento en el formulario de membresia.', 'BOOLEANO', 'false', NULL, NULL, NULL, 'FORMULARIO_MEMBRESIA', 1, 18),
  ('MEMBRESIA_GRADO_INSTRUCCION_OBLIGATORIO', 'Grado de instruccion obligatorio en membresia', 'Exige el grado de instruccion en el formulario de membresia.', 'BOOLEANO', 'false', NULL, NULL, NULL, 'FORMULARIO_MEMBRESIA', 1, 19),
  ('REPORTE_TESTIMONIOS_OBLIGATORIO', 'Testimonios obligatorios en el reporte', 'Exige el campo de testimonios en el reporte semanal.', 'BOOLEANO', 'false', NULL, NULL, NULL, 'FORMULARIO_REPORTE', 1, 20),
  ('REPORTE_COMENTARIOS_OBLIGATORIO', 'Comentarios obligatorios en el reporte', 'Exige el campo de comentarios en el reporte semanal.', 'BOOLEANO', 'false', NULL, NULL, NULL, 'FORMULARIO_REPORTE', 1, 21),
  ('REPORTE_DISERTADOR_OBLIGATORIO', 'Disertador obligatorio en el reporte', 'Exige indicar el disertador en el reporte semanal.', 'BOOLEANO', 'true', NULL, NULL, NULL, 'FORMULARIO_REPORTE', 1, 22),
  ('REPORTE_TEMA_OBLIGATORIO', 'Tema obligatorio en el reporte', 'Exige indicar el tema en el reporte semanal.', 'BOOLEANO', 'true', NULL, NULL, NULL, 'FORMULARIO_REPORTE', 1, 23),
  ('REPORTE_SALIO_EVANGELIZAR_VISIBLE', 'Campo "salio a evangelizar" visible', 'Muestra el campo de salida a evangelizar en el formulario del reporte.', 'BOOLEANO', 'true', NULL, NULL, NULL, 'FORMULARIO_REPORTE', 1, 24),

  -- Otros
  ('DIAS_AVISO_EVENTO', 'Dias de aviso de eventos', 'Dias de anticipacion con que se muestran los proximos eventos y cumpleanos.', 'NUMERICO', '7', 1, 90, 'dias', 'NOTIFICACION', 1, 25),
  ('LIDER_VE_GRAFICOS', 'Lider ve graficos', 'Muestra graficos en el dashboard del lider de CdP.', 'BOOLEANO', 'true', NULL, NULL, NULL, 'DASHBOARD_LIDER', 1, 26),
  ('LIDER_RED_VE_COMPARATIVAS', 'Lider de red ve comparativas', 'Muestra comparativas entre periodos en el dashboard del lider de red.', 'BOOLEANO', 'true', NULL, NULL, NULL, 'DASHBOARD_RED', 1, 27),

  -- Conteo de familias (02-persona-parentela, PENDIENTES.md #1 y #8, 2026-07-17)
  ('FAMILIA_CUENTA_CONYUGE', 'Conyuge cuenta para familia', 'Si el conyuge cuenta como pariente directo en el conteo de familias.', 'BOOLEANO', 'true', NULL, NULL, NULL, 'FAMILIA', 1, 28),
  ('FAMILIA_CUENTA_PADRE', 'Padre/Madre cuenta para familia', 'Si el vinculo padre/hijo cuenta como pariente directo en el conteo de familias.', 'BOOLEANO', 'true', NULL, NULL, NULL, 'FAMILIA', 1, 29),
  ('FAMILIA_CUENTA_HIJO', 'Hijo cuenta para familia', 'Si el vinculo hijo/padre cuenta como pariente directo en el conteo de familias.', 'BOOLEANO', 'true', NULL, NULL, NULL, 'FAMILIA', 1, 30),
  ('FAMILIA_CUENTA_ABUELO', 'Abuelo cuenta para familia', 'Si el abuelo cuenta como pariente directo. Desactivarlo da el modo "hogar" en vez de "linaje".', 'BOOLEANO', 'true', NULL, NULL, NULL, 'FAMILIA', 1, 31),
  ('FAMILIA_CUENTA_NIETO', 'Nieto cuenta para familia', 'Si el nieto cuenta como pariente directo. Desactivarlo da el modo "hogar" en vez de "linaje".', 'BOOLEANO', 'true', NULL, NULL, NULL, 'FAMILIA', 1, 32),
  ('FAMILIA_CUENTA_HERMANO', 'Hermano cuenta para familia', 'Si el hermano cuenta como pariente directo (util cuando los padres no estan registrados).', 'BOOLEANO', 'false', NULL, NULL, NULL, 'FAMILIA', 1, 33),
  ('FAMILIA_CUENTA_TIO', 'Tio cuenta para familia', 'Si el tio cuenta como pariente directo en el conteo de familias.', 'BOOLEANO', 'false', NULL, NULL, NULL, 'FAMILIA', 1, 34),
  ('FAMILIA_CUENTA_SOBRINO', 'Sobrino cuenta para familia', 'Si el sobrino cuenta como pariente directo en el conteo de familias.', 'BOOLEANO', 'false', NULL, NULL, NULL, 'FAMILIA', 1, 35),
  ('FAMILIA_CUENTA_PRIMO', 'Primo cuenta para familia', 'Si el primo cuenta como pariente directo en el conteo de familias.', 'BOOLEANO', 'false', NULL, NULL, NULL, 'FAMILIA', 1, 36),
  ('FAMILIA_CUENTA_CUNADO', 'Cunado cuenta para familia', 'Si el cunado cuenta como pariente directo en el conteo de familias.', 'BOOLEANO', 'false', NULL, NULL, NULL, 'FAMILIA', 1, 37),
  ('FAMILIA_CUENTA_SUEGRO', 'Suegro cuenta para familia', 'Si el suegro cuenta como pariente directo en el conteo de familias.', 'BOOLEANO', 'false', NULL, NULL, NULL, 'FAMILIA', 1, 38),
  ('FAMILIA_CUENTA_YERNO', 'Yerno cuenta para familia', 'Si el yerno cuenta como pariente directo en el conteo de familias.', 'BOOLEANO', 'false', NULL, NULL, NULL, 'FAMILIA', 1, 39),

  -- Registro publico por URL de lider (13-registro-publico-cdp, nuevos_requisitos.txt 2026-07-18)
  ('REGISTRO_URL_ACTIVO', 'Registro publico por URL activo', 'Habilita que las personas se registren solas mediante el enlace de su lider de Casa de Paz. Apagado no borra los enlaces, solo deja de aceptar registros por ellos.', 'BOOLEANO', 'false', NULL, NULL, NULL, 'REGISTRO', 1, 40)
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre, descripcion = EXCLUDED.descripcion, tipo = EXCLUDED.tipo,
  valor_defecto = EXCLUDED.valor_defecto, valor_min = EXCLUDED.valor_min, valor_max = EXCLUDED.valor_max,
  unidad = EXCLUDED.unidad, categoria = EXCLUDED.categoria, modulo = EXCLUDED.modulo, orden = EXCLUDED.orden;
