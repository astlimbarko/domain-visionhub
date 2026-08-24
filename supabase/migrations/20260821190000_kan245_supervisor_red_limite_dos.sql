-- VisionHub -- KAN-245: el Constructor permitía un único Supervisor de Red
-- (cargo SUBLIDER_RED) por Red -- asignar uno nuevo cerraba automáticamente
-- al anterior, igual que Líder de Red. Pedido explícito del owner
-- (2026-08-21): permitir hasta 2 Supervisores de Red simultáneos por Red.
-- Alcance confirmado: solo el Constructor -- "Gestión de Redes" ya permite
-- Supervisores ilimitados y no se toca acá.
--
-- Hallazgo clave (leyendo fn_estructura_invitar_supervisor_red): una
-- invitación de Supervisor de Red guarda invitacion_lider.rol = 'LIDER_RED'
-- (mismo rol funcional de acceso que un Líder de Red real) -- el cargo real
-- vive en invitacion_lider.cargo_id (SUBLIDER_RED). fn_completar_membresia y
-- fn_resolver_invitaciones_pendientes_extra ramificaban sobre v_inv.rol, así
-- que sin este fix, confirmar la membresía de un 2do Supervisor invitado por
-- correo hubiera cerrado al primero igual que antes.

begin;

-- ============================================================
-- 1) private.fn_estructura_asignar_cargo_red: camino "desde base de datos".
--    LIDER_RED sigue siendo single-slot (cierra y reemplaza). SUBLIDER_RED
--    ahora permite hasta 2 vigentes -- rechaza el 3ro en vez de cerrar.
-- ============================================================
create or replace function private.fn_estructura_asignar_cargo_red(
  p_red_id uuid,
  p_persona_id uuid,
  p_codigo text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_iglesia_id uuid;
  v_cargo_id uuid;
  v_existente_id uuid;
  v_nuevo_id uuid;
  v_vigentes_count integer;
begin
  if p_codigo not in ('LIDER_RED', 'SUBLIDER_RED') then
    raise exception 'ESTRUCTURA_CARGO_RED_INVALIDO'
      using errcode = 'P0001';
  end if;

  select r.iglesia_id
  into v_iglesia_id
  from public.red r
  where r.id = p_red_id
    and r.fecha_eliminacion is null
  for update;

  if v_iglesia_id is null then
    raise exception 'ESTRUCTURA_RED_NO_ENCONTRADA'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.persona p
    where p.id = p_persona_id
      and p.iglesia_id = v_iglesia_id
      and p.fecha_eliminacion is null
  ) then
    raise exception 'ESTRUCTURA_PERSONA_FUERA_DE_IGLESIA'
      using errcode = 'P0001';
  end if;

  select c.id
  into v_cargo_id
  from public.cargo c
  where c.codigo = p_codigo
    and c.activo
    and c.fecha_eliminacion is null;

  if v_cargo_id is null then
    raise exception 'ESTRUCTURA_CARGO_RED_NO_DISPONIBLE'
      using errcode = 'P0001';
  end if;

  select rc.id
  into v_existente_id
  from public.red_cargo rc
  where rc.red_id = p_red_id
    and rc.cargo_id = v_cargo_id
    and rc.persona_id = p_persona_id
    and rc.fecha_fin is null
    and rc.fecha_eliminacion is null
  order by rc.fecha_inicio, rc.id
  limit 1;

  if v_existente_id is not null then
    return v_existente_id;
  end if;

  if p_codigo = 'LIDER_RED' then
    update public.red_cargo rc
    set fecha_fin = current_date,
        actualizado_por = (select auth.uid())
    where rc.red_id = p_red_id
      and rc.cargo_id = v_cargo_id
      and rc.fecha_fin is null
      and rc.fecha_eliminacion is null;
  else
    -- SUBLIDER_RED (Supervisor de Red): hasta 2 vigentes simultáneos.
    select count(*)
    into v_vigentes_count
    from public.red_cargo rc
    where rc.red_id = p_red_id
      and rc.cargo_id = v_cargo_id
      and rc.fecha_fin is null
      and rc.fecha_eliminacion is null;

    if v_vigentes_count >= 2 then
      raise exception 'ESTRUCTURA_SUPERVISOR_RED_LIMITE: ya hay 2 Supervisores de Red vigentes en esta Red, quitá uno primero'
        using errcode = 'P0001';
    end if;
  end if;

  insert into public.red_cargo (
    iglesia_id, red_id, persona_id, cargo_id, fecha_inicio,
    creado_por, actualizado_por
  ) values (
    v_iglesia_id, p_red_id, p_persona_id, v_cargo_id, current_date,
    (select auth.uid()), (select auth.uid())
  )
  returning id into v_nuevo_id;

  return v_nuevo_id;
