-- VisionHub -- paridad_pastor_supervisor
-- Pedido explicito del equipo (2026-08-09): Pastor debe compartir exactamente
-- el mismo menu/permisos que Supervisor de la Vision en Accion en toda la
-- app, ademas de un acceso condicional a Estructura Organizacional de su
-- propia iglesia. Confirmado que se quiere paridad COMPLETA de backend, no
-- solo un cambio de menu en el frontend.
--
-- Hallazgo que respalda este cambio: al auditar las funciones que usan
-- fn_es_operativo_en (el helper que hoy solo da true para
-- SUPERVISOR_VISION_ACCION), casi todas tienen un mensaje de error que dice
-- literalmente "se requiere ser Pastor o Supervisor..." pero el codigo solo
-- valida fn_es_operativo_en, sin fn_es_pastor_en -- el modelo de permisos ya
-- estaba pensado para dar paridad a Pastor, solo quedo incompleto.
--
-- NO se toca fn_es_operativo_en en si (ni fn_es_pastor_en): ampliar ese
-- primitivo directamente contaminaria la resolucion de rol del frontend
-- (fn_mis_iglesias_detalle / fn_mis_roles_dashboard devuelven "es_operativo"
-- como metadata separada de "es_pastor" para el picker de rol -- si
-- fn_es_operativo_en pasara a ser true para Pastor, todo Pastor veria
-- "Supervisor" como una opcion fantasma en "Cambiar rol"). En su lugar, se
-- agrega "OR fn_es_pastor_en(<misma iglesia>)" puntualmente en cada funcion
-- que gatea una accion u observacion real.
--
-- NO tocadas a proposito (documentado, no es un olvido):
--  - fn_es_operativo_en, fn_es_pastor_en: primitivos, ver arriba.
--  - fn_es_operativo_en_o_padre_de: helper de iglesias satelite; sus
--    llamadores (ej. fn_eventos_iglesia) ya lo combinan por separado con
--    fn_es_pastor_en_o_padre_de cuando corresponde.
--  - fn_mis_iglesias_detalle, fn_mis_roles_dashboard: calculan es_operativo
--    y es_pastor como dos campos separados a proposito (metadata de UI).
--  - fn_mi_titulo: ya prioriza Pastor antes que Supervisor para el titulo.
--  - fn_estructura_puede_administrar_red: delega en
--    fn_estructura_puede_administrar, hereda la paridad automaticamente.
--  - fn_estructura_asignar_pastor / fn_estructura_asignar_supervisor:
--    exclusivas de Super Admin a proposito (decidir QUIEN es el pastor/
--    supervisor de una iglesia sigue siendo decision de Super Admin).
--  - fn_estructura_asignar_cargo_red (Lider/Sublider de Red) y su
--    equivalente de Casa de Paz: exigen que la persona pertenezca a esa
--    iglesia por diseno (ESTRUCTURA_PERSONA_FUERA_DE_IGLESIA), no
--    relacionado con este cambio.
--  - fn_set_configuracion(uuid, varchar, text) de 3 parametros (sin p_pin):
--    ese overload no tiene NINGUN chequeo de permiso hoy (ni siquiera
--    fn_es_operativo_en) -- preexistente, fuera de alcance de este fix.

