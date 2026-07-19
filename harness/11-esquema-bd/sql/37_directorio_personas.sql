-- VisionHub -- 37_directorio_personas.sql
-- Modulo Personas: busqueda, ficha completa (JSONB) y restriccion de 'oculto'.

CREATE OR REPLACE FUNCTION fn_buscar_personas(
  p_iglesia_id UUID,
  p_texto TEXT DEFAULT NULL,
  p_incluir_ocultas BOOLEAN DEFAULT false,
  p_limite INT DEFAULT 200
)
RETURNS TABLE (
  id UUID, nombre_completo TEXT, sexo sexo_enum, fecha_nacimiento DATE, edad INT,
  ci VARCHAR, correo VARCHAR, oculto BOOLEAN,
  estado_sigla VARCHAR, estado_nombre VARCHAR,
  casa_de_paz_id UUID, casa_de_paz_etiqueta TEXT,
  telefono_principal VARCHAR
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'IGLESIA_FUERA_DE_ALCANCE' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT p.id, fn_nombre_completo(p), p.sexo, p.fecha_nacimiento,
         CASE WHEN p.fecha_nacimiento IS NULL THEN NULL
              ELSE EXTRACT(YEAR FROM age(p.fecha_nacimiento))::INT END,
         p.ci, p.correo, p.oculto,
         e.sigla, e.nombre,
         cdp.id, CASE WHEN cdp.id IS NOT NULL THEN fn_etiqueta_cdp(cdp.id) ELSE NULL END,
         tel.numero
  FROM persona p
  LEFT JOIN persona_estado pe ON pe.persona_id = p.id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL
  LEFT JOIN estado e ON e.id = pe.estado_id
  LEFT JOIN casa_de_paz_membresia cm ON cm.persona_id = p.id AND cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL
  LEFT JOIN casa_de_paz cdp ON cdp.id = cm.casa_de_paz_id
  LEFT JOIN telefono_asignacion ta ON ta.persona_id = p.id AND ta.es_principal AND ta.activo AND ta.fecha_eliminacion IS NULL
  LEFT JOIN telefono tel ON tel.id = ta.telefono_id
  WHERE p.iglesia_id = p_iglesia_id
    AND p.fecha_eliminacion IS NULL
    AND (p_incluir_ocultas OR NOT p.oculto)
    AND (
      p_texto IS NULL OR btrim(p_texto) = '' OR
      fn_nombre_completo(p) ILIKE '%' || p_texto || '%' OR
      p.ci ILIKE '%' || p_texto || '%' OR
      p.correo ILIKE '%' || p_texto || '%'
    )
  ORDER BY p.primer_apellido, p.primer_nombre
  LIMIT p_limite;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_buscar_personas(UUID, TEXT, BOOLEAN, INT) TO authenticated;

-- Ficha completa de una persona: una sola llamada para toda la vista de detalle.
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
        'grado_instruccion', pd.grado_instruccion, 'ocupacion', pd.ocupacion
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
    ), '[]'::jsonb)
  ) INTO v_resultado;

  RETURN v_resultado;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_persona_ficha(UUID) TO authenticated;

-- Req 10.3: solo Pastor/Supervisor (el "ADMIN" del requisito, en este sistema
-- fn_es_admin_en fue reemplazada por fn_es_operativo_en) puede cambiar 'oculto'.
CREATE OR REPLACE FUNCTION fn_restringir_oculto()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT fn_es_operativo_en(NEW.iglesia_id) THEN
    RAISE EXCEPTION 'OCULTO_REQUIERE_OPERATIVO: solo el Pastor o Supervisor puede cambiar la visibilidad de una persona'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_restringir_oculto
  BEFORE UPDATE ON persona
  FOR EACH ROW
  WHEN (NEW.oculto IS DISTINCT FROM OLD.oculto)
  EXECUTE FUNCTION fn_restringir_oculto();
