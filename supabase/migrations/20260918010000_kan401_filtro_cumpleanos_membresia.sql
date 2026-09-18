-- VisionHub -- KAN-401 (2026-09-18): filtro Día/Semana/Mes de cumpleaños en
-- la tabla de Membresía (Afirmación/CdP/Supervisión, mismo RPC compartido).
-- Se agrega un parámetro nuevo al final (compatibilidad con llamadas
-- posicionales existentes) que no filtra nada si es NULL (comportamiento
-- actual intacto).
--
-- SEMANA compara contra los 7 días reales de la semana actual (lunes a
-- domingo, generate_series) en vez de reconstruir una fecha candidata desde
-- el año -- evita el problema de fechas inválidas (29/feb en año no
-- bisiesto) sin tener que manejarlo a mano.
CREATE OR REPLACE FUNCTION public.fn_afirmacion_buscar_membresia(
  p_iglesia_id uuid,
  p_texto text DEFAULT NULL::text,
  p_pagina integer DEFAULT 1,
  p_por_pagina integer DEFAULT 50,
  p_red_id uuid DEFAULT NULL::uuid,
  p_casa_de_paz_id uuid DEFAULT NULL::uuid,
  p_estado_id uuid DEFAULT NULL::uuid,
  p_sexo sexo_enum DEFAULT NULL::sexo_enum,
  p_via_registro text DEFAULT NULL::text,
  p_con_profesion boolean DEFAULT NULL::boolean,
  p_estado_civil text DEFAULT NULL::text,
  p_bautizado boolean DEFAULT NULL::boolean,
  p_cumpleanos_periodo text DEFAULT NULL::text
)
RETURNS TABLE(id uuid, primer_nombre character varying, segundo_nombre character varying, primer_apellido character varying, segundo_apellido character varying, nombre_completo text, sexo sexo_enum, fecha_nacimiento date, edad integer, ci character varying, correo character varying, oculto boolean, estado_sigla character varying, estado_nombre character varying, casa_de_paz_id uuid, casa_de_paz_etiqueta text, red_nombre character varying, telefono_principal character varying, via_registro text, membresia_completada boolean, estado_civil text, ocupacion character varying, grado_instruccion text, rango_miembro character varying, bautizado boolean, es_lider_cdp boolean, es_sublider_cdp boolean, es_lider_red boolean, es_sublider_red boolean, discipulados text, seminario boolean, universidad_rey_jesus boolean, bautismo_anio smallint, bautismo_mes smallint, bautismo_dia smallint, bautizado_en_nuestra_iglesia boolean, mentor_nombre text, mentor_es_miembro boolean, conyuge_nombre text, familiares text, ministerios text, efesio_tipo character varying, cargos_censo text, iglesia_id uuid, iglesia_nombre character varying, total bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_por_pagina INT := COALESCE(p_por_pagina, 50);
  v_offset INT := GREATEST(p_pagina - 1, 0) * v_por_pagina;
BEGIN
  IF NOT (
    fn_es_lider_afirmacion_en(p_iglesia_id) OR fn_es_operativo_en(p_iglesia_id) OR fn_es_pastor_en(p_iglesia_id) OR fn_es_super_admin()
    OR (p_casa_de_paz_id IS NOT NULL AND fn_puede_ver_cdp(p_casa_de_paz_id))
  ) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT p.id, p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido,
         fn_nombre_completo(p), p.sexo, p.fecha_nacimiento,
         CASE WHEN p.fecha_nacimiento IS NULL THEN NULL
              ELSE EXTRACT(YEAR FROM age(p.fecha_nacimiento))::INT END,
         p.ci, p.correo, p.oculto,
         e.sigla, e.nombre,
         cdp.id, CASE WHEN cdp.id IS NOT NULL THEN fn_etiqueta_cdp(cdp.id) ELSE NULL END,
         r.nombre,
         tel.numero,
         CASE
           WHEN llegada.motivo_codigo = 'INVITACION_PERSONAL' AND llegada.casa_paz_url_id IS NOT NULL THEN 'URL'
           WHEN llegada.motivo_codigo = 'INVITACION_PERSONAL' AND llegada.casa_paz_url_id IS NULL THEN 'FORMULARIO'
           ELSE NULL
         END,
         p.membresia_completada,
         pd.estado_civil::TEXT,
         pd.ocupacion,
         pd.grado_instruccion::TEXT,
         pcm.rango_miembro,
         COALESCE(pd.bautizado, false),
         EXISTS (
           SELECT 1 FROM casa_de_paz_cargo cc JOIN cargo c ON c.id = cc.cargo_id
           WHERE cc.persona_id = p.id AND c.codigo = 'LIDER_CDP' AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
         ),
         EXISTS (
           SELECT 1 FROM casa_de_paz_cargo cc JOIN cargo c ON c.id = cc.cargo_id
           WHERE cc.persona_id = p.id AND c.codigo = 'SUBLIDER_CDP' AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
         ),
         EXISTS (
           SELECT 1 FROM red_cargo rc JOIN cargo c ON c.id = rc.cargo_id
           WHERE rc.persona_id = p.id AND c.codigo = 'LIDER_RED' AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
         ),
         EXISTS (
           SELECT 1 FROM red_cargo rc JOIN cargo c ON c.id = rc.cargo_id
           WHERE rc.persona_id = p.id AND c.codigo = 'SUBLIDER_RED' AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
         ),
         disc.lista,
         EXISTS (SELECT 1 FROM persona_seminario ps WHERE ps.persona_id = p.id AND ps.fecha_eliminacion IS NULL),
         EXISTS (SELECT 1 FROM persona_universidad_rey_jesus pu WHERE pu.persona_id = p.id AND pu.fecha_eliminacion IS NULL),
         pd.bautismo_anio, pd.bautismo_mes, pd.bautismo_dia, pd.bautizado_en_nuestra_iglesia,
         ment.mentor_nombre_txt::TEXT, ment.mentor_es_miembro,
         conyuge.nombre_familiar::TEXT,
         fam.lista,
         mini.lista,
         pcm.efesio_tipo,
         NULLIF(
           CONCAT_WS(', ',
             CASE WHEN pcm.cargo_ministro THEN 'Ministro' END,
             CASE WHEN pcm.cargo_anciano THEN 'Anciano' END,
             CASE WHEN pcm.cargo_diacono THEN 'Diácono' END,
             CASE WHEN pcm.cargo_mentor THEN 'Mentor' END,
             CASE WHEN pcm.cargo_sub_mentor THEN 'Submentor' END,
             CASE WHEN pcm.cargo_lider_cdp THEN 'Líder CdP (censo)' END,
             CASE WHEN pcm.cargo_sublider_cdp THEN 'Sublíder CdP (censo)' END
           ), ''
         ),
         p.iglesia_id, ig.nombre,
         count(*) OVER()
  FROM persona p
  LEFT JOIN iglesia ig ON ig.id = p.iglesia_id
  LEFT JOIN persona_estado pe ON pe.persona_id = p.id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL
  LEFT JOIN estado e ON e.id = pe.estado_id
  LEFT JOIN casa_de_paz_membresia cm ON cm.persona_id = p.id AND cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL
  LEFT JOIN casa_de_paz cdp ON cdp.id = cm.casa_de_paz_id
  LEFT JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = cdp.id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
  LEFT JOIN red r ON r.id = cdr.red_id
  LEFT JOIN telefono_asignacion ta ON ta.persona_id = p.id AND ta.es_principal AND ta.activo AND ta.fecha_eliminacion IS NULL
  LEFT JOIN telefono tel ON tel.id = ta.telefono_id
  LEFT JOIN persona_detalle pd ON pd.persona_id = p.id AND pd.fecha_eliminacion IS NULL
  LEFT JOIN persona_censo_membresia pcm ON pcm.persona_id = p.id AND pcm.fecha_eliminacion IS NULL
  LEFT JOIN LATERAL (
    SELECT pl.casa_paz_url_id, ml.codigo AS motivo_codigo
    FROM persona_llegada pl
    JOIN motivo_llegada ml ON ml.id = pl.motivo_llegada_id
    WHERE pl.persona_id = p.id AND pl.fecha_eliminacion IS NULL
    ORDER BY pl.fecha_creacion DESC
    LIMIT 1
  ) llegada ON true
  LEFT JOIN LATERAL (
    SELECT string_agg(td.nombre, ', ' ORDER BY td.orden) AS lista
    FROM persona_discipulado pdis
    JOIN tipo_discipulado td ON td.id = pdis.tipo_discipulado_id
    WHERE pdis.persona_id = p.id AND pdis.fecha_eliminacion IS NULL
  ) disc ON true
  LEFT JOIN LATERAL (
    SELECT pm.mentor_nombre_txt, pm.mentor_es_miembro
    FROM persona_mentor pm
    WHERE pm.persona_id = p.id AND pm.fecha_eliminacion IS NULL
    LIMIT 1
  ) ment ON true
  LEFT JOIN LATERAL (
    SELECT rf.nombre_familiar
    FROM referencia_familiar rf
    JOIN tipo_relacion tr ON tr.id = rf.tipo_relacion_id
    WHERE rf.persona_id = p.id AND tr.codigo = 'CONYUGE' AND rf.fecha_eliminacion IS NULL
    LIMIT 1
  ) conyuge ON true
  LEFT JOIN LATERAL (
    SELECT string_agg(tr.nombre || ': ' || rf.nombre_familiar, '; ' ORDER BY tr.orden) AS lista
    FROM referencia_familiar rf
    JOIN tipo_relacion tr ON tr.id = rf.tipo_relacion_id
    WHERE rf.persona_id = p.id AND tr.codigo <> 'CONYUGE' AND rf.fecha_eliminacion IS NULL
  ) fam ON true
  LEFT JOIN LATERAL (
    SELECT string_agg(m.nombre, ', ' ORDER BY m.orden) AS lista
    FROM ministerio_persona mp
    JOIN ministerio m ON m.id = mp.ministerio_id
    WHERE mp.persona_id = p.id AND mp.fecha_fin IS NULL AND mp.fecha_eliminacion IS NULL
  ) mini ON true
  WHERE p.iglesia_id = p_iglesia_id
    AND p.fecha_eliminacion IS NULL
    AND NOT p.oculto
    AND NOT EXISTS (
      SELECT 1 FROM evangelismo ev
      JOIN tipo_evangelismo te ON te.id = ev.tipo_evangelismo_id
      WHERE ev.persona_id = p.id AND te.codigo = 'SEMILLA' AND ev.fecha_eliminacion IS NULL
    )
    AND (
      p_texto IS NULL OR btrim(p_texto) = '' OR
      fn_nombre_completo(p) ILIKE '%' || p_texto || '%' OR
      p.ci ILIKE '%' || p_texto || '%' OR
      p.correo ILIKE '%' || p_texto || '%'
    )
    AND (p_red_id IS NULL OR r.id = p_red_id)
    AND (p_casa_de_paz_id IS NULL OR cdp.id = p_casa_de_paz_id)
    AND (p_estado_id IS NULL OR e.id = p_estado_id)
    AND (p_sexo IS NULL OR p.sexo = p_sexo)
    AND (
      p_via_registro IS NULL OR
      p_via_registro = (
        CASE
          WHEN llegada.motivo_codigo = 'INVITACION_PERSONAL' AND llegada.casa_paz_url_id IS NOT NULL THEN 'URL'
          WHEN llegada.motivo_codigo = 'INVITACION_PERSONAL' AND llegada.casa_paz_url_id IS NULL THEN 'FORMULARIO'
          ELSE NULL
        END
      )
    )
    AND (
      p_con_profesion IS NULL OR
      (pd.ocupacion IS NOT NULL AND btrim(pd.ocupacion) <> '') = p_con_profesion
    )
    AND (p_estado_civil IS NULL OR pd.estado_civil::TEXT = p_estado_civil)
    AND (p_bautizado IS NULL OR COALESCE(pd.bautizado, false) = p_bautizado)
    AND (
      p_cumpleanos_periodo IS NULL
      OR (
        p.fecha_nacimiento IS NOT NULL AND (
          (p_cumpleanos_periodo = 'DIA'
            AND EXTRACT(MONTH FROM p.fecha_nacimiento) = EXTRACT(MONTH FROM CURRENT_DATE)
            AND EXTRACT(DAY FROM p.fecha_nacimiento) = EXTRACT(DAY FROM CURRENT_DATE))
          OR (p_cumpleanos_periodo = 'MES'
            AND EXTRACT(MONTH FROM p.fecha_nacimiento) = EXTRACT(MONTH FROM CURRENT_DATE))
          OR (p_cumpleanos_periodo = 'SEMANA' AND EXISTS (
                SELECT 1 FROM generate_series(
                  date_trunc('week', CURRENT_DATE)::date,
                  date_trunc('week', CURRENT_DATE)::date + 6,
                  INTERVAL '1 day'
                ) AS dia(d)
                WHERE EXTRACT(MONTH FROM d) = EXTRACT(MONTH FROM p.fecha_nacimiento)
                  AND EXTRACT(DAY FROM d) = EXTRACT(DAY FROM p.fecha_nacimiento)
              ))
        )
      )
    )
  ORDER BY p.primer_apellido, p.primer_nombre
  LIMIT v_por_pagina OFFSET v_offset;
END;
$function$;
