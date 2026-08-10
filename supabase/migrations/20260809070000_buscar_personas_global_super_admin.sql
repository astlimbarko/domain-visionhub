-- VisionHub -- buscar_personas_global_super_admin
-- Pedido del owner (2026-08-09): al buscar personas para designar Pastor/
-- Supervisor desde Estructura Organizacional, un Super Admin debe poder
-- encontrar a CUALQUIER persona de CUALQUIER iglesia, no solo las que ya
-- tienen ficha en la iglesia que se esta gestionando. Para cualquier otro
-- rol (Pastor/Supervisor/Lider de Red administrando su propia iglesia), la
-- busqueda sigue acotada a su iglesia como antes -- evita exponer datos
-- personales (CI, correo, telefono) de otras iglesias a quien no las
-- administra.
--
-- Se agrega iglesia_id/iglesia_nombre al resultado para que el frontend
-- pueda mostrar de que iglesia es cada persona cuando la busqueda es
-- global (sin esto, dos personas con el mismo nombre en iglesias
-- distintas serian indistinguibles en la lista).
--
-- El cambio de forma de RETURNS TABLE exige DROP + CREATE (Postgres no
-- permite agregar columnas a un resultado existente con CREATE OR REPLACE).
DROP FUNCTION IF EXISTS public.fn_buscar_personas(uuid, text, boolean, integer);

