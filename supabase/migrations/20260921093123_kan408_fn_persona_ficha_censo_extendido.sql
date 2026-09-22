-- VisionHub -- KAN-408 seguimiento (2026-09-21, pedido explicito del
-- owner): "Editar membresia" desde Mi cuenta debe mostrar las mismas
-- secciones que el formulario de 10 pasos (Discipulados, Seminario y
-- Universidad, Mentor, Cargo y posicion) -- fn_persona_ficha hoy NO
-- devuelve nada de esto (confirmado leyendo la funcion completa antes de
-- tocarla). Se agrega sin quitar ningun campo existente -- CREATE OR
-- REPLACE alcanza, la forma del JSON sigue siendo compatible hacia atras
-- (solo se agregan claves nuevas).
--
-- Los 4 grupos nuevos usan la misma unicidad real de la base (confirmada
-- con pg_indexes antes de escribir esto): persona_censo_membresia tiene
-- UNIQUE(persona_id) real; persona_seminario/persona_universidad_rey_jesus/
-- persona_mentor tienen un indice unico PARCIAL por persona_id WHERE
-- fecha_eliminacion IS NULL (a lo sumo 1 fila viva por persona) --
-- devolver el `id` de esa fila viva es lo que le permite al frontend
-- editarla/borrarla de forma segura en vez de reinsertar (que duplicaria).
CREATE OR REPLACE FUNCTION fn_persona_ficha(p_persona_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_iglesia_id UUID;
  v_resultado JSONB;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM persona WHERE id = p_persona_id AND fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'PERSONA_NO_ENCONTRADA' USING ERRCODE = 'P0001';
  END IF;
  IF v_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'IGLESIA_FUERA_DE_ALCANCE' USING ERRCODE = 'P0001';
  END IF;

  SELECT jsonb_build_object(
    'persona', (
      SELECT jsonb_build_object(
        'id', p.id, 'iglesia_id', p.iglesia_id,
        'primer_nombre', p.primer_nombre, 'segundo_nombre', p.segundo_nombre,
        'primer_apellido', p.primer_apellido, 'segundo_apellido', p.segundo_apellido,
        'apellido_casada', p.apellido_casada, 'mostrar_apellido_casada', p.mostrar_apellido_casada,
        'nombre_completo', fn_nombre_completo(p),
        'sexo', p.sexo, 'fecha_nacimiento', p.fecha_nacimiento,
        'edad', CASE WHEN p.fecha_nacimiento IS NULL THEN NULL ELSE EXTRACT(YEAR FROM age(p.fecha_nacimiento))::INT END,
        'ci', p.ci, 'correo', p.correo, 'oculto', p.oculto,
        'sugerencia_apellido_casada', fn_sugerir_apellido_casada(p.id)
      )
      FROM persona p WHERE p.id = p_persona_id
    ),
    'detalle', (
      SELECT jsonb_build_object(
        'nacimiento_ciudad', pd.nacimiento_ciudad, 'estado_civil', pd.estado_civil,
        'grado_instruccion', pd.grado_instruccion, 'ocupacion', pd.ocupacion,
        'fecha_bautizo', pd.fecha_bautizo, 'fecha_retiro', pd.fecha_retiro,
        'discipulado_nivel', pd.discipulado_nivel
      )
      FROM persona_detalle pd WHERE pd.persona_id = p_persona_id AND pd.fecha_eliminacion IS NULL
    ),
    'direcciones', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'asignacion_id', da.id, 'direccion_id', d.id,
        'ciudad', d.ciudad, 'zona', d.zona, 'anillo', d.anillo, 'calle', d.calle,
        'numero', d.numero, 'referencia', d.referencia, 'url_gps', d.url_gps,
        'observaciones', d.observaciones, 'es_principal', da.es_principal, 'activo', da.activo
      ) ORDER BY da.es_principal DESC, da.fecha_creacion)
      FROM direccion_asignacion da JOIN direccion d ON d.id = da.direccion_id
      WHERE da.persona_id = p_persona_id AND da.fecha_eliminacion IS NULL
    ), '[]'::jsonb),
    'telefonos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'asignacion_id', ta.id, 'telefono_id', t.id,
        'tipo_codigo', tt.codigo, 'tipo_nombre', tt.nombre,
        'numero', t.numero, 'observaciones', t.observaciones,
        'es_principal', ta.es_principal, 'activo', ta.activo
      ) ORDER BY ta.es_principal DESC, ta.fecha_creacion)
      FROM telefono_asignacion ta
      JOIN telefono t ON t.id = ta.telefono_id
      JOIN tipo_telefono tt ON tt.id = t.tipo_telefono_id
      WHERE ta.persona_id = p_persona_id AND ta.fecha_eliminacion IS NULL
    ), '[]'::jsonb),
    'llegadas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pl.id, 'motivo_codigo', ml.codigo, 'motivo_nombre', ml.nombre,
        'fecha_ingreso', pl.fecha_ingreso,
        'invitado_por_id', pl.invitado_por_id,
        'invitado_por_nombre', (SELECT fn_nombre_completo(ip) FROM persona ip WHERE ip.id = pl.invitado_por_id),
        'invitado_por_txt', pl.invitado_por_txt, 'comentarios', pl.comentarios
      ) ORDER BY pl.fecha_ingreso DESC)
      FROM persona_llegada pl JOIN motivo_llegada ml ON ml.id = pl.motivo_llegada_id
      WHERE pl.persona_id = p_persona_id AND pl.fecha_eliminacion IS NULL
    ), '[]'::jsonb),
    'familia', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', f.id, 'familiar_id', fp.id, 'familiar_nombre', fn_nombre_completo(fp),
        'tipo_codigo', tr.codigo, 'tipo_nombre', tr.nombre
      ) ORDER BY tr.orden)
      FROM familia f
      JOIN persona fp ON fp.id = f.familiar_id
      JOIN tipo_relacion tr ON tr.id = f.tipo_relacion_id
      WHERE f.persona_id = p_persona_id AND f.fecha_eliminacion IS NULL
    ), '[]'::jsonb),
    'referencias_familiares', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', rf.id, 'nombre_familiar', rf.nombre_familiar,
        'tipo_codigo', tr.codigo, 'tipo_nombre', tr.nombre
      ) ORDER BY tr.orden)
      FROM referencia_familiar rf JOIN tipo_relacion tr ON tr.id = rf.tipo_relacion_id
      WHERE rf.persona_id = p_persona_id AND rf.fecha_eliminacion IS NULL
    ), '[]'::jsonb),
    'estado_actual', (
      SELECT jsonb_build_object('sigla', e.sigla, 'nombre', e.nombre, 'fecha_inicio', pe.fecha_inicio)
      FROM persona_estado pe JOIN estado e ON e.id = pe.estado_id
      WHERE pe.persona_id = p_persona_id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL
    ),
    'casa_de_paz', (
      SELECT jsonb_build_object('id', cdp.id, 'etiqueta', fn_etiqueta_cdp(cdp.id), 'red_id', r.id, 'red_nombre', r.nombre)
      FROM casa_de_paz_membresia cm
      JOIN casa_de_paz cdp ON cdp.id = cm.casa_de_paz_id
      LEFT JOIN casa_de_paz_red cr ON cr.casa_de_paz_id = cdp.id AND cr.fecha_fin IS NULL AND cr.fecha_eliminacion IS NULL
      LEFT JOIN red r ON r.id = cr.red_id
      WHERE cm.persona_id = p_persona_id AND cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL
      LIMIT 1
    ),
    'cargos', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT jsonb_build_object('ambito', 'IGLESIA', 'entidad', i.nombre, 'cargo_codigo', c.codigo, 'cargo_nombre', c.nombre) AS x
        FROM persona_cargo pc JOIN cargo c ON c.id = pc.cargo_id JOIN iglesia i ON i.id = pc.iglesia_id
        WHERE pc.persona_id = p_persona_id AND pc.fecha_fin IS NULL AND pc.fecha_eliminacion IS NULL
        UNION ALL
        SELECT jsonb_build_object('ambito', 'RED', 'entidad', r.nombre, 'cargo_codigo', c.codigo, 'cargo_nombre', c.nombre)
        FROM red_cargo rc JOIN cargo c ON c.id = rc.cargo_id JOIN red r ON r.id = rc.red_id
        WHERE rc.persona_id = p_persona_id AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
        UNION ALL
        SELECT jsonb_build_object('ambito', 'CDP', 'entidad', fn_etiqueta_cdp(cd.id), 'cargo_codigo', c.codigo, 'cargo_nombre', c.nombre)
        FROM casa_de_paz_cargo cc JOIN cargo c ON c.id = cc.cargo_id JOIN casa_de_paz cd ON cd.id = cc.casa_de_paz_id
        WHERE cc.persona_id = p_persona_id AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
      ) sub
    ), '[]'::jsonb),
    'ministerios', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'participante_id', mp.id, 'ministerio_id', m.id, 'nombre', m.nombre, 'es_lider', mp.es_lider
      ) ORDER BY mp.es_lider DESC, m.nombre)
      FROM ministerio_persona mp JOIN ministerio m ON m.id = mp.ministerio_id
      WHERE mp.persona_id = p_persona_id AND mp.fecha_fin IS NULL AND mp.fecha_eliminacion IS NULL
    ), '[]'::jsonb),
    'evangelismo', (
      SELECT jsonb_build_object(
        'fecha', ev.fecha,
        'tipo_evangelismo_nombre', te.nombre,
        'evangelizado_por_nombre', (SELECT fn_nombre_completo(ep) FROM persona ep WHERE ep.id = ev.evangelizado_por_id),
        'casa_de_paz_etiqueta', fn_etiqueta_cdp(ev.casa_de_paz_id)
      )
      FROM evangelismo ev
      LEFT JOIN tipo_evangelismo te ON te.id = ev.tipo_evangelismo_id
      WHERE ev.persona_id = p_persona_id AND ev.fecha_eliminacion IS NULL
      ORDER BY ev.fecha ASC LIMIT 1
    ),
    'milagros', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pm.id, 'categoria', pm.categoria, 'detalle', pm.detalle, 'fecha', pm.fecha
      ) ORDER BY pm.fecha DESC)
      FROM persona_milagro pm
      WHERE pm.persona_id = p_persona_id AND pm.fecha_eliminacion IS NULL
    ), '[]'::jsonb),
    -- KAN-408: los 4 grupos que faltaban del formulario de 10 pasos.
    'discipulados', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pdis.id, 'tipo_discipulado_id', td.id, 'tipo_discipulado_nombre', td.nombre,
        'anio', pdis.anio, 'mes', pdis.mes, 'dia', pdis.dia, 'precision_fecha', pdis.precision_fecha
      ) ORDER BY td.orden)
      FROM persona_discipulado pdis JOIN tipo_discipulado td ON td.id = pdis.tipo_discipulado_id
      WHERE pdis.persona_id = p_persona_id AND pdis.fecha_eliminacion IS NULL
    ), '[]'::jsonb),
    'seminario', (
      SELECT jsonb_build_object('id', ps.id, 'anio', ps.anio, 'mes', ps.mes, 'dia', ps.dia, 'precision_fecha', ps.precision_fecha)
      FROM persona_seminario ps WHERE ps.persona_id = p_persona_id AND ps.fecha_eliminacion IS NULL
    ),
    'universidad', (
      SELECT jsonb_build_object('id', pu.id, 'anio', pu.anio, 'mes', pu.mes, 'dia', pu.dia, 'precision_fecha', pu.precision_fecha)
      FROM persona_universidad_rey_jesus pu WHERE pu.persona_id = p_persona_id AND pu.fecha_eliminacion IS NULL
    ),
    'mentor', (
      SELECT jsonb_build_object('id', pm.id, 'mentor_nombre_txt', pm.mentor_nombre_txt, 'mentor_es_miembro', pm.mentor_es_miembro)
      FROM persona_mentor pm WHERE pm.persona_id = p_persona_id AND pm.fecha_eliminacion IS NULL
    ),
    'censo', (
      SELECT jsonb_build_object(
        'efesio_tipo', pcm.efesio_tipo, 'rango_miembro', pcm.rango_miembro,
        'cargo_ministro', pcm.cargo_ministro, 'cargo_anciano', pcm.cargo_anciano, 'cargo_diacono', pcm.cargo_diacono,
        'cargo_mentor', pcm.cargo_mentor, 'cargo_sub_mentor', pcm.cargo_sub_mentor,
        'cargo_lider_cdp', pcm.cargo_lider_cdp, 'cargo_sublider_cdp', pcm.cargo_sublider_cdp,
        'cargo_lider_ministerio', pcm.cargo_lider_ministerio
      )
      FROM persona_censo_membresia pcm WHERE pcm.persona_id = p_persona_id AND pcm.fecha_eliminacion IS NULL
    )
  ) INTO v_resultado;

  RETURN v_resultado;
END;
$$;
