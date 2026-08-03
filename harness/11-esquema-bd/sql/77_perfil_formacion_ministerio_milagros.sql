-- VisionHub -- 77_perfil_formacion_ministerio_milagros.sql
-- Bloque 1 del pedido del owner (2026-08-02): formularios base de perfil.
--
-- Bautizo/Retiro/Discipulado NO se implementan como los modulos completos que
-- ya estan documentados (99-modulos-futuros.md: Modulo 3 Afirmacion, Modulo 4
-- Discipulado, con cursos/prerrequisitos/estados DA-DI). El owner pidio
-- explicitamente la version simple ahora: tres campos sueltos en
-- persona_detalle, sin gatillar ninguna transicion de estado ni tabla
-- `afirmacion` propia. Cuando el Modulo 3/4 se construya de verdad, estos tres
-- campos se migran ahi.
--
-- Milagros es un pedido nuevo, sin diseno previo en domain_knowledge: se
-- modela como registro repetible (una persona puede tener varios a lo largo
-- del tiempo), igual patron que persona_llegada.
--
-- Ministerio en el perfil: la tabla ministerio_persona ya soporta que una
-- persona sea es_lider de varios ministerios a la vez (una fila por
-- ministerio, sin unicidad cruzada) -- no hace falta tocar el esquema, solo
-- exponerlo en fn_persona_ficha.

-- ============================================================
-- 1. Formacion espiritual simple (persona_detalle)
-- ============================================================

CREATE TYPE discipulado_nivel_enum AS ENUM (
  'FUNDAMENTOS_VIDA_REINO',
  'CARACTER_CRISTO_1',
  'CARACTER_CRISTO_2',
  'FAMILIA_FELIZ',
  'PODER_IDENTIDAD_HIJO',
  'LIDERES_CASAS_DE_PAZ',
  'MENTORES_DEL_REINO'
);

ALTER TABLE persona_detalle
  ADD COLUMN fecha_bautizo      DATE,
  ADD COLUMN fecha_retiro       DATE,
  ADD COLUMN discipulado_nivel  discipulado_nivel_enum,
  ADD CONSTRAINT chk_persona_detalle_fecha_bautizo CHECK (fecha_bautizo IS NULL OR fecha_bautizo <= CURRENT_DATE),
  ADD CONSTRAINT chk_persona_detalle_fecha_retiro CHECK (fecha_retiro IS NULL OR fecha_retiro <= CURRENT_DATE);

-- ============================================================
-- 2. Registro de Milagros (repetible, nuevo)
-- ============================================================

CREATE TYPE milagro_categoria_enum AS ENUM (
  'SANIDAD_FISICA',
  'SANIDAD_EMOCIONAL',
  'PROVISION',
  'LIBERACION',
  'RESTAURACION_FAMILIAR',
  'OTRO'
);

CREATE TABLE persona_milagro (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id         UUID NOT NULL REFERENCES persona(id),
  categoria          milagro_categoria_enum NOT NULL,
  detalle            TEXT NOT NULL,
  fecha              DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id),
  CONSTRAINT chk_persona_milagro_fecha CHECK (fecha <= CURRENT_DATE),
  CONSTRAINT chk_persona_milagro_detalle CHECK (btrim(detalle) <> '')
);

CREATE INDEX idx_persona_milagro_persona ON persona_milagro (persona_id, fecha DESC) WHERE fecha_eliminacion IS NULL;

CREATE TRIGGER trg_auditoria_persona_milagro BEFORE INSERT OR UPDATE ON persona_milagro FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_persona_milagro BEFORE DELETE ON persona_milagro FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

-- RLS: mismo patron que persona_detalle (pol_persona_detalle_*, 16_rls.sql) --
-- cualquiera con alcance sobre la iglesia de esa persona puede leer/cargar.
ALTER TABLE persona_milagro ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_persona_milagro_select ON persona_milagro
  FOR SELECT TO authenticated
  USING (
    fecha_eliminacion IS NULL
    AND EXISTS (SELECT 1 FROM persona p WHERE p.id = persona_milagro.persona_id AND p.iglesia_id IN (SELECT fn_mis_iglesias()))
  );

CREATE POLICY pol_persona_milagro_insert ON persona_milagro
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM persona p WHERE p.id = persona_milagro.persona_id AND p.iglesia_id IN (SELECT fn_mis_iglesias())));