CREATE FUNCTION public.fn_buscar_personas(
  p_iglesia_id uuid,
  p_texto text DEFAULT NULL::text,
  p_incluir_ocultas boolean DEFAULT false,
  p_limite integer DEFAULT 200
)
RETURNS TABLE(
  id uuid, nombre_completo text, sexo sexo_enum, fecha_nacimiento date,
  edad integer, ci character varying, correo character varying, oculto boolean,
  estado_sigla character varying, estado_nombre character varying,
  casa_de_paz_id uuid, casa_de_paz_etiqueta text, telefono_principal character varying,
  iglesia_id uuid, iglesia_nombre character varying
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_global boolean;
BEGIN
  IF p_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'IGLESIA_FUERA_DE_ALCANCE' USING ERRCODE = 'P0001';
  END IF;

  v_global := fn_es_super_admin();

  RETURN QUERY
  SELECT p.id, fn_nombre_completo(p), p.sexo, p.fecha_nacimiento,
         CASE WHEN p.fecha_nacimiento IS NULL THEN NULL
              ELSE EXTRACT(YEAR FROM age(p.fecha_nacimiento))::INT END,
         p.ci, p.correo, p.oculto,
         e.sigla, e.nombre,
         cdp.id, CASE WHEN cdp.id IS NOT NULL THEN fn_etiqueta_cdp(cdp.id) ELSE NULL END,
         tel.numero,
         p.iglesia_id, ig.nombre
  FROM persona p
  JOIN iglesia ig ON ig.id = p.iglesia_id
  LEFT JOIN persona_estado pe ON pe.persona_id = p.id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL
  LEFT JOIN estado e ON e.id = pe.estado_id
  LEFT JOIN casa_de_paz_membresia cm ON cm.persona_id = p.id AND cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL
  LEFT JOIN casa_de_paz cdp ON cdp.id = cm.casa_de_paz_id
  LEFT JOIN telefono_asignacion ta ON ta.persona_id = p.id AND ta.es_principal AND ta.activo AND ta.fecha_eliminacion IS NULL
  LEFT JOIN telefono tel ON tel.id = ta.telefono_id
  WHERE (v_global OR p.iglesia_id = p_iglesia_id)
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
$function$;

-- fn_estructura_asignar_pastor / fn_estructura_asignar_supervisor ya son
-- exclusivas de Super Admin (verifican fn_es_super_admin() antes de llegar
-- a esta linea) -- se les quita la restriccion "and p.iglesia_id =
-- p_iglesia_id" en la busqueda de la Persona para que puedan designar a
-- alguien cuya ficha vive en otra iglesia, consistente con la busqueda
-- global de arriba. Lider de Red / Lider de Casa de Paz (fn_estructura_
-- asignar_cargo_red y equivalente de CdP) NO se tocan: para esos cargos la
-- persona debe pertenecer a la iglesia de esa Red/CdP por diseno.
CREATE OR REPLACE FUNCTION public.fn_estructura_asignar_pastor(p_iglesia_id uuid, p_persona_id uuid, p_otp text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  v_usuario_id uuid;
  v_usuario_rol_id uuid;
  v_cantidad_vigente integer;
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.iglesia i
    where i.id = p_iglesia_id and i.fecha_eliminacion is null
  ) then
    raise exception 'ESTRUCTURA_IGLESIA_NO_ENCONTRADA' using errcode = 'P0001';
  end if;

  if not private.fn_estructura_puede_administrar(p_iglesia_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  if not public.fn_es_super_admin() then
    raise exception 'ESTRUCTURA_PASTOR_SOLO_SUPER_ADMIN: solo un Super Admin puede asignar al Pastor'
      using errcode = 'P0001';
  end if;

  perform private.fn_estructura_exigir_otp(p_iglesia_id, p_otp);

  select p.usuario_id
  into v_usuario_id
  from public.persona p
  where p.id = p_persona_id
    and p.fecha_eliminacion is null;

  if v_usuario_id is null then
    raise exception 'ESTRUCTURA_PERSONA_SIN_CUENTA: la persona no tiene una cuenta de acceso vinculada'
      using errcode = 'P0001';
  end if;

  select count(*)
  into v_cantidad_vigente
  from public.usuario_rol ur
  where ur.iglesia_id = p_iglesia_id
    and ur.rol = 'PASTOR'
    and ur.fecha_eliminacion is null
    and ur.usuario_id <> v_usuario_id;

  if v_cantidad_vigente >= 2 then
    raise exception 'ESTRUCTURA_PASTOR_MAXIMO_DOS: ya hay 2 personas asignadas como Pastor en esta iglesia'
      using errcode = 'P0001';
  end if;

  select id
  into v_usuario_rol_id
  from public.usuario_rol
  where iglesia_id = p_iglesia_id
    and rol = 'PASTOR'
    and usuario_id = v_usuario_id
    and fecha_eliminacion is null;

  if v_usuario_rol_id is null then
    insert into public.usuario_rol (usuario_id, rol, iglesia_id, creado_por, actualizado_por)
    values (v_usuario_id, 'PASTOR', p_iglesia_id, (select auth.uid()), (select auth.uid()))
    returning id into v_usuario_rol_id;
  end if;

  update public.iglesia
  set pastor_id = p_persona_id
  where id = p_iglesia_id;

  return v_usuario_rol_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_estructura_asignar_supervisor(p_iglesia_id uuid, p_persona_id uuid, p_otp text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  v_usuario_id uuid;
  v_usuario_rol_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.iglesia i
    where i.id = p_iglesia_id and i.fecha_eliminacion is null
  ) then
    raise exception 'ESTRUCTURA_IGLESIA_NO_ENCONTRADA' using errcode = 'P0001';
  end if;

  if not private.fn_estructura_puede_administrar(p_iglesia_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  if not public.fn_es_super_admin() then
    raise exception 'ESTRUCTURA_SUPERVISOR_SOLO_SUPER_ADMIN: solo un Super Admin puede asignar al Supervisor desde el constructor'
      using errcode = 'P0001';
  end if;

  perform private.fn_estructura_exigir_otp(p_iglesia_id, p_otp);

  select p.usuario_id
  into v_usuario_id
  from public.persona p
  where p.id = p_persona_id
    and p.fecha_eliminacion is null;

  if v_usuario_id is null then
    raise exception 'ESTRUCTURA_PERSONA_SIN_CUENTA: la persona no tiene una cuenta de acceso vinculada'
      using errcode = 'P0001';
  end if;

  select id
  into v_usuario_rol_id
  from public.usuario_rol
  where iglesia_id = p_iglesia_id
    and rol = 'SUPERVISOR_VISION_ACCION'
    and usuario_id = v_usuario_id
    and fecha_eliminacion is null;

  if v_usuario_rol_id is null then
    insert into public.usuario_rol (usuario_id, rol, iglesia_id, creado_por, actualizado_por)
    values (v_usuario_id, 'SUPERVISOR_VISION_ACCION', p_iglesia_id, (select auth.uid()), (select auth.uid()))
    returning id into v_usuario_rol_id;
  end if;

  update public.iglesia
  set supervisor_id = p_persona_id
  where id = p_iglesia_id;

  return v_usuario_rol_id;
end;
$function$;