end;
$$;

revoke all on function private.fn_estructura_asignar_cargo_red(uuid, uuid, text)
  from public, anon, authenticated;

-- ============================================================
-- 2) public.fn_estructura_quitar_cargo_red: agrega p_persona_id para poder
--    apuntar a UNO de los (hasta 2) Supervisores de Red vigentes. Cambia de
--    firma (nuevo parámetro) -> requiere DROP + CREATE, no CREATE OR REPLACE.
-- ============================================================
drop function if exists public.fn_estructura_quitar_cargo_red(uuid, text, text);

create function public.fn_estructura_quitar_cargo_red(
  p_red_id uuid,
  p_codigo text,
  p_otp text default null,
  p_persona_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_iglesia_id uuid;
  v_cargo_id uuid;
  v_cantidad integer;
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  if p_codigo not in ('LIDER_RED', 'SUBLIDER_RED') then
    raise exception 'ESTRUCTURA_CARGO_RED_INVALIDO'
      using errcode = 'P0001';
  end if;

  select r.iglesia_id
  into v_iglesia_id
  from public.red r
  where r.id = p_red_id and r.fecha_eliminacion is null
  for update;

  if v_iglesia_id is null then
    raise exception 'ESTRUCTURA_RED_NO_ENCONTRADA'
      using errcode = 'P0001';
  end if;

  if not private.fn_estructura_puede_administrar_red(v_iglesia_id, p_red_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  perform private.fn_estructura_exigir_otp(v_iglesia_id, p_otp);

  select c.id into v_cargo_id
  from public.cargo c
  where c.codigo = p_codigo
    and c.activo
    and c.fecha_eliminacion is null;

  update public.red_cargo rc
  set fecha_fin = current_date,
      actualizado_por = (select auth.uid())
  where rc.red_id = p_red_id
    and rc.cargo_id = v_cargo_id
    and rc.fecha_fin is null
    and rc.fecha_eliminacion is null
    and (p_persona_id is null or rc.persona_id = p_persona_id);

  get diagnostics v_cantidad = row_count;
  return v_cantidad;
end;
$$;

-- ============================================================
-- 3) public.fn_estructura_invitar_supervisor_red: camino "por correo
--    electrónico". Mismo límite de 2 que el camino "desde base de datos",
--    para que no se pueda invitar un 3ro por correo cuando ya hay 2.
-- ============================================================
create or replace function public.fn_estructura_invitar_supervisor_red(
  p_usuario_id uuid,
  p_correo text,
  p_red_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_iglesia_id uuid;
  v_cargo_id uuid;
  v_invitacion_id uuid;
  v_vigentes_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  select r.iglesia_id
  into v_iglesia_id
  from public.red r
  where r.id = p_red_id
    and r.fecha_eliminacion is null;

  if v_iglesia_id is null then
    raise exception 'ESTRUCTURA_RED_NO_ENCONTRADA'
      using errcode = 'P0001';
  end if;

  if not private.fn_estructura_puede_administrar(v_iglesia_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  select c.id
  into v_cargo_id
  from public.cargo c
  where c.codigo = 'SUBLIDER_RED'
    and c.activo
    and c.fecha_eliminacion is null;

  if v_cargo_id is null then
    raise exception 'ESTRUCTURA_CARGO_RED_NO_DISPONIBLE'
      using errcode = 'P0001';
  end if;

  select count(*)
  into v_vigentes_count
  from public.red_cargo rc
  where rc.red_id = p_red_id
    and rc.cargo_id = v_cargo_id
    and rc.fecha_fin is null
    and rc.fecha_eliminacion is null;

  if v_vigentes_count >= 2 then
    raise exception 'ESTRUCTURA_SUPERVISOR_RED_LIMITE: ya hay 2 Supervisores de Red vigentes en esta Red, quitá uno primero'
      using errcode = 'P0001';
  end if;

  insert into public.usuario_rol (
    usuario_id, rol, iglesia_id, creado_por, actualizado_por
  ) values (
    p_usuario_id, 'LIDER_RED'::public.rol_sistema_enum, v_iglesia_id,
    (select auth.uid()), (select auth.uid())
  );

  insert into public.invitacion_lider (
    usuario_id, correo, iglesia_id, rol, red_id, cargo_id,
    creado_por, actualizado_por
  ) values (
    p_usuario_id, lower(btrim(p_correo)), v_iglesia_id,
    'LIDER_RED'::public.rol_sistema_enum, p_red_id, v_cargo_id,
    (select auth.uid()), (select auth.uid())
  )
  returning id into v_invitacion_id;

  return v_invitacion_id;
end;
$$;

revoke all on function public.fn_estructura_invitar_supervisor_red(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.fn_estructura_invitar_supervisor_red(uuid, text, uuid)
  to authenticated;

-- ============================================================
-- 4) fn_completar_membresia / fn_resolver_invitaciones_pendientes_extra:
--    ramificaban sobre v_inv.rol ('LIDER_RED' para AMBOS Líder y Supervisor
--    de Red -- ver comentario de cabecera). Se agrega la resolución del
--    código real del cargo (v_inv.cargo_id -> cargo.codigo) y se ramifica
--    sobre eso: LIDER_RED sigue cerrando-y-reemplazando; SUBLIDER_RED ahora
--    solo inserta (el límite de 2 ya se garantizó al invitar, punto 3).
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_resolver_invitaciones_pendientes_extra(p_persona_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inv invitacion_lider;
  v_cargo_codigo text;
BEGIN
  FOR v_inv IN
    SELECT * FROM invitacion_lider
    WHERE usuario_id = auth.uid() AND estado = 'PENDIENTE' AND fecha_eliminacion IS NULL
  LOOP
    IF v_inv.rol = 'LIDER_RED' THEN
      SELECT codigo INTO v_cargo_codigo FROM cargo WHERE id = v_inv.cargo_id;

      IF v_cargo_codigo = 'SUBLIDER_RED' THEN
        INSERT INTO red_cargo (iglesia_id, red_id, persona_id, cargo_id, fecha_inicio)
        VALUES (v_inv.iglesia_id, v_inv.red_id, p_persona_id, v_inv.cargo_id, CURRENT_DATE);
      ELSE
        UPDATE red_cargo SET fecha_fin = CURRENT_DATE
        WHERE red_id = v_inv.red_id AND cargo_id = v_inv.cargo_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
        INSERT INTO red_cargo (iglesia_id, red_id, persona_id, cargo_id, fecha_inicio)
        VALUES (v_inv.iglesia_id, v_inv.red_id, p_persona_id, v_inv.cargo_id, CURRENT_DATE);
      END IF;

    ELSIF v_inv.rol = 'LIDER_CDP' THEN
      UPDATE casa_de_paz_cargo SET fecha_fin = CURRENT_DATE
      WHERE casa_de_paz_id = v_inv.casa_de_paz_id AND cargo_id = v_inv.cargo_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
      INSERT INTO casa_de_paz_cargo (iglesia_id, casa_de_paz_id, persona_id, cargo_id, fecha_inicio)
      VALUES (v_inv.iglesia_id, v_inv.casa_de_paz_id, p_persona_id, v_inv.cargo_id, CURRENT_DATE);

    ELSIF v_inv.rol = 'SUBLIDER_CDP' THEN
      INSERT INTO casa_de_paz_cargo (iglesia_id, casa_de_paz_id, persona_id, cargo_id, fecha_inicio)
      VALUES (v_inv.iglesia_id, v_inv.casa_de_paz_id, p_persona_id, v_inv.cargo_id, CURRENT_DATE);
    END IF;

    UPDATE invitacion_lider SET estado = 'COMPLETADA', fecha_completada = now() WHERE id = v_inv.id;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_resolver_invitaciones_pendientes_extra(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_resolver_invitaciones_pendientes_extra(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION fn_completar_membresia(p_datos JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inv invitacion_lider;
  v_persona_id UUID;
  v_cargo_codigo text;
BEGIN
  SELECT * INTO v_inv FROM invitacion_lider
  WHERE usuario_id = auth.uid() AND estado = 'PENDIENTE' AND fecha_eliminacion IS NULL
  ORDER BY fecha_creacion DESC LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEMBRESIA_SIN_INVITACION_PENDIENTE: no hay una invitacion pendiente para completar' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (SELECT 1 FROM persona WHERE usuario_id = auth.uid() AND fecha_eliminacion IS NULL) THEN
    RAISE EXCEPTION 'MEMBRESIA_YA_COMPLETADA: ya existe una persona para este usuario' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO persona (iglesia_id, usuario_id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
                        sexo, fecha_nacimiento, ci, correo, membresia_completada)
  VALUES (v_inv.iglesia_id, auth.uid(), p_datos->>'primer_nombre', p_datos->>'segundo_nombre',
          p_datos->>'primer_apellido', p_datos->>'segundo_apellido',
          (p_datos->>'sexo')::sexo_enum, (p_datos->>'fecha_nacimiento')::date,
          p_datos->>'ci', p_datos->>'correo', true)
  RETURNING id INTO v_persona_id;

  INSERT INTO persona_detalle (persona_id, estado_civil, grado_instruccion, ocupacion, nacimiento_ciudad)
  VALUES (v_persona_id, (p_datos->>'estado_civil')::estado_civil_enum,
          (p_datos->>'grado_instruccion')::grado_instruccion_enum,
          p_datos->>'ocupacion', p_datos->>'nacimiento_ciudad');

  IF v_inv.rol = 'LIDER_RED' THEN
    SELECT codigo INTO v_cargo_codigo FROM cargo WHERE id = v_inv.cargo_id;

    IF v_cargo_codigo = 'SUBLIDER_RED' THEN
      INSERT INTO red_cargo (iglesia_id, red_id, persona_id, cargo_id, fecha_inicio)
      VALUES (v_inv.iglesia_id, v_inv.red_id, v_persona_id, v_inv.cargo_id, CURRENT_DATE);
    ELSE
      UPDATE red_cargo SET fecha_fin = CURRENT_DATE
      WHERE red_id = v_inv.red_id AND cargo_id = v_inv.cargo_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
      INSERT INTO red_cargo (iglesia_id, red_id, persona_id, cargo_id, fecha_inicio)
      VALUES (v_inv.iglesia_id, v_inv.red_id, v_persona_id, v_inv.cargo_id, CURRENT_DATE);
    END IF;

  ELSIF v_inv.rol = 'LIDER_CDP' THEN
    UPDATE casa_de_paz_cargo SET fecha_fin = CURRENT_DATE
    WHERE casa_de_paz_id = v_inv.casa_de_paz_id AND cargo_id = v_inv.cargo_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
    INSERT INTO casa_de_paz_cargo (iglesia_id, casa_de_paz_id, persona_id, cargo_id, fecha_inicio)
    VALUES (v_inv.iglesia_id, v_inv.casa_de_paz_id, v_persona_id, v_inv.cargo_id, CURRENT_DATE);

  ELSIF v_inv.rol = 'SUBLIDER_CDP' THEN
    INSERT INTO casa_de_paz_cargo (iglesia_id, casa_de_paz_id, persona_id, cargo_id, fecha_inicio)
    VALUES (v_inv.iglesia_id, v_inv.casa_de_paz_id, v_persona_id, v_inv.cargo_id, CURRENT_DATE);
  END IF;

  UPDATE invitacion_lider SET estado = 'COMPLETADA', fecha_completada = now() WHERE id = v_inv.id;

  PERFORM fn_resolver_invitaciones_pendientes_extra(v_persona_id);

  RETURN jsonb_build_object(
    'nombre_completo', (SELECT fn_nombre_completo(p) FROM persona p WHERE p.id = v_persona_id),
    'destino', COALESCE((SELECT nombre FROM red WHERE id = v_inv.red_id), fn_etiqueta_cdp(v_inv.casa_de_paz_id))
  );
END;
$$;

commit;