CREATE OR REPLACE FUNCTION public.fn_alertas_supervisor(p_iglesia_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (fn_es_operativo_en(p_iglesia_id) OR fn_es_pastor_en(p_iglesia_id)) THEN
    RAISE EXCEPTION 'DASHBOARD_FUERA_DE_ALCANCE: se requiere ser Pastor o Supervisor en la iglesia %', p_iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object(
    'cdp_sin_reporte', (SELECT jsonb_agg(to_jsonb(x)) FROM fn_cdp_sin_reporte(p_iglesia_id) x),
    'redes_incompletas', (
      SELECT jsonb_agg(to_jsonb(x)) FROM fn_redes_incompletas(p_iglesia_id) x
      WHERE x.falta_departamentos OR x.falta_ministerio
    ),
    'evangelismo_discrepante', (
      SELECT jsonb_agg(to_jsonb(x)) FROM v_reporte_evangelismo x
      JOIN casa_de_paz c ON c.id = x.casa_de_paz_id
      WHERE c.iglesia_id = p_iglesia_id AND x.diferencia <> 0 AND x.fecha_reunion >= CURRENT_DATE - 30
    ),
    'cdp_sin_red', (
      SELECT jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre))
      FROM casa_de_paz c
      WHERE c.iglesia_id = p_iglesia_id AND c.activo AND c.fecha_eliminacion IS NULL
        AND NOT EXISTS (SELECT 1 FROM casa_de_paz_red cdr WHERE cdr.casa_de_paz_id = c.id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL)
    ),
    'iglesia_sin_autoridad', (
      SELECT jsonb_agg(jsonb_build_object('id', i.id, 'nombre', i.nombre, 'falta_pastor', i.pastor_id IS NULL, 'falta_supervisor', i.supervisor_id IS NULL))
      FROM iglesia i WHERE i.id = p_iglesia_id AND (i.pastor_id IS NULL OR i.supervisor_id IS NULL)
    ),
    'miembros_inactivos', (
      SELECT jsonb_agg(jsonb_build_object('casa_de_paz', c.nombre, 'cantidad', sub.n))
      FROM casa_de_paz c
      CROSS JOIN LATERAL (SELECT count(*) AS n FROM fn_inactividad_cdp(c.id) i WHERE i.supera_umbral) sub
      WHERE c.iglesia_id = p_iglesia_id AND c.activo AND c.fecha_eliminacion IS NULL AND sub.n > 0
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_aprobar_solicitud_estructura(p_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_sol solicitud_estructura%rowtype;
  v_resultado uuid;
begin
  select * into v_sol from solicitud_estructura where id = p_id;
  if not found then
    raise exception 'SOLICITUD_NO_ENCONTRADA: no existe esa solicitud' using errcode = 'P0001';
  end if;
  if v_sol.estado <> 'PENDIENTE' then
    raise exception 'SOLICITUD_YA_RESUELTA: esta solicitud ya fue resuelta' using errcode = 'P0001';
  end if;
  if not (fn_es_lider_de_red(v_sol.red_id) or fn_es_operativo_en(v_sol.iglesia_id) or fn_es_pastor_en(v_sol.iglesia_id)) then
    raise exception 'SOLICITUD_SIN_PERMISO: se requiere ser el Lider de esa Red, o Pastor/Supervisor' using errcode = 'P0001';
  end if;

  case v_sol.tipo
    when 'FUSIONAR_CDP' then
      select fn_fusionar_cdp(
        (v_sol.payload->>'origen_id')::uuid, (v_sol.payload->>'destino_id')::uuid, v_sol.payload->>'motivo'
      ) into v_resultado;
    when 'FUSIONAR_RED' then
      select fn_fusionar_red(
        (v_sol.payload->>'origen_id')::uuid, (v_sol.payload->>'destino_id')::uuid, v_sol.payload->>'motivo'
      ) into v_resultado;
    when 'MULTIPLICAR_CDP' then
      select fn_multiplicar_cdp(
        (v_sol.payload->>'origen_id')::uuid, v_sol.payload->>'nombre_nueva',
        (select array_agg(x::uuid) from jsonb_array_elements_text(v_sol.payload->'persona_ids') x),
        nullif(v_sol.payload->>'lider_nuevo_id', '')::uuid, v_sol.payload->>'motivo'
      ) into v_resultado;
    when 'MULTIPLICAR_RED' then
      select fn_multiplicar_red(
        (v_sol.payload->>'origen_id')::uuid, v_sol.payload->>'nombre_nueva',
        (select array_agg(x::uuid) from jsonb_array_elements_text(v_sol.payload->'cdp_ids') x),
        nullif(v_sol.payload->>'lider_nuevo_id', '')::uuid, v_sol.payload->>'motivo'
      ) into v_resultado;
    when 'CAMBIAR_LIDER_RED' then
      select fn_asignar_cargo_red(
        (v_sol.payload->>'red_id')::uuid, (v_sol.payload->>'persona_id')::uuid,
        v_sol.payload->>'codigo', (v_sol.payload->>'cargo_id')::uuid
      ) into v_resultado;
    when 'CAMBIAR_LIDER_CDP' then
      select fn_asignar_cargo_cdp(
        (v_sol.payload->>'cdp_id')::uuid, (v_sol.payload->>'persona_id')::uuid,
        v_sol.payload->>'codigo', (v_sol.payload->>'cargo_id')::uuid
      ) into v_resultado;
    when 'MOVER_PERSONA_RED' then
      select fn_mover_persona_red(
        (v_sol.payload->>'persona_id')::uuid, (v_sol.payload->>'casa_de_paz_destino_id')::uuid,
        v_sol.payload->>'motivo', coalesce((v_sol.payload->>'confirmar_cierre_cargos')::boolean, false)
      ) into v_resultado;
    else
      raise exception 'SOLICITUD_TIPO_DESCONOCIDO: tipo % no soportado', v_sol.tipo using errcode = 'P0001';
  end case;

  update solicitud_estructura
  set estado = 'APROBADA', fecha_resolucion = now(), resuelta_por_persona_id = fn_mi_persona_id()
  where id = p_id;

  perform fn_crear_notificacion(v_sol.solicitante_persona_id, 'SOLICITUD_RESUELTA',
    'Tu solicitud fue aprobada', 'El Líder de Red autorizó la acción que solicitaste.', 'solicitud_estructura', p_id);

  return v_resultado;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_asignar_cargo_cdp(p_cdp_id uuid, p_persona_id uuid, p_codigo text, p_cargo_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_iglesia_id UUID;
  v_red_id UUID;
  v_lider_vigente UUID;
  v_solicitud_id UUID;
  v_id UUID;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM casa_de_paz WHERE id = p_cdp_id AND fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'CDP_INEXISTENTE: la casa de paz no existe' USING ERRCODE = 'P0001';
  END IF;

  SELECT red_id INTO v_red_id FROM casa_de_paz_red
  WHERE casa_de_paz_id = p_cdp_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  IF NOT (fn_es_operativo_en(v_iglesia_id) OR fn_es_pastor_en(v_iglesia_id) OR (v_red_id IS NOT NULL AND fn_es_lider_de_red(v_red_id))) THEN
    RAISE EXCEPTION 'CARGO_SIN_PERMISO: se requiere ser Lider de la Red de esta CdP, o Pastor/Supervisor' USING ERRCODE = 'P0001';
  END IF;

  IF p_codigo = 'LIDER_CDP' AND v_red_id IS NOT NULL AND fn_es_supervisor_en(v_iglesia_id) AND NOT fn_es_lider_de_red(v_red_id) THEN
    SELECT rc.persona_id INTO v_lider_vigente
    FROM red_cargo rc JOIN cargo c ON c.id = rc.cargo_id
    WHERE rc.red_id = v_red_id AND c.codigo = 'LIDER_RED' AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
    LIMIT 1;
    IF v_lider_vigente IS NOT NULL THEN
      INSERT INTO solicitud_estructura (iglesia_id, red_id, tipo, payload, solicitante_persona_id)
      VALUES (v_iglesia_id, v_red_id, 'CAMBIAR_LIDER_CDP',
        jsonb_build_object('cdp_id', p_cdp_id, 'persona_id', p_persona_id, 'codigo', p_codigo, 'cargo_id', p_cargo_id),
        fn_mi_persona_id())
      RETURNING id INTO v_solicitud_id;
      PERFORM fn_crear_notificacion(v_lider_vigente, 'SOLICITUD_ESTRUCTURA', 'Solicitud de cambio de Líder de Casa de Paz',
        'El Supervisor pidió designar un nuevo Líder para una Casa de Paz de tu Red. Requiere tu autorización.', 'solicitud_estructura', v_solicitud_id);
      RETURN NULL;
    END IF;
  END IF;

  IF p_codigo = 'LIDER_CDP' THEN
    UPDATE casa_de_paz_cargo SET fecha_fin = CURRENT_DATE
    WHERE casa_de_paz_id = p_cdp_id AND cargo_id IN (SELECT id FROM cargo WHERE codigo = p_codigo)
      AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
  END IF;

  INSERT INTO casa_de_paz_cargo (iglesia_id, casa_de_paz_id, persona_id, cargo_id, fecha_inicio)
  VALUES (v_iglesia_id, p_cdp_id, p_persona_id, p_cargo_id, CURRENT_DATE)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_asignar_cargo_departamento(p_iglesia_id uuid, p_departamento_id uuid, p_persona_id uuid, p_cargo_id uuid, p_pin text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (fn_es_super_admin() or fn_es_operativo_en(p_iglesia_id) or fn_es_pastor_en(p_iglesia_id)) then
    raise exception 'DEPARTAMENTO_SOLO_OPERATIVO: se requiere ser Pastor o Supervisor de la iglesia para asignar un Lider de Departamento'
      using errcode = 'P0001';
  end if;

  perform private.fn_estructura_exigir_otp(p_iglesia_id, p_pin);

  update departamento_cargo set fecha_fin = current_date
  where departamento_id = p_departamento_id and fecha_fin is null and fecha_eliminacion is null;

  insert into departamento_cargo (iglesia_id, departamento_id, persona_id, cargo_id, fecha_inicio)
  values (p_iglesia_id, p_departamento_id, p_persona_id, p_cargo_id, current_date);
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_asignar_cargo_red(p_red_id uuid, p_persona_id uuid, p_codigo text, p_cargo_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_iglesia_id UUID;
  v_lider_vigente UUID;
  v_solicitud_id UUID;
  v_id UUID;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM red WHERE id = p_red_id AND fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'RED_INEXISTENTE: la red no existe' USING ERRCODE = 'P0001';
  END IF;

  IF NOT (fn_es_operativo_en(v_iglesia_id) OR fn_es_pastor_en(v_iglesia_id) OR fn_es_lider_de_red(p_red_id)) THEN
    RAISE EXCEPTION 'CARGO_SIN_PERMISO: se requiere ser Lider de la Red, o Pastor/Supervisor' USING ERRCODE = 'P0001';
  END IF;

  IF p_codigo = 'LIDER_RED' AND fn_es_supervisor_en(v_iglesia_id) AND NOT fn_es_lider_de_red(p_red_id) THEN
    SELECT rc.persona_id INTO v_lider_vigente
    FROM red_cargo rc JOIN cargo c ON c.id = rc.cargo_id
    WHERE rc.red_id = p_red_id AND c.codigo = 'LIDER_RED' AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
    LIMIT 1;
    IF v_lider_vigente IS NOT NULL THEN
      INSERT INTO solicitud_estructura (iglesia_id, red_id, tipo, payload, solicitante_persona_id)
      VALUES (v_iglesia_id, p_red_id, 'CAMBIAR_LIDER_RED',
        jsonb_build_object('red_id', p_red_id, 'persona_id', p_persona_id, 'codigo', p_codigo, 'cargo_id', p_cargo_id),
        fn_mi_persona_id())
      RETURNING id INTO v_solicitud_id;
      PERFORM fn_crear_notificacion(v_lider_vigente, 'SOLICITUD_ESTRUCTURA', 'Solicitud de cambio de Líder de Red',
        'El Supervisor pidió designar un nuevo Líder para tu Red. Requiere tu autorización.', 'solicitud_estructura', v_solicitud_id);
      RETURN NULL;
    END IF;
  END IF;

  IF p_codigo = 'LIDER_RED' THEN
    UPDATE red_cargo SET fecha_fin = CURRENT_DATE
    WHERE red_id = p_red_id AND cargo_id IN (SELECT id FROM cargo WHERE codigo = p_codigo)
      AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
  END IF;

  INSERT INTO red_cargo (iglesia_id, red_id, persona_id, cargo_id, fecha_inicio)
  VALUES (v_iglesia_id, p_red_id, p_persona_id, p_cargo_id, CURRENT_DATE)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_cambiar_moneda_defecto(p_iglesia_id uuid, p_moneda_id uuid, p_pin text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (fn_es_operativo_en(p_iglesia_id) OR fn_es_pastor_en(p_iglesia_id)) THEN
    RAISE EXCEPTION 'CONFIG_SIN_PERMISO: se requiere ser Pastor o Supervisor de la iglesia %', p_iglesia_id
      USING ERRCODE = 'P0001';
  END IF;
  PERFORM fn_exigir_pin(p_pin);

  UPDATE iglesia SET moneda_defecto_id = p_moneda_id WHERE id = p_iglesia_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_cancelar_invitacion_lider(p_invitacion_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_inv public.invitacion_lider;
  v_puede boolean;
  v_cargo_codigo text;
  v_usuario_a_borrar uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  select * into v_inv from public.invitacion_lider
  where id = p_invitacion_id and fecha_eliminacion is null;

  if not found or v_inv.estado <> 'PENDIENTE' then
    raise exception 'INVITACION_NO_ENCONTRADA_O_YA_RESUELTA' using errcode = 'P0001';
  end if;

  v_puede := public.fn_es_super_admin()
    or public.fn_es_operativo_en(v_inv.iglesia_id)
    or public.fn_es_pastor_en(v_inv.iglesia_id)
    or (v_inv.red_id is not null and public.fn_es_lider_de_red(v_inv.red_id))
    or (v_inv.casa_de_paz_id is not null and exists (
          select 1 from public.casa_de_paz_red cr where cr.casa_de_paz_id = v_inv.casa_de_paz_id
            and cr.fecha_eliminacion is null and public.fn_es_lider_de_red(cr.red_id)
        ));

  if not v_puede then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  select c.codigo into v_cargo_codigo from public.cargo c where c.id = v_inv.cargo_id;

  update public.invitacion_lider
  set fecha_eliminacion = now(), eliminado_por = (select auth.uid())
  where id = v_inv.id;

  update public.usuario_rol
  set fecha_eliminacion = now(), eliminado_por = (select auth.uid())
  where usuario_id = v_inv.usuario_id and rol = v_inv.rol and iglesia_id = v_inv.iglesia_id
    and fecha_eliminacion is null;

  if not exists (select 1 from public.persona where usuario_id = v_inv.usuario_id and fecha_eliminacion is null)
     and not exists (select 1 from public.usuario_rol where usuario_id = v_inv.usuario_id and fecha_eliminacion is null)
  then
    v_usuario_a_borrar := v_inv.usuario_id;
  end if;

  return jsonb_build_object(
    'usuario_id_a_borrar', v_usuario_a_borrar,
    'rol', v_inv.rol,
    'cargo_codigo', v_cargo_codigo,
    'red_id', v_inv.red_id,
    'casa_de_paz_id', v_inv.casa_de_paz_id
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_correo_invitacion_lider_si_puedo_gestionar(p_invitacion_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inv invitacion_lider;
  v_puede BOOLEAN;
BEGIN
  SELECT * INTO v_inv FROM invitacion_lider WHERE id = p_invitacion_id AND fecha_eliminacion IS NULL;
  IF NOT FOUND OR v_inv.estado <> 'PENDIENTE' THEN RETURN NULL; END IF;

  v_puede := fn_es_operativo_en(v_inv.iglesia_id)
    OR fn_es_pastor_en(v_inv.iglesia_id)
    OR (v_inv.red_id IS NOT NULL AND fn_es_lider_de_red(v_inv.red_id))
    OR (v_inv.casa_de_paz_id IS NOT NULL AND fn_es_lider_cdp(v_inv.casa_de_paz_id))
    OR (v_inv.casa_de_paz_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM casa_de_paz_red cr WHERE cr.casa_de_paz_id = v_inv.casa_de_paz_id
            AND cr.fecha_eliminacion IS NULL AND fn_es_lider_de_red(cr.red_id)
        ));

  IF NOT v_puede THEN RETURN NULL; END IF;
  RETURN v_inv.correo;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_dashboard_lider_red(p_red_id uuid, p_fecha date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_iglesia_id UUID;
  v_mes_desde DATE := date_trunc('month', p_fecha)::date;
  v_mes_hasta DATE := (date_trunc('month', p_fecha) + interval '1 month - 1 day')::date;
  v_semana_lunes DATE := date_trunc('week', p_fecha)::date;
  v_semana_domingo DATE := (date_trunc('week', p_fecha) + interval '6 days')::date;
  v_resultado JSONB;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM red WHERE id = p_red_id;
  IF v_iglesia_id IS NULL OR v_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'DASHBOARD_FUERA_DE_ALCANCE: sin acceso a la red %', p_red_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (fn_es_lider_de_red(p_red_id) OR fn_es_operativo_en(v_iglesia_id) OR fn_es_pastor_en(v_iglesia_id)) THEN
    RAISE EXCEPTION 'DASHBOARD_FUERA_DE_ALCANCE: sin cargo vigente en la red %', p_red_id USING ERRCODE = 'P0001';
  END IF;

  SELECT jsonb_build_object(
    'red', (SELECT jsonb_build_object('id', r.id, 'nombre', r.nombre) FROM red r WHERE r.id = p_red_id),
    'kpi', jsonb_build_object(
      'cdp_activas', (
        SELECT count(*) FROM casa_de_paz c JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = c.id
        WHERE cdr.red_id = p_red_id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
          AND c.activo AND c.fecha_eliminacion IS NULL
      ),
      'miembros_totales', (
        SELECT count(DISTINCT m.persona_id) FROM casa_de_paz_membresia m
        JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = m.casa_de_paz_id
        WHERE cdr.red_id = p_red_id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
          AND m.fecha_fin IS NULL AND m.fecha_eliminacion IS NULL
      ),
      'asistencia_promedio', (
        SELECT round(avg(vt.total_asistentes), 1) FROM v_reporte_totales vt
        JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = vt.casa_de_paz_id
        WHERE cdr.red_id = p_red_id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
          AND vt.fecha_reunion BETWEEN v_mes_desde AND v_mes_hasta
      ),
      'ofrendas_mes', (
        SELECT jsonb_agg(jsonb_build_object('moneda', x.moneda_codigo, 'total', x.total))
        FROM (
          SELECT moneda_codigo, sum(total) AS total FROM fn_ingresos_red(p_red_id, v_mes_desde, v_mes_hasta)
          GROUP BY moneda_codigo
        ) x
      )
    ),
    'casas_de_paz', (
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.ultima_asistencia DESC NULLS LAST)
      FROM (
        SELECT
          c.id AS casa_de_paz_id, fn_etiqueta_cdp(c.id) AS etiqueta,
          (SELECT vt.total_asistentes FROM v_reporte_totales vt
           WHERE vt.casa_de_paz_id = c.id ORDER BY vt.fecha_reunion DESC LIMIT 1) AS ultima_asistencia,
          (SELECT vt.fecha_reunion FROM v_reporte_totales vt
           WHERE vt.casa_de_paz_id = c.id ORDER BY vt.fecha_reunion DESC LIMIT 1) AS ultima_fecha
        FROM casa_de_paz c JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = c.id
        WHERE cdr.red_id = p_red_id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
          AND c.activo AND c.fecha_eliminacion IS NULL
      ) x
    ),
    'cdp_sin_reporte_semana', (
      SELECT jsonb_agg(jsonb_build_object('id', c.id, 'etiqueta', fn_etiqueta_cdp(c.id)))
      FROM casa_de_paz c JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = c.id
      WHERE cdr.red_id = p_red_id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
        AND c.activo AND c.fecha_eliminacion IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM casa_de_paz_reporte rep
          WHERE rep.casa_de_paz_id = c.id AND rep.fecha_reunion BETWEEN v_semana_lunes AND v_semana_domingo
            AND rep.fecha_eliminacion IS NULL
        )
    ),
    'ingresos', (SELECT jsonb_agg(to_jsonb(x)) FROM fn_ingresos_red(p_red_id, v_mes_desde, v_mes_hasta) x)
  ) INTO v_resultado;

  RETURN v_resultado;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_dashboard_pastor(p_fecha date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_mes_desde DATE := date_trunc('month', p_fecha)::date;
  v_mes_hasta DATE := (date_trunc('month', p_fecha) + interval '1 month - 1 day')::date;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM iglesia i WHERE i.id IN (SELECT fn_mis_iglesias()) AND (fn_es_operativo_en(i.id) OR fn_es_pastor_en(i.id))
  ) THEN
    RAISE EXCEPTION 'DASHBOARD_SIN_PERMISO: se requiere ser Pastor o Supervisor de al menos una iglesia' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object(
    'iglesias', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'nombre', i.nombre, 'ciudad', i.ciudad,
        'moneda_defecto', (SELECT codigo FROM moneda WHERE id = i.moneda_defecto_id),
        'redes', (SELECT count(*) FROM red r WHERE r.iglesia_id = i.id AND r.activo AND r.fecha_eliminacion IS NULL),
        'cdp', (SELECT count(*) FROM casa_de_paz c WHERE c.iglesia_id = i.id AND c.activo AND c.fecha_eliminacion IS NULL),
        'miembros_cdp', (SELECT count(DISTINCT m.persona_id) FROM casa_de_paz_membresia m
                         WHERE m.iglesia_id = i.id AND m.fecha_fin IS NULL AND m.fecha_eliminacion IS NULL),
        'familias', fn_total_familias(i.id),
        'activa', i.activo
      ) ORDER BY i.nombre)
      FROM iglesia i WHERE i.id IN (SELECT fn_mis_iglesias()) AND i.fecha_eliminacion IS NULL
    ),
    'ingresos_por_moneda', (
      SELECT jsonb_agg(to_jsonb(x))
      FROM (
        SELECT i.nombre AS iglesia, m.codigo AS moneda, t.codigo AS tipo, sum(fi.monto) AS total
        FROM finanzas_ingreso fi
        JOIN iglesia i ON i.id = fi.iglesia_id
        JOIN moneda m ON m.id = fi.moneda_id
        JOIN finanzas_tipo_ingreso t ON t.id = fi.tipo_ingreso_id
        WHERE fi.iglesia_id IN (SELECT fn_mis_iglesias()) AND fi.fecha BETWEEN v_mes_desde AND v_mes_hasta AND fi.fecha_eliminacion IS NULL
        GROUP BY i.nombre, m.codigo, t.codigo
        ORDER BY i.nombre, m.codigo
      ) x
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_dashboard_supervisor(p_iglesia_id uuid, p_fecha date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_mes_desde DATE := date_trunc('month', p_fecha)::date;
  v_mes_hasta DATE := (date_trunc('month', p_fecha) + interval '1 month - 1 day')::date;
  v_resultado JSONB;
BEGIN
  IF NOT (fn_es_operativo_en(p_iglesia_id) OR fn_es_pastor_en(p_iglesia_id)) THEN
    RAISE EXCEPTION 'DASHBOARD_FUERA_DE_ALCANCE: se requiere ser Pastor o Supervisor en la iglesia %', p_iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  SELECT jsonb_build_object(
    'kpi', jsonb_build_object(
      'redes', (SELECT count(*) FROM red r WHERE r.iglesia_id = p_iglesia_id AND r.activo AND r.fecha_eliminacion IS NULL),
      'cdp', (SELECT count(*) FROM casa_de_paz c WHERE c.iglesia_id = p_iglesia_id AND c.activo AND c.fecha_eliminacion IS NULL),
      'miembros_totales', (
        SELECT count(DISTINCT m.persona_id) FROM casa_de_paz_membresia m
        WHERE m.iglesia_id = p_iglesia_id AND m.fecha_fin IS NULL AND m.fecha_eliminacion IS NULL
      ),
      'asistencia_promedio', (
        SELECT round(avg(vt.total_asistentes), 1) FROM v_reporte_totales vt
        JOIN casa_de_paz c ON c.id = vt.casa_de_paz_id
        WHERE c.iglesia_id = p_iglesia_id AND vt.fecha_reunion BETWEEN v_mes_desde AND v_mes_hasta
      ),
      'ingresos_mes', (
        SELECT jsonb_agg(jsonb_build_object('moneda', x.moneda_codigo, 'total', x.total))
        FROM (
          SELECT m.codigo AS moneda_codigo, sum(fi.monto) AS total
          FROM finanzas_ingreso fi JOIN moneda m ON m.id = fi.moneda_id
          WHERE fi.iglesia_id = p_iglesia_id AND fi.fecha BETWEEN v_mes_desde AND v_mes_hasta AND fi.fecha_eliminacion IS NULL
          GROUP BY m.codigo
        ) x
      )
    ),
    'redes_detalle', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'nombre', r.nombre,
        'cdp', (SELECT count(*) FROM casa_de_paz c JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = c.id
                WHERE cdr.red_id = r.id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
                  AND c.activo AND c.fecha_eliminacion IS NULL),
        'miembros', (
          SELECT count(DISTINCT m.persona_id) FROM casa_de_paz_membresia m
          JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = m.casa_de_paz_id
          WHERE cdr.red_id = r.id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
            AND m.fecha_fin IS NULL AND m.fecha_eliminacion IS NULL
        ),
        'asistencia_promedio', (
          SELECT round(avg(vt.total_asistentes), 1) FROM v_reporte_totales vt
          JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = vt.casa_de_paz_id
          WHERE cdr.red_id = r.id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
            AND vt.fecha_reunion BETWEEN v_mes_desde AND v_mes_hasta
        ),
        'incompleta', COALESCE(fi.falta_departamentos OR fi.falta_ministerio, false)
      ) ORDER BY r.nombre)
      FROM red r
      LEFT JOIN fn_redes_incompletas(p_iglesia_id) fi ON fi.red_id = r.id
      WHERE r.iglesia_id = p_iglesia_id AND r.activo AND r.fecha_eliminacion IS NULL
    ),
    'departamentos_activos', (
      SELECT jsonb_agg(jsonb_build_object('id', d.id, 'nombre', d.nombre) ORDER BY d.nombre)
      FROM departamento d WHERE d.iglesia_id = p_iglesia_id AND d.activo AND d.fecha_eliminacion IS NULL
    ),
    'estados', (SELECT jsonb_agg(to_jsonb(x)) FROM fn_conteo_estados(p_iglesia_id) x),
    'alertas', fn_alertas_supervisor(p_iglesia_id)
  ) INTO v_resultado;

  RETURN v_resultado;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_deshacer_fusion_cdp(p_fusion_id uuid, p_motivo text, p_pin text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fusion fusion_casa_de_paz%ROWTYPE;
  v_red_destino UUID;
BEGIN
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'FUSION_MOTIVO_OBLIGATORIO: hay que escribir el motivo para deshacer' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_fusion FROM fusion_casa_de_paz WHERE id = p_fusion_id AND fecha_eliminacion IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FUSION_NO_ENCONTRADA: no existe esa fusion' USING ERRCODE = 'P0001';
  END IF;
  IF v_fusion.deshecha_en IS NOT NULL THEN
    RAISE EXCEPTION 'FUSION_YA_DESHECHA: esta fusion ya fue deshecha' USING ERRCODE = 'P0001';
  END IF;
  IF fn_fusion_cdp_bloqueada(v_fusion.casa_de_paz_origen_id, v_fusion.casa_de_paz_destino_id, v_fusion.fecha_fusion) THEN
    RAISE EXCEPTION 'FUSION_VENTANA_VENCIDA: ya se subio un reporte despues de la fusion, no se puede deshacer' USING ERRCODE = 'P0001';
  END IF;

  SELECT red_id INTO v_red_destino FROM casa_de_paz_red
  WHERE casa_de_paz_id = v_fusion.casa_de_paz_destino_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  IF NOT (fn_es_operativo_en(v_fusion.iglesia_id) OR fn_es_pastor_en(v_fusion.iglesia_id) OR (v_red_destino IS NOT NULL AND fn_es_lider_de_red(v_red_destino))) THEN
    RAISE EXCEPTION 'FUSION_SIN_PERMISO: se requiere ser Lider de la Red destino, o Pastor/Supervisor' USING ERRCODE = 'P0001';
  END IF;
  PERFORM fn_exigir_pin(p_pin);

  UPDATE casa_de_paz_membresia
  SET fecha_fin = v_fusion.fecha_fusion::date
  WHERE casa_de_paz_id = v_fusion.casa_de_paz_destino_id
    AND fecha_inicio = v_fusion.fecha_fusion::date AND fecha_eliminacion IS NULL
    AND persona_id IN (
      SELECT persona_id FROM casa_de_paz_membresia
      WHERE casa_de_paz_id = v_fusion.casa_de_paz_origen_id AND fecha_fin = v_fusion.fecha_fusion::date
        AND fecha_eliminacion IS NULL
    );

  UPDATE casa_de_paz_membresia
  SET fecha_fin = NULL
  WHERE casa_de_paz_id = v_fusion.casa_de_paz_origen_id
    AND fecha_fin = v_fusion.fecha_fusion::date AND fecha_eliminacion IS NULL;

  UPDATE casa_de_paz_cargo
  SET fecha_fin = NULL
  WHERE casa_de_paz_id = v_fusion.casa_de_paz_origen_id
    AND fecha_fin = v_fusion.fecha_fusion::date AND fecha_eliminacion IS NULL;

  UPDATE casa_de_paz SET activo = true WHERE id = v_fusion.casa_de_paz_origen_id;

  UPDATE fusion_casa_de_paz
  SET deshecha_en = now(), deshecha_motivo = p_motivo
  WHERE id = p_fusion_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_deshacer_fusion_red(p_fusion_id uuid, p_motivo text, p_pin text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fusion fusion_red%ROWTYPE;
BEGIN
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'FUSION_MOTIVO_OBLIGATORIO: hay que escribir el motivo para deshacer' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_fusion FROM fusion_red WHERE id = p_fusion_id AND fecha_eliminacion IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FUSION_NO_ENCONTRADA: no existe esa fusion' USING ERRCODE = 'P0001';
  END IF;
  IF v_fusion.deshecha_en IS NOT NULL THEN
    RAISE EXCEPTION 'FUSION_YA_DESHECHA: esta fusion ya fue deshecha' USING ERRCODE = 'P0001';
  END IF;
  IF fn_fusion_red_bloqueada(v_fusion.red_origen_id, v_fusion.red_destino_id, v_fusion.fecha_fusion) THEN
    RAISE EXCEPTION 'FUSION_VENTANA_VENCIDA: alguna de sus Casas de Paz ya subio un reporte despues de la fusion, no se puede deshacer'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (fn_es_operativo_en(v_fusion.iglesia_id) OR fn_es_pastor_en(v_fusion.iglesia_id)) THEN
    RAISE EXCEPTION 'FUSION_SIN_PERMISO: solo el Pastor o el Supervisor de Vision en Accion pueden deshacer esta fusion'
      USING ERRCODE = 'P0001';
  END IF;
  PERFORM fn_exigir_pin(p_pin);

  UPDATE casa_de_paz_red
  SET fecha_fin = v_fusion.fecha_fusion::date
  WHERE red_id = v_fusion.red_destino_id
    AND fecha_inicio = v_fusion.fecha_fusion::date AND fecha_eliminacion IS NULL
    AND casa_de_paz_id IN (
      SELECT casa_de_paz_id FROM casa_de_paz_red
      WHERE red_id = v_fusion.red_origen_id AND fecha_fin = v_fusion.fecha_fusion::date AND fecha_eliminacion IS NULL
    );

  UPDATE casa_de_paz_red
  SET fecha_fin = NULL
  WHERE red_id = v_fusion.red_origen_id
    AND fecha_fin = v_fusion.fecha_fusion::date AND fecha_eliminacion IS NULL;

  UPDATE red_cargo
  SET fecha_fin = NULL
  WHERE red_id = v_fusion.red_origen_id
    AND fecha_fin = v_fusion.fecha_fusion::date AND fecha_eliminacion IS NULL;

  UPDATE red SET activo = true WHERE id = v_fusion.red_origen_id;

  UPDATE fusion_red
  SET deshecha_en = now(), deshecha_motivo = p_motivo
  WHERE id = p_fusion_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_es_rol_superior_de_cdp(p_casa_de_paz_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    fn_es_operativo_en((SELECT iglesia_id FROM casa_de_paz WHERE id = p_casa_de_paz_id))
    OR fn_es_pastor_en((SELECT iglesia_id FROM casa_de_paz WHERE id = p_casa_de_paz_id))
    OR EXISTS (
      SELECT 1 FROM casa_de_paz_red cdr
      JOIN red_cargo rc ON rc.red_id = cdr.red_id
      JOIN cargo c ON c.id = rc.cargo_id
      WHERE cdr.casa_de_paz_id = p_casa_de_paz_id
        AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
        AND rc.persona_id = fn_mi_persona_id()
        AND c.codigo IN ('LIDER_RED', 'SUBLIDER_RED')
        AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
    );
$function$;

CREATE OR REPLACE FUNCTION private.fn_estructura_puede_administrar(p_iglesia_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    (select auth.uid()) is not null
    and (
      public.fn_es_super_admin()
      or public.fn_es_operativo_en(p_iglesia_id)
      or public.fn_es_pastor_en(p_iglesia_id)
      or exists (
        select 1
        from public.iglesia i
        where i.id = p_iglesia_id
          and i.tipo = 'SATELITE'::public.iglesia_tipo_enum
          and i.fecha_eliminacion is null
          and i.iglesia_padre_id is not null
          and public.fn_es_operativo_en(i.iglesia_padre_id)
      )
    );
$function$;

CREATE OR REPLACE FUNCTION public.fn_evangelismo_red(p_red_id uuid, p_desde date, p_hasta date)
 RETURNS TABLE(id uuid, casa_de_paz_id uuid, casa_de_paz_etiqueta text, persona_id uuid, nombre_completo text, fecha date, domicilio text, tipo_evangelismo_nombre character varying, tipo_evangelismo_color character)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_iglesia_id UUID;
BEGIN
  SELECT red.iglesia_id INTO v_iglesia_id FROM red WHERE red.id = p_red_id;
  IF v_iglesia_id IS NULL OR v_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'RED_FUERA_DE_ALCANCE: sin acceso a la red %', p_red_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (fn_es_lider_de_red(p_red_id) OR fn_es_operativo_en(v_iglesia_id) OR fn_es_pastor_en(v_iglesia_id)) THEN
    RAISE EXCEPTION 'RED_FUERA_DE_ALCANCE: sin cargo vigente en la red %', p_red_id USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT ev.id, ev.casa_de_paz_id, fn_etiqueta_cdp(ev.casa_de_paz_id), ev.persona_id, fn_nombre_completo(p),
         ev.fecha, ev.domicilio, te.nombre, te.color
  FROM evangelismo ev
  JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = ev.casa_de_paz_id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
  JOIN casa_de_paz c ON c.id = ev.casa_de_paz_id AND c.activo AND c.fecha_eliminacion IS NULL
  JOIN persona p ON p.id = ev.persona_id
  LEFT JOIN tipo_evangelismo te ON te.id = ev.tipo_evangelismo_id
  WHERE cdr.red_id = p_red_id
    AND ev.fecha_eliminacion IS NULL
    AND ev.fecha BETWEEN p_desde AND p_hasta
  ORDER BY ev.fecha DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_eventos_red(p_red_id uuid, p_desde date, p_hasta date, p_tipo_evento_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, titulo character varying, descripcion text, tipo_codigo character varying, tipo_nombre character varying, color character, icono character varying, fecha_inicio date, fecha_fin date, hora_inicio time without time zone, hora_fin time without time zone, es_multi_dia boolean, ambito character varying)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_iglesia_id UUID;
BEGIN
  SELECT red.iglesia_id INTO v_iglesia_id FROM red WHERE red.id = p_red_id;
  IF v_iglesia_id IS NULL OR v_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'RED_FUERA_DE_ALCANCE: sin acceso a la red %', p_red_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (fn_es_lider_de_red(p_red_id) OR fn_es_operativo_en(v_iglesia_id) OR fn_es_pastor_en(v_iglesia_id)) THEN
    RAISE EXCEPTION 'RED_FUERA_DE_ALCANCE: sin cargo vigente en la red %', p_red_id USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT e.id, e.titulo, e.descripcion, t.codigo, t.nombre, t.color, t.icono,
         e.fecha_inicio, e.fecha_fin, e.hora_inicio, e.hora_fin,
         COALESCE(e.fecha_fin, e.fecha_inicio) > e.fecha_inicio AS es_multi_dia,
         CASE WHEN e.red_id IS NOT NULL THEN 'RED' ELSE 'IGLESIA' END::VARCHAR
  FROM evento e
  JOIN tipo_evento t ON t.id = e.tipo_evento_id
  WHERE e.fecha_eliminacion IS NULL
    AND (
      e.red_id = p_red_id
      OR (e.casa_de_paz_id IS NULL AND e.red_id IS NULL AND e.iglesia_id = v_iglesia_id)
    )
    AND daterange(e.fecha_inicio, COALESCE(e.fecha_fin, e.fecha_inicio), '[]') && daterange(p_desde, p_hasta, '[]')
    AND (p_tipo_evento_id IS NULL OR e.tipo_evento_id = p_tipo_evento_id)
  ORDER BY e.fecha_inicio, e.hora_inicio NULLS LAST;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_fusionar_cdp(p_origen_id uuid, p_destino_id uuid, p_motivo text, p_pin text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_iglesia_id UUID;
  v_iglesia_origen UUID;
  v_red_destino UUID;
  v_fusion_id UUID;
  v_lider_vigente UUID;
  v_solicitud_id UUID;
BEGIN
  IF p_origen_id = p_destino_id THEN
    RAISE EXCEPTION 'FUSION_MISMA_CDP: no se puede fusionar una casa de paz consigo misma' USING ERRCODE = 'P0001';
  END IF;
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'FUSION_MOTIVO_OBLIGATORIO: hay que escribir el motivo de la fusion' USING ERRCODE = 'P0001';
  END IF;

  SELECT iglesia_id INTO v_iglesia_id FROM casa_de_paz WHERE id = p_destino_id AND fecha_eliminacion IS NULL;
  SELECT iglesia_id INTO v_iglesia_origen FROM casa_de_paz WHERE id = p_origen_id AND fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL OR v_iglesia_origen IS NULL THEN
    RAISE EXCEPTION 'FUSION_CDP_INEXISTENTE: alguna de las casas de paz no existe' USING ERRCODE = 'P0001';
  END IF;
  IF v_iglesia_id IS DISTINCT FROM v_iglesia_origen THEN
    RAISE EXCEPTION 'FUSION_IGLESIAS_DISTINTAS: las dos casas de paz deben ser de la misma iglesia' USING ERRCODE = 'P0001';
  END IF;

  SELECT red_id INTO v_red_destino FROM casa_de_paz_red
  WHERE casa_de_paz_id = p_destino_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  IF NOT (fn_es_operativo_en(v_iglesia_id) OR fn_es_pastor_en(v_iglesia_id) OR (v_red_destino IS NOT NULL AND fn_es_lider_de_red(v_red_destino))) THEN
    RAISE EXCEPTION 'FUSION_SIN_PERMISO: se requiere ser Lider de la Red destino, o Pastor/Supervisor' USING ERRCODE = 'P0001';
  END IF;

  IF v_red_destino IS NOT NULL AND fn_es_supervisor_en(v_iglesia_id) AND NOT fn_es_lider_de_red(v_red_destino) THEN
    SELECT rc.persona_id INTO v_lider_vigente
    FROM red_cargo rc JOIN cargo c ON c.id = rc.cargo_id
    WHERE rc.red_id = v_red_destino AND c.codigo = 'LIDER_RED' AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
    LIMIT 1;
    IF v_lider_vigente IS NOT NULL THEN
      INSERT INTO solicitud_estructura (iglesia_id, red_id, tipo, payload, solicitante_persona_id)
      VALUES (v_iglesia_id, v_red_destino, 'FUSIONAR_CDP',
        jsonb_build_object('origen_id', p_origen_id, 'destino_id', p_destino_id, 'motivo', p_motivo), fn_mi_persona_id())
      RETURNING id INTO v_solicitud_id;
      PERFORM fn_crear_notificacion(v_lider_vigente, 'SOLICITUD_ESTRUCTURA', 'Solicitud de fusión de Casas de Paz',
        'El Supervisor pidió fusionar dos Casas de Paz de tu Red. Requiere tu autorización.', 'solicitud_estructura', v_solicitud_id);
      RETURN NULL;
    END IF;
  END IF;

  PERFORM fn_exigir_pin(p_pin);

  INSERT INTO fusion_casa_de_paz (iglesia_id, casa_de_paz_origen_id, casa_de_paz_destino_id, motivo)
  VALUES (v_iglesia_id, p_origen_id, p_destino_id, p_motivo)
  RETURNING id INTO v_fusion_id;

  UPDATE casa_de_paz_membresia
  SET fecha_fin = CURRENT_DATE
  WHERE casa_de_paz_id = p_origen_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  INSERT INTO casa_de_paz_membresia (iglesia_id, casa_de_paz_id, persona_id, es_principal, fecha_inicio)
  SELECT v_iglesia_id, p_destino_id, m.persona_id, m.es_principal, CURRENT_DATE
  FROM casa_de_paz_membresia m
  WHERE m.casa_de_paz_id = p_origen_id AND m.fecha_fin = CURRENT_DATE AND m.fecha_eliminacion IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM casa_de_paz_membresia m2
      WHERE m2.persona_id = m.persona_id AND m2.casa_de_paz_id = p_destino_id
        AND m2.fecha_fin IS NULL AND m2.fecha_eliminacion IS NULL
    );

  UPDATE casa_de_paz_cargo
  SET fecha_fin = CURRENT_DATE
  WHERE casa_de_paz_id = p_origen_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  UPDATE casa_de_paz SET activo = false WHERE id = p_origen_id;

  RETURN v_fusion_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_fusionar_red(p_origen_id uuid, p_destino_id uuid, p_motivo text, p_pin text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_iglesia_id UUID;
  v_iglesia_origen UUID;
  v_fusion_id UUID;
  v_lider_vigente UUID;
  v_solicitud_id UUID;
BEGIN
  IF p_origen_id = p_destino_id THEN
    RAISE EXCEPTION 'FUSION_MISMA_RED: no se puede fusionar una red consigo misma' USING ERRCODE = 'P0001';
  END IF;
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'FUSION_MOTIVO_OBLIGATORIO: hay que escribir el motivo de la fusion' USING ERRCODE = 'P0001';
  END IF;

  SELECT iglesia_id INTO v_iglesia_id FROM red WHERE id = p_destino_id AND fecha_eliminacion IS NULL;
  SELECT iglesia_id INTO v_iglesia_origen FROM red WHERE id = p_origen_id AND fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL OR v_iglesia_origen IS NULL THEN
    RAISE EXCEPTION 'FUSION_RED_INEXISTENTE: alguna de las redes no existe' USING ERRCODE = 'P0001';
  END IF;
  IF v_iglesia_id IS DISTINCT FROM v_iglesia_origen THEN
    RAISE EXCEPTION 'FUSION_IGLESIAS_DISTINTAS: las dos redes deben ser de la misma iglesia' USING ERRCODE = 'P0001';
  END IF;

  IF NOT (fn_es_operativo_en(v_iglesia_id) OR fn_es_pastor_en(v_iglesia_id)) THEN
    RAISE EXCEPTION 'FUSION_SIN_PERMISO: solo el Pastor o el Supervisor de Vision en Accion pueden fusionar redes'
      USING ERRCODE = 'P0001';
  END IF;

  IF fn_es_supervisor_en(v_iglesia_id) THEN
    SELECT rc.persona_id INTO v_lider_vigente
    FROM red_cargo rc JOIN cargo c ON c.id = rc.cargo_id
    WHERE rc.red_id = p_destino_id AND c.codigo = 'LIDER_RED' AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
    LIMIT 1;
    IF v_lider_vigente IS NOT NULL THEN
      INSERT INTO solicitud_estructura (iglesia_id, red_id, tipo, payload, solicitante_persona_id)
      VALUES (v_iglesia_id, p_destino_id, 'FUSIONAR_RED',
        jsonb_build_object('origen_id', p_origen_id, 'destino_id', p_destino_id, 'motivo', p_motivo), fn_mi_persona_id())
      RETURNING id INTO v_solicitud_id;
      PERFORM fn_crear_notificacion(v_lider_vigente, 'SOLICITUD_ESTRUCTURA', 'Solicitud de fusión de Redes',
        'El Supervisor pidió fusionar otra Red dentro de la tuya. Requiere tu autorización.', 'solicitud_estructura', v_solicitud_id);
      RETURN NULL;
    END IF;
  END IF;

  PERFORM fn_exigir_pin(p_pin);

  INSERT INTO fusion_red (iglesia_id, red_origen_id, red_destino_id, motivo)
  VALUES (v_iglesia_id, p_origen_id, p_destino_id, p_motivo)
  RETURNING id INTO v_fusion_id;

  UPDATE casa_de_paz_red
  SET fecha_fin = CURRENT_DATE
  WHERE red_id = p_origen_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  INSERT INTO casa_de_paz_red (iglesia_id, casa_de_paz_id, red_id, fecha_inicio)
  SELECT v_iglesia_id, cdr.casa_de_paz_id, p_destino_id, CURRENT_DATE
  FROM casa_de_paz_red cdr
  WHERE cdr.red_id = p_origen_id AND cdr.fecha_fin = CURRENT_DATE AND cdr.fecha_eliminacion IS NULL;

  UPDATE red_cargo
  SET fecha_fin = CURRENT_DATE
  WHERE red_id = p_origen_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  UPDATE red SET activo = false WHERE id = p_origen_id;

  RETURN v_fusion_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_jovenes_iglesia(p_iglesia_id uuid)
 RETURNS TABLE(id uuid, nombre_completo text, sexo sexo_enum, edad integer, casa_de_paz_etiqueta text, red_nombre text, estado_sigla text, telefono_principal text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_edad_min NUMERIC; v_edad_max NUMERIC;
BEGIN
  IF p_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'IGLESIA_FUERA_DE_ALCANCE' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (fn_es_lider_jovenes_en(p_iglesia_id) OR fn_es_operativo_en(p_iglesia_id) OR fn_es_pastor_en(p_iglesia_id)) THEN
    RAISE EXCEPTION 'SIN_ACCESO: se requiere ser Lider de Jovenes, Pastor o Supervisor' USING ERRCODE = 'P0001';
  END IF;

  v_edad_min := fn_criterio(p_iglesia_id, 'EDAD_JOVEN_MIN');
  v_edad_max := fn_criterio(p_iglesia_id, 'EDAD_JOVEN_MAX');

  RETURN QUERY
  SELECT
    p.id, fn_nombre_completo(p), p.sexo,
    EXTRACT(YEAR FROM age(p.fecha_nacimiento))::INT,
    (SELECT fn_etiqueta_cdp(cm.casa_de_paz_id) FROM casa_de_paz_membresia cm
     WHERE cm.persona_id = p.id AND cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL LIMIT 1),
    (SELECT r.nombre::TEXT FROM casa_de_paz_membresia cm
     JOIN casa_de_paz_red cr ON cr.casa_de_paz_id = cm.casa_de_paz_id AND cr.fecha_fin IS NULL AND cr.fecha_eliminacion IS NULL
     JOIN red r ON r.id = cr.red_id
     WHERE cm.persona_id = p.id AND cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL LIMIT 1),
    (SELECT e.sigla::TEXT FROM persona_estado pe JOIN estado e ON e.id = pe.estado_id
     WHERE pe.persona_id = p.id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL),
    (SELECT t.numero::TEXT FROM telefono_asignacion ta JOIN telefono t ON t.id = ta.telefono_id
     WHERE ta.persona_id = p.id AND ta.es_principal AND ta.fecha_eliminacion IS NULL LIMIT 1)
  FROM persona p
  WHERE p.iglesia_id = p_iglesia_id AND p.fecha_eliminacion IS NULL AND NOT p.oculto
    AND p.fecha_nacimiento IS NOT NULL
    AND EXTRACT(YEAR FROM age(p.fecha_nacimiento)) BETWEEN v_edad_min AND v_edad_max
  ORDER BY fn_nombre_completo(p);
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_listar_casa_paz_url_afirmacion(p_iglesia_id uuid)
 RETURNS TABLE(url_id uuid, slug character varying, estado estado_url_enum, lider_cdp_nombre text, casa_de_paz_id uuid, casa_de_paz_etiqueta text, red_id uuid, red_nombre character varying, lider_red_nombre text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (fn_es_lider_afirmacion_en(p_iglesia_id) OR fn_es_operativo_en(p_iglesia_id) OR fn_es_pastor_en(p_iglesia_id)) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    cpu.id, cpu.slug, cpu.estado,
    fn_nombre_completo(pl), cpu.casa_de_paz_id, fn_etiqueta_cdp(cpu.casa_de_paz_id),
    r.id, r.nombre,
    (SELECT fn_nombre_completo(prl)
     FROM red_cargo rcl JOIN cargo cl ON cl.id = rcl.cargo_id JOIN persona prl ON prl.id = rcl.persona_id
     WHERE rcl.red_id = r.id AND cl.codigo = 'LIDER_RED'
       AND rcl.fecha_fin IS NULL AND rcl.fecha_eliminacion IS NULL
     LIMIT 1)
  FROM casa_paz_url cpu
  JOIN casa_de_paz_cargo cc ON cc.id = cpu.casa_de_paz_cargo_id
  JOIN cargo cc_cargo ON cc_cargo.id = cc.cargo_id
  JOIN casa_de_paz cdp ON cdp.id = cpu.casa_de_paz_id
  JOIN persona pl ON pl.id = cpu.persona_id
  LEFT JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = cpu.casa_de_paz_id
       AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
  LEFT JOIN red r ON r.id = cdr.red_id
  WHERE cpu.iglesia_id = p_iglesia_id
    AND cpu.fecha_eliminacion IS NULL
    AND cc_cargo.codigo = 'LIDER_CDP'
    AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
    AND cdp.activo AND cdp.fecha_eliminacion IS NULL
  ORDER BY r.nombre NULLS LAST, fn_nombre_completo(pl.*);
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_listar_casas_de_paz_afirmacion(p_iglesia_id uuid)
 RETURNS TABLE(casa_de_paz_id uuid, casa_de_paz_etiqueta text, activo boolean, red_id uuid, red_nombre character varying, lider_red_nombre text, lider_cdp_nombre text, tiene_lider_vigente boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (fn_es_lider_afirmacion_en(p_iglesia_id) OR fn_es_operativo_en(p_iglesia_id) OR fn_es_pastor_en(p_iglesia_id)) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    cdp.id,
    fn_etiqueta_cdp(cdp.id),
    cdp.activo,
    r.id,
    r.nombre,
    (SELECT fn_nombre_completo(prl)
     FROM red_cargo rcl JOIN cargo cl ON cl.id = rcl.cargo_id JOIN persona prl ON prl.id = rcl.persona_id
     WHERE rcl.red_id = r.id AND cl.codigo = 'LIDER_RED'
       AND rcl.fecha_fin IS NULL AND rcl.fecha_eliminacion IS NULL
     LIMIT 1),
    (SELECT fn_nombre_completo(pcdp)
     FROM casa_de_paz_cargo ccl JOIN cargo ccg ON ccg.id = ccl.cargo_id JOIN persona pcdp ON pcdp.id = ccl.persona_id
     WHERE ccl.casa_de_paz_id = cdp.id AND ccg.codigo = 'LIDER_CDP'
       AND ccl.fecha_fin IS NULL AND ccl.fecha_eliminacion IS NULL
     LIMIT 1),
    EXISTS (
      SELECT 1 FROM casa_de_paz_cargo ccl JOIN cargo ccg ON ccg.id = ccl.cargo_id
      WHERE ccl.casa_de_paz_id = cdp.id AND ccg.codigo = 'LIDER_CDP'
        AND ccl.fecha_fin IS NULL AND ccl.fecha_eliminacion IS NULL
    )
  FROM casa_de_paz cdp
  LEFT JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = cdp.id
       AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
  LEFT JOIN red r ON r.id = cdr.red_id
  WHERE cdp.iglesia_id = p_iglesia_id
    AND cdp.fecha_eliminacion IS NULL
  ORDER BY r.nombre NULLS LAST, fn_etiqueta_cdp(cdp.id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_listar_invitaciones_departamento(p_iglesia_id uuid)
 RETURNS TABLE(id uuid, correo character varying, departamento_id uuid, estado character varying, fecha_creacion timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT il.id, il.correo, il.departamento_id, il.estado, il.fecha_creacion
  FROM invitacion_lider il
  WHERE il.iglesia_id = p_iglesia_id AND il.departamento_id IS NOT NULL AND il.fecha_eliminacion IS NULL
    AND (fn_es_operativo_en(p_iglesia_id) OR fn_es_pastor_en(p_iglesia_id))
  ORDER BY il.fecha_creacion DESC;
$function$;

CREATE OR REPLACE FUNCTION public.fn_listar_invitaciones_lider(p_iglesia_id uuid)
 RETURNS TABLE(id uuid, correo character varying, rol rol_sistema_enum, estado character varying, red_id uuid, red_nombre character varying, casa_de_paz_id uuid, casa_de_paz_etiqueta text, fecha_creacion timestamp with time zone, fecha_completada timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT il.id, il.correo, il.rol, il.estado, il.red_id, red.nombre,
         il.casa_de_paz_id, fn_etiqueta_cdp(il.casa_de_paz_id), il.fecha_creacion, il.fecha_completada
  FROM invitacion_lider il
  LEFT JOIN red ON red.id = il.red_id
  WHERE il.iglesia_id = p_iglesia_id AND il.fecha_eliminacion IS NULL AND il.departamento_id IS NULL
    AND (
      fn_es_operativo_en(p_iglesia_id)
      OR fn_es_pastor_en(p_iglesia_id)
      OR (il.red_id IS NOT NULL AND fn_es_lider_de_red(il.red_id))
      OR (il.casa_de_paz_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM casa_de_paz_red cr WHERE cr.casa_de_paz_id = il.casa_de_paz_id
              AND cr.fecha_eliminacion IS NULL AND fn_es_lider_de_red(cr.red_id)
          ))
    )
  ORDER BY il.fecha_creacion DESC;
$function$;

CREATE OR REPLACE FUNCTION public.fn_listar_movimientos_red_persona(p_iglesia_id uuid)
 RETURNS TABLE(id uuid, fecha_movimiento timestamp with time zone, motivo text, persona_id uuid, persona_nombre text, red_origen_id uuid, red_origen_nombre character varying, red_destino_id uuid, red_destino_nombre character varying, cargos_finalizados jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (fn_es_operativo_en(p_iglesia_id) or fn_es_pastor_en(p_iglesia_id)) then
    raise exception 'MOVIMIENTOS_SIN_PERMISO: se requiere ser Pastor o Supervisor de la iglesia' using errcode = 'P0001';
  end if;

  return query
  select m.id, m.fecha_movimiento, m.motivo,
    m.persona_id, fn_nombre_completo(p),
    m.red_origen_id, ro.nombre, m.red_destino_id, rd.nombre,
    m.cargos_finalizados
  from movimiento_red_persona m
  join persona p on p.id = m.persona_id
  join red ro on ro.id = m.red_origen_id
  join red rd on rd.id = m.red_destino_id
  where m.iglesia_id = p_iglesia_id and m.fecha_eliminacion is null
  order by m.fecha_movimiento desc;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_matrimonios_iglesia(p_iglesia_id uuid)
 RETURNS TABLE(persona1_id uuid, persona1_nombre text, persona1_sexo sexo_enum, persona2_id uuid, persona2_nombre text, persona2_sexo sexo_enum, casa_de_paz_etiqueta text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'IGLESIA_FUERA_DE_ALCANCE' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (fn_es_encargado_matrimonios_en(p_iglesia_id) OR fn_es_operativo_en(p_iglesia_id) OR fn_es_pastor_en(p_iglesia_id)) THEN
    RAISE EXCEPTION 'SIN_ACCESO: se requiere ser Encargado de Matrimonios, Pastor o Supervisor' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    pa.id, fn_nombre_completo(pa), pa.sexo,
    pb.id, fn_nombre_completo(pb), pb.sexo,
    (SELECT fn_etiqueta_cdp(cm.casa_de_paz_id) FROM casa_de_paz_membresia cm
     WHERE cm.persona_id = pa.id AND cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL LIMIT 1)
  FROM (
    SELECT DISTINCT LEAST(f.persona_id, f.familiar_id) AS p1, GREATEST(f.persona_id, f.familiar_id) AS p2
    FROM familia f
    JOIN tipo_relacion tr ON tr.id = f.tipo_relacion_id AND tr.codigo = 'CONYUGE'
    WHERE f.fecha_eliminacion IS NULL AND f.iglesia_id = p_iglesia_id
  ) par
  JOIN persona pa ON pa.id = par.p1 AND pa.fecha_eliminacion IS NULL
  JOIN persona pb ON pb.id = par.p2 AND pb.fecha_eliminacion IS NULL
  WHERE NOT pa.oculto AND NOT pb.oculto
  ORDER BY fn_nombre_completo(pa);
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_metas_cdp_red(p_red_id uuid)
 RETURNS TABLE(casa_de_paz_id uuid, etiqueta text, meta integer, origen character varying)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_iglesia_id UUID;
BEGIN
  SELECT red.iglesia_id INTO v_iglesia_id FROM red WHERE red.id = p_red_id;
  IF v_iglesia_id IS NULL OR v_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'RED_FUERA_DE_ALCANCE: sin acceso a la red %', p_red_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (fn_es_lider_de_red(p_red_id) OR fn_es_operativo_en(v_iglesia_id) OR fn_es_pastor_en(v_iglesia_id)) THEN
    RAISE EXCEPTION 'RED_FUERA_DE_ALCANCE: sin cargo vigente en la red %', p_red_id USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT c.id, fn_etiqueta_cdp(c.id), m.meta, m.origen
  FROM casa_de_paz c
  JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = c.id
  LEFT JOIN LATERAL fn_meta_efectiva(c.id, CURRENT_DATE) m ON true
  WHERE cdr.red_id = p_red_id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
    AND c.activo AND c.fecha_eliminacion IS NULL
  ORDER BY fn_etiqueta_cdp(c.id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_mover_persona_red(p_persona_id uuid, p_casa_de_paz_destino_id uuid, p_motivo text, p_confirmar_cierre_cargos boolean DEFAULT false, p_pin text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_iglesia_id uuid;
  v_cdp_origen_id uuid;
  v_red_origen_id uuid;
  v_iglesia_destino uuid;
  v_red_destino_id uuid;
  v_cdp_destino_activa boolean;
  v_lider_vigente uuid;
  v_solicitud_id uuid;
  v_movimiento_id uuid;
  v_cargos_cerrados jsonb := '[]'::jsonb;
  v_tiene_cargos boolean;
begin
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'MOVIMIENTO_MOTIVO_OBLIGATORIO: hay que escribir el motivo del traslado' using errcode = 'P0001';
  end if;

  select p.iglesia_id into v_iglesia_id from persona p where p.id = p_persona_id and p.fecha_eliminacion is null;
  if v_iglesia_id is null then
    raise exception 'MOVIMIENTO_PERSONA_INEXISTENTE: la persona no existe' using errcode = 'P0001';
  end if;

  select cm.casa_de_paz_id into v_cdp_origen_id
  from casa_de_paz_membresia cm
  where cm.persona_id = p_persona_id and cm.es_principal
    and cm.fecha_fin is null and cm.fecha_eliminacion is null;
  if v_cdp_origen_id is null then
    raise exception 'MOVIMIENTO_SIN_CDP_ORIGEN: la persona no tiene una Casa de Paz principal vigente; no hay Red de origen para trasladar'
      using errcode = 'P0001';
  end if;

  select cr.red_id into v_red_origen_id
  from casa_de_paz_red cr
  where cr.casa_de_paz_id = v_cdp_origen_id and cr.fecha_fin is null and cr.fecha_eliminacion is null;
  if v_red_origen_id is null then
    raise exception 'MOVIMIENTO_RED_ORIGEN_NO_ENCONTRADA: la Casa de Paz actual de la persona no tiene Red vigente' using errcode = 'P0001';
  end if;

  select cdp.iglesia_id, cr.red_id, cdp.activo
  into v_iglesia_destino, v_red_destino_id, v_cdp_destino_activa
  from casa_de_paz cdp
  join casa_de_paz_red cr on cr.casa_de_paz_id = cdp.id and cr.fecha_fin is null and cr.fecha_eliminacion is null
  where cdp.id = p_casa_de_paz_destino_id and cdp.fecha_eliminacion is null;

  if v_red_destino_id is null then
    raise exception 'MOVIMIENTO_CDP_DESTINO_INVALIDA: la Casa de Paz de destino no existe o no tiene Red vigente' using errcode = 'P0001';
  end if;
  if not v_cdp_destino_activa then
    raise exception 'MOVIMIENTO_CDP_DESTINO_INACTIVA: la Casa de Paz de destino esta inactiva' using errcode = 'P0001';
  end if;
  if v_iglesia_destino is distinct from v_iglesia_id then
    raise exception 'MOVIMIENTO_ENTRE_IGLESIAS_NO_PERMITIDO: no hay traslado de persona entre Iglesias distintas sin un proceso especifico'
      using errcode = 'P0001';
  end if;
  if v_red_destino_id = v_red_origen_id then
    raise exception 'MOVIMIENTO_MISMA_RED: la persona ya pertenece a esa Red' using errcode = 'P0001';
  end if;

  if not (fn_es_operativo_en(v_iglesia_id) or fn_es_pastor_en(v_iglesia_id) or fn_es_lider_de_red(v_red_origen_id)) then
    raise exception 'MOVIMIENTO_SIN_PERMISO: se requiere ser Lider de la Red de origen, o Pastor/Supervisor' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_cargos_cerrados from (
    select jsonb_build_object('ambito', 'RED', 'entidad', r.nombre, 'cargo_codigo', c.codigo, 'cargo_nombre', c.nombre) as x
    from red_cargo rc join cargo c on c.id = rc.cargo_id join red r on r.id = rc.red_id
    where rc.persona_id = p_persona_id and rc.red_id = v_red_origen_id
      and rc.fecha_fin is null and rc.fecha_eliminacion is null
    union all
    select jsonb_build_object('ambito', 'CDP', 'entidad', fn_etiqueta_cdp(cd.id), 'cargo_codigo', c.codigo, 'cargo_nombre', c.nombre)
    from casa_de_paz_cargo cc join cargo c on c.id = cc.cargo_id join casa_de_paz cd on cd.id = cc.casa_de_paz_id
    where cc.persona_id = p_persona_id and cc.casa_de_paz_id = v_cdp_origen_id
      and cc.fecha_fin is null and cc.fecha_eliminacion is null
  ) sub;

  v_tiene_cargos := jsonb_array_length(v_cargos_cerrados) > 0;
  if v_tiene_cargos and not p_confirmar_cierre_cargos then
    raise exception 'MOVIMIENTO_CARGOS_VIGENTES: la persona tiene % cargo(s) vigente(s) en la Red/Casa de Paz de origen que se cerraran con el traslado; confirme para continuar',
      jsonb_array_length(v_cargos_cerrados) using errcode = 'P0001';
  end if;

  if fn_es_supervisor_en(v_iglesia_id) and not fn_es_lider_de_red(v_red_origen_id) then
    select rc.persona_id into v_lider_vigente
    from red_cargo rc join cargo c on c.id = rc.cargo_id
    where rc.red_id = v_red_origen_id and c.codigo = 'LIDER_RED' and rc.fecha_fin is null and rc.fecha_eliminacion is null
    limit 1;
    if v_lider_vigente is not null then
      insert into solicitud_estructura (iglesia_id, red_id, tipo, payload, solicitante_persona_id)
      values (v_iglesia_id, v_red_origen_id, 'MOVER_PERSONA_RED',
        jsonb_build_object('persona_id', p_persona_id, 'casa_de_paz_destino_id', p_casa_de_paz_destino_id,
          'motivo', p_motivo, 'confirmar_cierre_cargos', p_confirmar_cierre_cargos),
        fn_mi_persona_id())
      returning id into v_solicitud_id;
      perform fn_crear_notificacion(v_lider_vigente, 'SOLICITUD_ESTRUCTURA', 'Solicitud de traslado a otra Red',
        'El Supervisor pidió trasladar a una persona de tu Red hacia otra Red. Requiere tu autorización.',
        'solicitud_estructura', v_solicitud_id);
      return null;
    end if;
  end if;

  perform fn_exigir_pin(p_pin);

  update casa_de_paz_membresia
  set fecha_fin = current_date
  where persona_id = p_persona_id and casa_de_paz_id = v_cdp_origen_id
    and es_principal and fecha_fin is null and fecha_eliminacion is null;

  insert into casa_de_paz_membresia (iglesia_id, casa_de_paz_id, persona_id, es_principal, fecha_inicio)
  values (v_iglesia_id, p_casa_de_paz_destino_id, p_persona_id, true, current_date);

  if v_tiene_cargos then
    update red_cargo set fecha_fin = current_date
    where persona_id = p_persona_id and red_id = v_red_origen_id and fecha_fin is null and fecha_eliminacion is null;

    update casa_de_paz_cargo set fecha_fin = current_date
    where persona_id = p_persona_id and casa_de_paz_id = v_cdp_origen_id and fecha_fin is null and fecha_eliminacion is null;
  end if;

  insert into movimiento_red_persona (
    iglesia_id, persona_id, red_origen_id, casa_de_paz_origen_id,
    red_destino_id, casa_de_paz_destino_id, motivo, cargos_finalizados
  ) values (
    v_iglesia_id, p_persona_id, v_red_origen_id, v_cdp_origen_id,
    v_red_destino_id, p_casa_de_paz_destino_id, p_motivo, v_cargos_cerrados
  ) returning id into v_movimiento_id;

  return v_movimiento_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_multiplicar_cdp(p_origen_id uuid, p_nombre_nueva character varying, p_persona_ids uuid[], p_lider_nuevo_id uuid, p_motivo text, p_pin text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_iglesia_id UUID;
  v_red_id UUID;
  v_nueva_id UUID;
  v_cantidad SMALLINT;
  v_cargo_lider_id UUID;
  v_lider_vigente UUID;
  v_solicitud_id UUID;
BEGIN
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'MULTIPLICACION_MOTIVO_OBLIGATORIO: hay que escribir el motivo de la multiplicacion' USING ERRCODE = 'P0001';
  END IF;
  IF p_persona_ids IS NULL OR array_length(p_persona_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'MULTIPLICACION_SIN_MIEMBROS: hay que elegir al menos una persona que se va a la nueva Casa de Paz' USING ERRCODE = 'P0001';
  END IF;

  SELECT iglesia_id INTO v_iglesia_id FROM casa_de_paz WHERE id = p_origen_id AND fecha_eliminacion IS NULL AND activo;
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'MULTIPLICACION_CDP_INEXISTENTE: la casa de paz de origen no existe o esta inactiva' USING ERRCODE = 'P0001';
  END IF;

  SELECT red_id INTO v_red_id FROM casa_de_paz_red
  WHERE casa_de_paz_id = p_origen_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  IF NOT (fn_es_operativo_en(v_iglesia_id) OR fn_es_pastor_en(v_iglesia_id) OR (v_red_id IS NOT NULL AND fn_es_lider_de_red(v_red_id))) THEN
    RAISE EXCEPTION 'MULTIPLICACION_SIN_PERMISO: se requiere ser Lider de la Red de esta CdP, o Pastor/Supervisor' USING ERRCODE = 'P0001';
  END IF;

  IF v_red_id IS NOT NULL AND fn_es_supervisor_en(v_iglesia_id) AND NOT fn_es_lider_de_red(v_red_id) THEN
    SELECT rc.persona_id INTO v_lider_vigente
    FROM red_cargo rc JOIN cargo c ON c.id = rc.cargo_id
    WHERE rc.red_id = v_red_id AND c.codigo = 'LIDER_RED' AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
    LIMIT 1;
    IF v_lider_vigente IS NOT NULL THEN
      INSERT INTO solicitud_estructura (iglesia_id, red_id, tipo, payload, solicitante_persona_id)
      VALUES (v_iglesia_id, v_red_id, 'MULTIPLICAR_CDP',
        jsonb_build_object('origen_id', p_origen_id, 'nombre_nueva', p_nombre_nueva,
          'persona_ids', to_jsonb(p_persona_ids), 'lider_nuevo_id', p_lider_nuevo_id, 'motivo', p_motivo),
        fn_mi_persona_id())
      RETURNING id INTO v_solicitud_id;
      PERFORM fn_crear_notificacion(v_lider_vigente, 'SOLICITUD_ESTRUCTURA', 'Solicitud de multiplicación de Casa de Paz',
        'El Supervisor pidió multiplicar una Casa de Paz de tu Red. Requiere tu autorización.', 'solicitud_estructura', v_solicitud_id);
      RETURN NULL;
    END IF;
  END IF;

  PERFORM fn_exigir_pin(p_pin);

  INSERT INTO casa_de_paz (iglesia_id, nombre)
  VALUES (v_iglesia_id, NULLIF(btrim(p_nombre_nueva), ''))
  RETURNING id INTO v_nueva_id;

  IF v_red_id IS NOT NULL THEN
    INSERT INTO casa_de_paz_red (iglesia_id, casa_de_paz_id, red_id, fecha_inicio)
    VALUES (v_iglesia_id, v_nueva_id, v_red_id, CURRENT_DATE);
  END IF;

  UPDATE casa_de_paz_membresia
  SET fecha_fin = CURRENT_DATE
  WHERE casa_de_paz_id = p_origen_id AND persona_id = ANY(p_persona_ids)
    AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
  GET DIAGNOSTICS v_cantidad = ROW_COUNT;

  IF v_cantidad = 0 THEN
    RAISE EXCEPTION 'MULTIPLICACION_MIEMBROS_INVALIDOS: ninguna de las personas elegidas es miembro vigente de esta Casa de Paz' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO casa_de_paz_membresia (iglesia_id, casa_de_paz_id, persona_id, es_principal, fecha_inicio)
  SELECT v_iglesia_id, v_nueva_id, m.persona_id, m.es_principal, CURRENT_DATE
  FROM casa_de_paz_membresia m
  WHERE m.casa_de_paz_id = p_origen_id AND m.persona_id = ANY(p_persona_ids)
    AND m.fecha_fin = CURRENT_DATE AND m.fecha_eliminacion IS NULL;

  IF p_lider_nuevo_id IS NOT NULL THEN
    SELECT id INTO v_cargo_lider_id FROM cargo WHERE codigo = 'LIDER_CDP' AND activo LIMIT 1;
    INSERT INTO casa_de_paz_cargo (iglesia_id, casa_de_paz_id, persona_id, cargo_id, fecha_inicio)
    VALUES (v_iglesia_id, v_nueva_id, p_lider_nuevo_id, v_cargo_lider_id, CURRENT_DATE);
  END IF;

  INSERT INTO multiplicacion_casa_de_paz (iglesia_id, casa_de_paz_origen_id, casa_de_paz_nueva_id, cantidad_movidos, motivo)
  VALUES (v_iglesia_id, p_origen_id, v_nueva_id, v_cantidad, p_motivo);

  RETURN v_nueva_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_multiplicar_red(p_origen_id uuid, p_nombre_nueva character varying, p_cdp_ids uuid[], p_lider_nuevo_id uuid, p_motivo text, p_pin text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_iglesia_id UUID;
  v_nueva_id UUID;
  v_cantidad SMALLINT;
  v_cargo_lider_id UUID;
  v_lider_vigente UUID;
  v_solicitud_id UUID;
BEGIN
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'MULTIPLICACION_MOTIVO_OBLIGATORIO: hay que escribir el motivo de la multiplicacion' USING ERRCODE = 'P0001';
  END IF;
  IF p_nombre_nueva IS NULL OR btrim(p_nombre_nueva) = '' THEN
    RAISE EXCEPTION 'MULTIPLICACION_NOMBRE_OBLIGATORIO: la red nueva necesita un nombre' USING ERRCODE = 'P0001';
  END IF;
  IF p_cdp_ids IS NULL OR array_length(p_cdp_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'MULTIPLICACION_SIN_CDP: hay que elegir al menos una Casa de Paz que se va a la nueva Red' USING ERRCODE = 'P0001';
  END IF;

  SELECT iglesia_id INTO v_iglesia_id FROM red WHERE id = p_origen_id AND fecha_eliminacion IS NULL AND activo;
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'MULTIPLICACION_RED_INEXISTENTE: la red de origen no existe o esta inactiva' USING ERRCODE = 'P0001';
  END IF;

  IF NOT (fn_es_operativo_en(v_iglesia_id) OR fn_es_pastor_en(v_iglesia_id)) THEN
    RAISE EXCEPTION 'MULTIPLICACION_SIN_PERMISO: solo el Pastor o el Supervisor de Vision en Accion pueden multiplicar redes'
      USING ERRCODE = 'P0001';
  END IF;

  IF fn_es_supervisor_en(v_iglesia_id) THEN
    SELECT rc.persona_id INTO v_lider_vigente
    FROM red_cargo rc JOIN cargo c ON c.id = rc.cargo_id
    WHERE rc.red_id = p_origen_id AND c.codigo = 'LIDER_RED' AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
    LIMIT 1;
    IF v_lider_vigente IS NOT NULL THEN
      INSERT INTO solicitud_estructura (iglesia_id, red_id, tipo, payload, solicitante_persona_id)
      VALUES (v_iglesia_id, p_origen_id, 'MULTIPLICAR_RED',
        jsonb_build_object('origen_id', p_origen_id, 'nombre_nueva', p_nombre_nueva,
          'cdp_ids', to_jsonb(p_cdp_ids), 'lider_nuevo_id', p_lider_nuevo_id, 'motivo', p_motivo),
        fn_mi_persona_id())
      RETURNING id INTO v_solicitud_id;
      PERFORM fn_crear_notificacion(v_lider_vigente, 'SOLICITUD_ESTRUCTURA', 'Solicitud de multiplicación de Red',
        'El Supervisor pidió multiplicar tu Red. Requiere tu autorización.', 'solicitud_estructura', v_solicitud_id);
      RETURN NULL;
    END IF;
  END IF;

  PERFORM fn_exigir_pin(p_pin);

  INSERT INTO red (iglesia_id, nombre) VALUES (v_iglesia_id, btrim(p_nombre_nueva)) RETURNING id INTO v_nueva_id;

  UPDATE casa_de_paz_red
  SET fecha_fin = CURRENT_DATE
  WHERE red_id = p_origen_id AND casa_de_paz_id = ANY(p_cdp_ids)
    AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
  GET DIAGNOSTICS v_cantidad = ROW_COUNT;

  IF v_cantidad = 0 THEN
    RAISE EXCEPTION 'MULTIPLICACION_CDP_INVALIDAS: ninguna de las Casas de Paz elegidas pertenece a esta Red' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO casa_de_paz_red (iglesia_id, casa_de_paz_id, red_id, fecha_inicio)
  SELECT v_iglesia_id, cdr.casa_de_paz_id, v_nueva_id, CURRENT_DATE
  FROM casa_de_paz_red cdr
  WHERE cdr.red_id = p_origen_id AND cdr.casa_de_paz_id = ANY(p_cdp_ids)
    AND cdr.fecha_fin = CURRENT_DATE AND cdr.fecha_eliminacion IS NULL;

  IF p_lider_nuevo_id IS NOT NULL THEN
    SELECT id INTO v_cargo_lider_id FROM cargo WHERE codigo = 'LIDER_RED' AND activo LIMIT 1;
    INSERT INTO red_cargo (iglesia_id, red_id, persona_id, cargo_id, fecha_inicio)
    VALUES (v_iglesia_id, v_nueva_id, p_lider_nuevo_id, v_cargo_lider_id, CURRENT_DATE);
  END IF;

  INSERT INTO multiplicacion_red (iglesia_id, red_origen_id, red_nueva_id, cantidad_movidas, motivo)
  VALUES (v_iglesia_id, p_origen_id, v_nueva_id, v_cantidad, p_motivo);

  RETURN v_nueva_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_panel_configuracion(p_iglesia_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (fn_es_operativo_en(p_iglesia_id) OR fn_es_pastor_en(p_iglesia_id)) THEN
    RAISE EXCEPTION 'CONFIG_SIN_PERMISO: se requiere ser Pastor o Supervisor en la iglesia %', p_iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object(
    'iglesia', (SELECT jsonb_build_object('id', id, 'nombre', nombre, 'prefijo', prefijo, 'sufijo', sufijo,
                  'moneda_defecto', (SELECT codigo FROM moneda WHERE id = moneda_defecto_id))
                FROM iglesia WHERE id = p_iglesia_id),
    'categorias', (
      SELECT jsonb_object_agg(categoria, items)
      FROM (
        SELECT cd.categoria,
               jsonb_agg(jsonb_build_object(
                 'codigo', cd.codigo, 'nombre', cd.nombre, 'descripcion', cd.descripcion,
                 'tipo', cd.tipo, 'valor_actual', fn_config_raw(p_iglesia_id, cd.codigo),
                 'valor_defecto', cd.valor_defecto, 'valor_min', cd.valor_min, 'valor_max', cd.valor_max,
                 'unidad', cd.unidad,
                 'es_personalizado', EXISTS (
                   SELECT 1 FROM configuracion_valor cv
                   WHERE cv.iglesia_id = p_iglesia_id AND cv.definicion_id = cd.id AND cv.fecha_eliminacion IS NULL
                 )
               ) ORDER BY cd.orden) AS items
        FROM configuracion_definicion cd
        WHERE cd.activo AND cd.modulo <= 1 AND cd.fecha_eliminacion IS NULL
        GROUP BY cd.categoria
      ) x
    ),
    'departamentos', (
      SELECT jsonb_agg(jsonb_build_object('id', id, 'codigo', codigo, 'nombre', nombre, 'activo', activo))
      FROM departamento WHERE iglesia_id = p_iglesia_id AND fecha_eliminacion IS NULL
    ),
    'advertencia', 'Los cambios se aplican desde este momento. No se recalcula lo ya procesado.'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_personas_de_red(p_red_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_iglesia_id UUID;
  v_resultado JSONB;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM red WHERE id = p_red_id AND fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'RED_NO_ENCONTRADA' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (fn_es_lider_de_red(p_red_id) OR fn_es_operativo_en(v_iglesia_id) OR fn_es_pastor_en(v_iglesia_id)) THEN
    RAISE EXCEPTION 'RED_FUERA_DE_ALCANCE: no administras esta Red' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(jsonb_agg(fila ORDER BY orden), '[]'::jsonb)
  INTO v_resultado
  FROM (
    SELECT
      fn_nombre_completo(p) AS orden,
      jsonb_build_object(
        'persona_id', p.id,
        'nombre_completo', fn_nombre_completo(p),
        'sexo', p.sexo,
        'edad', CASE WHEN p.fecha_nacimiento IS NULL THEN NULL
                     ELSE EXTRACT(YEAR FROM age(p.fecha_nacimiento))::INT END,
        'estado_sigla', e.sigla,
        'estado_nombre', e.nombre,
        'casa_de_paz_id', cdp.id,
        'casa_de_paz_etiqueta', fn_etiqueta_cdp(cdp.id),
        'lider_nombre', (
          SELECT fn_nombre_completo(lp)
          FROM casa_de_paz_cargo cc
          JOIN cargo c ON c.id = cc.cargo_id
          JOIN persona lp ON lp.id = cc.persona_id
          WHERE cc.casa_de_paz_id = cdp.id AND c.codigo = 'LIDER_CDP'
            AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
          LIMIT 1
        ),
        'sublider_nombre', (
          SELECT string_agg(fn_nombre_completo(sp), ', ' ORDER BY fn_nombre_completo(sp))
          FROM casa_de_paz_cargo cc
          JOIN cargo c ON c.id = cc.cargo_id
          JOIN persona sp ON sp.id = cc.persona_id
          WHERE cc.casa_de_paz_id = cdp.id AND c.codigo = 'SUBLIDER_CDP'
            AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
        ),
        'fecha_ingreso', (
          SELECT MIN(m2.fecha_inicio) FROM casa_de_paz_membresia m2
          WHERE m2.persona_id = p.id AND m2.fecha_eliminacion IS NULL
        ),
        'procedencia', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'casa_de_paz_id', mh.casa_de_paz_id,
            'etiqueta', fn_etiqueta_cdp(mh.casa_de_paz_id),
            'fecha_inicio', mh.fecha_inicio,
            'fecha_fin', mh.fecha_fin,
            'vigente', mh.fecha_fin IS NULL,
            'por_fusion', f.id IS NOT NULL,
            'motivo', f.motivo
          ) ORDER BY mh.fecha_inicio)
          FROM casa_de_paz_membresia mh
          LEFT JOIN fusion_casa_de_paz f
            ON f.casa_de_paz_origen_id = mh.casa_de_paz_id
           AND f.fecha_fusion::date = mh.fecha_fin
           AND f.deshecha_en IS NULL
           AND f.fecha_eliminacion IS NULL
          WHERE mh.persona_id = p.id AND mh.fecha_eliminacion IS NULL
        ), '[]'::jsonb),
        'proviene_de_fusion', EXISTS (
          SELECT 1
          FROM casa_de_paz_membresia mh
          JOIN fusion_casa_de_paz f
            ON f.casa_de_paz_origen_id = mh.casa_de_paz_id
           AND f.fecha_fusion::date = mh.fecha_fin
           AND f.deshecha_en IS NULL
           AND f.fecha_eliminacion IS NULL
          WHERE mh.persona_id = p.id AND mh.fecha_eliminacion IS NULL
        )
      ) AS fila
    FROM casa_de_paz_membresia cm
    JOIN casa_de_paz_red cr
      ON cr.casa_de_paz_id = cm.casa_de_paz_id
     AND cr.red_id = p_red_id AND cr.fecha_fin IS NULL AND cr.fecha_eliminacion IS NULL
    JOIN casa_de_paz cdp ON cdp.id = cm.casa_de_paz_id
    JOIN persona p ON p.id = cm.persona_id AND p.fecha_eliminacion IS NULL
    LEFT JOIN persona_estado pe
      ON pe.persona_id = p.id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL
    LEFT JOIN estado e ON e.id = pe.estado_id
    WHERE cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL
  ) sub;

  RETURN v_resultado;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_puede_invitar_lider(p_rol rol_sistema_enum, p_red_id uuid, p_casa_de_paz_id uuid, p_departamento_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_iglesia_id uuid;
  v_red_de_cdp uuid;
begin
  if p_departamento_id is not null then
    select iglesia_id into v_iglesia_id from departamento where id = p_departamento_id;
    return v_iglesia_id is not null and (fn_es_super_admin() or fn_es_operativo_en(v_iglesia_id) or fn_es_pastor_en(v_iglesia_id));
  end if;

  if p_rol = 'LIDER_RED' then
    if p_red_id is null then return false; end if;
    select iglesia_id into v_iglesia_id from red where id = p_red_id;
    return v_iglesia_id is not null and (fn_es_super_admin() or fn_es_operativo_en(v_iglesia_id) or fn_es_pastor_en(v_iglesia_id));

  elsif p_rol in ('LIDER_CDP', 'SUBLIDER_CDP') then
    if p_casa_de_paz_id is null then return false; end if;
    select iglesia_id into v_iglesia_id from casa_de_paz where id = p_casa_de_paz_id;
    if v_iglesia_id is null then return false; end if;
    if fn_es_super_admin() or fn_es_operativo_en(v_iglesia_id) or fn_es_pastor_en(v_iglesia_id) then return true; end if;

    select cr.red_id into v_red_de_cdp from casa_de_paz_red cr
    where cr.casa_de_paz_id = p_casa_de_paz_id and cr.fecha_eliminacion is null;
    return v_red_de_cdp is not null and fn_es_lider_de_red(v_red_de_cdp);

  else
    return false;
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_puede_reportar_cdp(p_casa_de_paz_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    fn_es_operativo_en((SELECT iglesia_id FROM casa_de_paz WHERE id = p_casa_de_paz_id))
    OR fn_es_pastor_en((SELECT iglesia_id FROM casa_de_paz WHERE id = p_casa_de_paz_id))
    OR fn_es_lider_cdp(p_casa_de_paz_id)
    OR fn_es_sublider_cdp(p_casa_de_paz_id);
$function$;

CREATE OR REPLACE FUNCTION public.fn_quitar_cargo_departamento(p_cargo_id uuid, p_pin text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_iglesia_id uuid;
begin
  select iglesia_id into v_iglesia_id from departamento_cargo
  where id = p_cargo_id and fecha_fin is null and fecha_eliminacion is null;
  if v_iglesia_id is null then
    raise exception 'DEPARTAMENTO_CARGO_INEXISTENTE: la asignacion no existe o ya no esta vigente' using errcode = 'P0001';
  end if;
  if not (fn_es_super_admin() or fn_es_operativo_en(v_iglesia_id) or fn_es_pastor_en(v_iglesia_id)) then
    raise exception 'DEPARTAMENTO_SOLO_OPERATIVO: se requiere ser Pastor o Supervisor de la iglesia para quitar un Lider de Departamento'
      using errcode = 'P0001';
  end if;

  perform private.fn_estructura_exigir_otp(v_iglesia_id, p_pin);

  update departamento_cargo set fecha_fin = current_date where id = p_cargo_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_rechazar_solicitud_estructura(p_id uuid, p_motivo text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sol solicitud_estructura%ROWTYPE;
BEGIN
  SELECT * INTO v_sol FROM solicitud_estructura WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SOLICITUD_NO_ENCONTRADA: no existe esa solicitud' USING ERRCODE = 'P0001';
  END IF;
  IF v_sol.estado <> 'PENDIENTE' THEN
    RAISE EXCEPTION 'SOLICITUD_YA_RESUELTA: esta solicitud ya fue resuelta' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (fn_es_lider_de_red(v_sol.red_id) OR fn_es_operativo_en(v_sol.iglesia_id) OR fn_es_pastor_en(v_sol.iglesia_id)) THEN
    RAISE EXCEPTION 'SOLICITUD_SIN_PERMISO: se requiere ser el Lider de esa Red, o Pastor/Supervisor' USING ERRCODE = 'P0001';
  END IF;

  UPDATE solicitud_estructura
  SET estado = 'RECHAZADA', motivo_rechazo = p_motivo, fecha_resolucion = now(), resuelta_por_persona_id = fn_mi_persona_id()
  WHERE id = p_id;

  PERFORM fn_crear_notificacion(v_sol.solicitante_persona_id, 'SOLICITUD_RESUELTA',
    'Tu solicitud fue rechazada',
    coalesce('El Líder de Red rechazó tu solicitud: ' || p_motivo, 'El Líder de Red rechazó tu solicitud.'),
    'solicitud_estructura', p_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_renombrar_iglesia(p_iglesia_id uuid, p_nombre character varying, p_pin text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (fn_es_operativo_en(p_iglesia_id) OR fn_es_pastor_en(p_iglesia_id)) THEN
    RAISE EXCEPTION 'CONFIG_SIN_PERMISO: se requiere ser Pastor o Supervisor de la iglesia %', p_iglesia_id
      USING ERRCODE = 'P0001';
  END IF;
  IF btrim(p_nombre) = '' THEN
    RAISE EXCEPTION 'NOMBRE_VACIO: el nombre de la iglesia no puede quedar vacio' USING ERRCODE = 'P0001';
  END IF;
  PERFORM fn_exigir_pin(p_pin);

  UPDATE iglesia SET nombre = btrim(p_nombre) WHERE id = p_iglesia_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_renombrar_iglesia(p_iglesia_id uuid, p_prefijo character varying, p_sufijo character varying, p_pin text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (fn_es_operativo_en(p_iglesia_id) OR fn_es_pastor_en(p_iglesia_id)) THEN
    RAISE EXCEPTION 'CONFIG_SIN_PERMISO: se requiere ser Pastor o Supervisor de la iglesia %', p_iglesia_id
      USING ERRCODE = 'P0001';
  END IF;
  IF btrim(p_prefijo) = '' OR btrim(p_sufijo) = '' THEN
    RAISE EXCEPTION 'NOMBRE_VACIO: el prefijo y el sufijo de la iglesia no pueden quedar vacios' USING ERRCODE = 'P0001';
  END IF;
  PERFORM fn_exigir_pin(p_pin);

  UPDATE iglesia SET prefijo = btrim(p_prefijo), sufijo = btrim(p_sufijo) WHERE id = p_iglesia_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_restringir_oculto()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NOT (fn_es_operativo_en(NEW.iglesia_id) OR fn_es_pastor_en(NEW.iglesia_id)) THEN
    RAISE EXCEPTION 'OCULTO_REQUIERE_OPERATIVO: solo el Pastor o Supervisor puede cambiar la visibilidad de una persona'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_set_configuracion(p_iglesia_id uuid, p_codigo character varying, p_valor text, p_pin text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_def_id UUID;
  v_existente UUID;
BEGIN
  IF NOT (fn_es_operativo_en(p_iglesia_id) OR fn_es_pastor_en(p_iglesia_id)) THEN
    RAISE EXCEPTION 'CONFIG_SIN_PERMISO: se requiere ser Pastor o Supervisor de la iglesia %', p_iglesia_id
      USING ERRCODE = 'P0001';
  END IF;
  PERFORM fn_exigir_pin(p_pin);

  SELECT id INTO v_def_id FROM configuracion_definicion WHERE codigo = p_codigo;
  IF v_def_id IS NULL THEN
    RAISE EXCEPTION 'CONFIG_CODIGO_INEXISTENTE: no existe la configuracion %', p_codigo USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_existente FROM configuracion_valor
  WHERE iglesia_id = p_iglesia_id AND definicion_id = v_def_id AND fecha_eliminacion IS NULL;

  IF v_existente IS NOT NULL THEN
    UPDATE configuracion_valor SET valor = p_valor WHERE id = v_existente;
  ELSE
    INSERT INTO configuracion_valor (iglesia_id, definicion_id, valor) VALUES (p_iglesia_id, v_def_id, p_valor);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_tasa_evangelismo_red(p_red_id uuid, p_desde date, p_hasta date)
 RETURNS TABLE(evangelizados bigint, meta_total integer, cdp_con_meta integer, cdp_total integer, tasa numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_iglesia_id UUID;
BEGIN
  SELECT red.iglesia_id INTO v_iglesia_id FROM red WHERE red.id = p_red_id;
  IF v_iglesia_id IS NULL OR v_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'RED_FUERA_DE_ALCANCE: sin acceso a la red %', p_red_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (fn_es_lider_de_red(p_red_id) OR fn_es_operativo_en(v_iglesia_id) OR fn_es_pastor_en(v_iglesia_id)) THEN
    RAISE EXCEPTION 'RED_FUERA_DE_ALCANCE: sin cargo vigente en la red %', p_red_id USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  WITH cdps AS (
    SELECT c.id FROM casa_de_paz c
    JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = c.id
    WHERE cdr.red_id = p_red_id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
      AND c.activo AND c.fecha_eliminacion IS NULL
  ),
  conteo AS (
    SELECT count(*) AS n FROM evangelismo e
    WHERE e.casa_de_paz_id IN (SELECT id FROM cdps) AND e.fecha BETWEEN p_desde AND p_hasta AND e.fecha_eliminacion IS NULL
  ),
  metas AS (
    SELECT m.meta, m.origen FROM cdps CROSS JOIN LATERAL fn_meta_efectiva(cdps.id, CURRENT_DATE) m
  )
  SELECT c.n,
         COALESCE(SUM(metas.meta) FILTER (WHERE metas.origen IS DISTINCT FROM 'ASIGNADA_RED'), 0)::INTEGER AS meta_total,
         COUNT(metas.meta)::INTEGER AS cdp_con_meta,
         (SELECT COUNT(*) FROM cdps)::INTEGER AS cdp_total,
         CASE WHEN COALESCE(SUM(metas.meta) FILTER (WHERE metas.origen IS DISTINCT FROM 'ASIGNADA_RED'), 0) = 0 THEN NULL
              ELSE round((c.n::numeric / SUM(metas.meta) FILTER (WHERE metas.origen IS DISTINCT FROM 'ASIGNADA_RED')) * 100, 2) END AS tasa
  FROM conteo c LEFT JOIN metas ON true
  GROUP BY c.n;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_toggle_departamento(p_departamento_id uuid, p_activo boolean, p_pin text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_iglesia_id UUID;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM departamento WHERE id = p_departamento_id;
  IF v_iglesia_id IS NULL OR NOT (fn_es_operativo_en(v_iglesia_id) OR fn_es_pastor_en(v_iglesia_id)) THEN
    RAISE EXCEPTION 'CONFIG_SIN_PERMISO: se requiere ser Pastor o Supervisor de esa iglesia' USING ERRCODE = 'P0001';
  END IF;
  PERFORM fn_exigir_pin(p_pin);

  UPDATE departamento SET activo = p_activo WHERE id = p_departamento_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_validar_configuracion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  d configuracion_definicion;
  v_num NUMERIC;
BEGIN
  SELECT * INTO d FROM configuracion_definicion WHERE id = NEW.definicion_id;

  IF NEW.iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'CONFIG_FUERA_DE_ALCANCE: la iglesia % no esta entre sus iglesias accesibles', NEW.iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (fn_es_operativo_en(NEW.iglesia_id) OR fn_es_pastor_en(NEW.iglesia_id)) THEN
    RAISE EXCEPTION 'CONFIG_SIN_PERMISO: se requiere ser Pastor o Supervisor en la iglesia %', NEW.iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  CASE d.tipo
    WHEN 'BOOLEANO' THEN
      IF NEW.valor NOT IN ('true', 'false') THEN
        RAISE EXCEPTION 'CONFIG_TIPO_INVALIDO: % es booleano; recibido "%"', d.codigo, NEW.valor
          USING ERRCODE = 'P0001';
      END IF;

    WHEN 'NUMERICO' THEN
      BEGIN
        v_num := NEW.valor::numeric;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'CONFIG_TIPO_INVALIDO: % es numerico; recibido "%"', d.codigo, NEW.valor
          USING ERRCODE = 'P0001';
      END;

      IF d.valor_min IS NOT NULL AND v_num < d.valor_min THEN
        RAISE EXCEPTION 'CONFIG_FUERA_DE_RANGO: % debe ser >= % (recibido %)', d.codigo, d.valor_min, v_num
          USING ERRCODE = 'P0001';
      END IF;
      IF d.valor_max IS NOT NULL AND v_num > d.valor_max THEN
        RAISE EXCEPTION 'CONFIG_FUERA_DE_RANGO: % debe ser <= % (recibido %)', d.codigo, d.valor_max, v_num
          USING ERRCODE = 'P0001';
      END IF;

    WHEN 'TEXTO' THEN
      NULL;
  END CASE;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_visitas_red(p_red_id uuid, p_desde date DEFAULT NULL::date, p_hasta date DEFAULT NULL::date)
 RETURNS TABLE(id uuid, casa_de_paz_id uuid, casa_de_paz_etiqueta text, lider_cdp_id uuid, lider_cdp_nombre text, motivo motivo_visita_enum, aspectos text[], aspecto_otro_detalle text, observaciones text, tiene_adn_casa boolean, ensenanza_correcta boolean, fecha_visita date, hora_registro timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_iglesia_id UUID;
BEGIN
  SELECT red.iglesia_id INTO v_iglesia_id FROM red WHERE red.id = p_red_id;
  IF v_iglesia_id IS NULL OR v_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'RED_FUERA_DE_ALCANCE: sin acceso a la red %', p_red_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (fn_es_lider_de_red(p_red_id) OR fn_es_operativo_en(v_iglesia_id) OR fn_es_pastor_en(v_iglesia_id)) THEN
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
         v.motivo, v.aspectos, v.aspecto_otro_detalle, v.observaciones,
         v.tiene_adn_casa, v.ensenanza_correcta, v.fecha_visita, v.hora_registro
  FROM visita_cdp v
  WHERE v.red_id = p_red_id AND v.fecha_eliminacion IS NULL
    AND (p_desde IS NULL OR v.fecha_visita >= p_desde)
    AND (p_hasta IS NULL OR v.fecha_visita <= p_hasta)
  ORDER BY v.fecha_visita DESC, v.hora_registro DESC;
END;
$function$;

-- fn_validar_asignacion_rol: ya fue editada hoy en 20260809050000 (excepcion
-- para no bloquear remociones/soft-deletes). Se agrega ADEMAS paridad Pastor
-- en las dos condiciones (LIDER_RED, LIDER_CDP/SUBLIDER_CDP) cuyo mensaje ya
-- decia "Pastor o Supervisor"/"Pastor, Supervisor o Lider de Red" pero el
-- codigo no lo chequeaba. No se toca la jerarquia deliberada de
-- SUPER_ADMIN/PASTOR/SUPERVISOR_VISION_ACCION, ni ROL_SUPER_ADMIN_NO_OPERATIVO,
-- ni ROL_FUERA_DE_ALCANCE, ni la excepcion de remocion ya agregada.
CREATE OR REPLACE FUNCTION public.fn_validar_asignacion_rol()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.fecha_eliminacion IS NULL AND NEW.fecha_eliminacion IS NOT NULL
     AND NEW.usuario_id = OLD.usuario_id AND NEW.rol = OLD.rol
     AND NEW.iglesia_id IS NOT DISTINCT FROM OLD.iglesia_id THEN
    RETURN NEW;
  END IF;

  IF NEW.usuario_id = auth.uid() THEN
    RAISE EXCEPTION 'ROL_AUTOASIGNACION: un usuario no puede asignarse un rol a si mismo'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol = 'SUPER_ADMIN' AND NOT fn_es_super_admin() THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: solo un SUPER_ADMIN puede crear otro SUPER_ADMIN'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol = 'PASTOR' AND NOT fn_es_super_admin() THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: solo un SUPER_ADMIN puede asignar el rol PASTOR'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol = 'SUPERVISOR_VISION_ACCION' AND NOT (fn_es_super_admin() OR fn_es_pastor_en(NEW.iglesia_id)) THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: se requiere ser PASTOR de la iglesia % para asignar SUPERVISOR_VISION_ACCION', NEW.iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol = 'LIDER_RED' AND NOT (fn_es_super_admin() OR fn_es_operativo_en(NEW.iglesia_id) OR fn_es_pastor_en(NEW.iglesia_id)) THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: se requiere ser Pastor o Supervisor en la iglesia % para asignar %', NEW.iglesia_id, NEW.rol
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol IN ('LIDER_CDP', 'SUBLIDER_CDP')
     AND NOT (fn_es_super_admin() OR fn_es_operativo_en(NEW.iglesia_id) OR fn_es_pastor_en(NEW.iglesia_id) OR fn_es_lider_de_red_en_iglesia(NEW.iglesia_id)) THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: se requiere ser Pastor, Supervisor o Lider de Red en la iglesia % para asignar %', NEW.iglesia_id, NEW.rol
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol IN ('PASTOR', 'SUPERVISOR_VISION_ACCION', 'LIDER_RED', 'LIDER_CDP', 'SUBLIDER_CDP')
     AND EXISTS (SELECT 1 FROM usuario_rol WHERE usuario_id = NEW.usuario_id AND rol = 'SUPER_ADMIN' AND fecha_eliminacion IS NULL) THEN
    RAISE EXCEPTION 'ROL_SUPER_ADMIN_NO_OPERATIVO: un Super Admin no puede tener roles operativos; se necesita una cuenta separada' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.iglesia_id IS NOT NULL AND NEW.iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'ROL_FUERA_DE_ALCANCE: la iglesia % no esta entre sus iglesias accesibles', NEW.iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;