CREATE POLICY pol_persona_milagro_update ON persona_milagro
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM persona p WHERE p.id = persona_milagro.persona_id AND p.iglesia_id IN (SELECT fn_mis_iglesias())))
  WITH CHECK (EXISTS (SELECT 1 FROM persona p WHERE p.id = persona_milagro.persona_id AND p.iglesia_id IN (SELECT fn_mis_iglesias())));

-- ============================================================
-- 3. fn_persona_ficha: sumar ministerios, evangelismo y milagros
-- ============================================================
-- CREATE OR REPLACE alcanza -- devuelve JSONB, no RETURNS TABLE, no hace
-- falta DROP (a diferencia de fn_listar_redes/fn_listar_cdp cuando cambian de
-- columnas). Se reescribe completa por legibilidad; el cuerpo previo es
-- 37_directorio_personas.sql.

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
    -- Ministerios: una persona puede liderar o participar de varios a la vez
    -- (una fila de ministerio_persona por ministerio, sin unicidad cruzada).
    'ministerios', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'ministerio_id', m.id, 'nombre', m.nombre, 'es_lider', mp.es_lider
      ) ORDER BY mp.es_lider DESC, m.nombre)
      FROM ministerio_persona mp JOIN ministerio m ON m.id = mp.ministerio_id
      WHERE mp.persona_id = p_persona_id AND mp.fecha_fin IS NULL AND mp.fecha_eliminacion IS NULL
    ), '[]'::jsonb),
    -- Evangelismo de origen: solo lectura, la fecha exacta en que la persona
    -- fue evangelizada (si entro por ese camino). Una persona puede tener a lo
    -- sumo un registro de evangelismo relevante para esto: el mas antiguo.
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
    ), '[]'::jsonb)
  ) INTO v_resultado;

  RETURN v_resultado;
END;
$$;

-- ============================================================
-- 4. Vinculos de perfil: fn_visitas_red necesita el id del lider de CdP,
--    no solo el nombre, para que el frontend pueda linkear a su ficha.
--    RETURNS TABLE cambia de forma -> hace falta DROP + CREATE (mismo caso
--    que fn_listar_redes en 60_red_color.sql).
-- ============================================================

DROP FUNCTION IF EXISTS fn_visitas_red(UUID, DATE, DATE);

CREATE FUNCTION fn_visitas_red(p_red_id UUID, p_desde DATE DEFAULT NULL, p_hasta DATE DEFAULT NULL)
RETURNS TABLE (
  id UUID, casa_de_paz_id UUID, casa_de_paz_etiqueta TEXT, lider_cdp_id UUID, lider_cdp_nombre TEXT,
  motivo motivo_visita_enum, aspectos TEXT[], aspecto_otro_detalle TEXT, observaciones TEXT,
  fecha_visita DATE, hora_registro TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_iglesia_id UUID;
BEGIN
  SELECT red.iglesia_id INTO v_iglesia_id FROM red WHERE red.id = p_red_id;
  IF v_iglesia_id IS NULL OR v_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'RED_FUERA_DE_ALCANCE: sin acceso a la red %', p_red_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (fn_es_lider_de_red(p_red_id) OR fn_es_operativo_en(v_iglesia_id)) THEN
    RAISE EXCEPTION 'RED_FUERA_DE_ALCANCE: sin cargo vigente en la red %', p_red_id USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT v.id, v.casa_de_paz_id, fn_etiqueta_cdp(v.casa_de_paz_id),
         (SELECT p.id FROM persona p
          JOIN casa_de_paz_cargo cc ON cc.persona_id = p.id
          JOIN cargo c ON c.id = cc.cargo_id
          WHERE cc.casa_de_paz_id = v.casa_de_paz_id AND c.codigo = 'LIDER_CDP'
            AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL LIMIT 1),
         (SELECT fn_nombre_completo(p) FROM persona p
          JOIN casa_de_paz_cargo cc ON cc.persona_id = p.id
          JOIN cargo c ON c.id = cc.cargo_id
          WHERE cc.casa_de_paz_id = v.casa_de_paz_id AND c.codigo = 'LIDER_CDP'
            AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL LIMIT 1),
         v.motivo, v.aspectos, v.aspecto_otro_detalle, v.observaciones, v.fecha_visita, v.hora_registro
  FROM visita_cdp v
  WHERE v.red_id = p_red_id AND v.fecha_eliminacion IS NULL
    AND (p_desde IS NULL OR v.fecha_visita >= p_desde)
    AND (p_hasta IS NULL OR v.fecha_visita <= p_hasta)
  ORDER BY v.fecha_visita DESC, v.hora_registro DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_visitas_red(UUID, DATE, DATE) TO authenticated;
