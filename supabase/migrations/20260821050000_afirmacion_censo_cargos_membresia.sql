-- VisionHub -- KAN-217 (plan panel Afirmacion, punto 4/4): censo de cargos
-- en el formulario de membresia (Efesio, Ministro/Anciano/Diacono/Mentor/Sub
-- mentor/Lider-Sublider CdPz, Discipulo/Afirmado/Creyente).
--
-- Puramente informativo/autodeclarado -- NUNCA toca persona_cargo,
-- casa_de_paz_cargo, red_cargo ni departamento_cargo (las tablas operativas
-- reales, con sus propias reglas de exclusividad -- un solo Tipo A vigente
-- por persona, cargos ministeriales solo los asigna el Pastor -- y permisos
-- -- Lider de CdP dispara la creacion de una URL publica real). Mezclar
-- esto con esas tablas hubiera sido peligroso: alguien autodeclarandose
-- "Lider de CdP" en un censo no puede terminar creando una URL de registro
-- real ni bloqueado por la regla de "un solo cargo Tipo A vigente".
--
-- formulario_version ('v1' por ahora): el owner anticipo que la pregunta de
-- rango_miembro (Discipulo/Afirmado/Creyente) es temporal -- el dia que el
-- sistema tenga datos reales de discipulado/bautismo para consultar en vez
-- de autodeclarar, una version futura del formulario puede dejar de
-- preguntarla. Esta columna permite distinguir que datos vinieron de que
-- version sin ambiguedad.

CREATE TABLE persona_censo_membresia (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id            UUID NOT NULL REFERENCES iglesia(id),
  persona_id            UUID NOT NULL UNIQUE REFERENCES persona(id),
  efesio_tipo           VARCHAR,
  cargo_ministro        BOOLEAN NOT NULL DEFAULT false,
  cargo_anciano         BOOLEAN NOT NULL DEFAULT false,
  cargo_diacono         BOOLEAN NOT NULL DEFAULT false,
  cargo_mentor          BOOLEAN NOT NULL DEFAULT false,
  cargo_sub_mentor      BOOLEAN NOT NULL DEFAULT false,
  cargo_lider_cdp       BOOLEAN NOT NULL DEFAULT false,
  cargo_sublider_cdp    BOOLEAN NOT NULL DEFAULT false,
  rango_miembro         VARCHAR,
  formulario_version    VARCHAR NOT NULL DEFAULT 'v1',
  fecha_creacion        TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion   TIMESTAMPTZ,
  creado_por            UUID REFERENCES auth.users(id),
  actualizado_por       UUID REFERENCES auth.users(id),
  fecha_eliminacion     TIMESTAMPTZ,
  eliminado_por         UUID REFERENCES auth.users(id),
  CONSTRAINT chk_censo_efesio CHECK (efesio_tipo IS NULL OR efesio_tipo IN ('APOSTOL','PROFETA','PASTOR','EVANGELISTA','MAESTRO')),
  CONSTRAINT chk_censo_rango CHECK (rango_miembro IS NULL OR rango_miembro IN ('DISCIPULO','AFIRMADO','CREYENTE'))
);

CREATE INDEX idx_persona_censo_membresia_iglesia ON persona_censo_membresia (iglesia_id) WHERE fecha_eliminacion IS NULL;

CREATE TRIGGER trg_auditoria_persona_censo_membresia BEFORE INSERT OR UPDATE ON persona_censo_membresia
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_persona_censo_membresia BEFORE DELETE ON persona_censo_membresia
  FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

ALTER TABLE persona_censo_membresia ENABLE ROW LEVEL SECURITY;

-- Mismo patron que persona_mentor/persona_seminario: la escritura real pasa
-- por fn_guardar_membresia_extendida (SECURITY DEFINER, ya usada por los 3
-- flujos de alta -- URL publica, Afirmacion interno, MembresiaObligatoria
-- general). Las policies de INSERT/UPDATE para `authenticated` existen para
-- consistencia con el resto del esquema, no para un camino de escritura
-- directo desde el frontend.
CREATE POLICY pol_persona_censo_membresia_select ON persona_censo_membresia FOR SELECT TO authenticated
  USING (iglesia_id IN (SELECT fn_mis_iglesias()) AND fecha_eliminacion IS NULL);

CREATE POLICY pol_persona_censo_membresia_insert ON persona_censo_membresia FOR INSERT TO authenticated
  WITH CHECK (iglesia_id IN (SELECT fn_mis_iglesias()) AND (fn_es_operativo_en(iglesia_id) OR persona_id = fn_mi_persona_id()));

CREATE POLICY pol_persona_censo_membresia_update ON persona_censo_membresia FOR UPDATE TO authenticated
  USING (iglesia_id IN (SELECT fn_mis_iglesias()) AND (fn_es_operativo_en(iglesia_id) OR persona_id = fn_mi_persona_id()))
  WITH CHECK (iglesia_id IN (SELECT fn_mis_iglesias()) AND (fn_es_operativo_en(iglesia_id) OR persona_id = fn_mi_persona_id()));

-- fn_guardar_membresia_extendida: agrega el bloque de censo al final,
-- mismo patron "insert...on conflict do update" que persona_seminario/
-- persona_universidad_rey_jesus (upsert por persona_id). Se ejecuta solo si
-- p_datos trae alguna clave del censo (evita filas vacias para los 3 flujos
-- que no las manden nunca en el futuro).
CREATE OR REPLACE FUNCTION public.fn_guardar_membresia_extendida(p_persona_id uuid, p_iglesia_id uuid, p_datos jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
declare
  v_item jsonb;
  v_tipo_relacion_id uuid;
begin
  if p_datos is null then
    return;
  end if;

  -- Bautismo
  if p_datos ? 'bautizado' then
    update public.persona_detalle set
      bautizado = nullif(p_datos->>'bautizado', '')::boolean,
      bautizado_en_nuestra_iglesia = nullif(p_datos->>'bautizado_en_nuestra_iglesia', '')::boolean,
      bautismo_anio = nullif(p_datos->>'bautismo_anio', '')::smallint,
      bautismo_mes = nullif(p_datos->>'bautismo_mes', '')::smallint,
      bautismo_dia = nullif(p_datos->>'bautismo_dia', '')::smallint,
      bautismo_precision_fecha = nullif(p_datos->>'bautismo_precision_fecha', '')::public.precision_fecha_enum
    where persona_id = p_persona_id;
  end if;

  -- Discipulados (0..N, repetible -- Q-2)
  if p_datos ? 'discipulados' and jsonb_typeof(p_datos->'discipulados') = 'array' then
    for v_item in select value from jsonb_array_elements(p_datos->'discipulados')
    loop
      if v_item ->> 'tipo_discipulado_id' is not null then
        insert into public.persona_discipulado
          (iglesia_id, persona_id, tipo_discipulado_id, anio, mes, dia, precision_fecha)
        values (
          p_iglesia_id, p_persona_id, (v_item->>'tipo_discipulado_id')::uuid,
          nullif(v_item->>'anio', '')::smallint,
          nullif(v_item->>'mes', '')::smallint,
          nullif(v_item->>'dia', '')::smallint,
          nullif(v_item->>'precision_fecha', '')::public.precision_fecha_enum
        );
      end if;
    end loop;
  end if;

  -- Seminario (una fila = "si")
  if coalesce((p_datos->>'seminario')::boolean, false) then
    insert into public.persona_seminario (iglesia_id, persona_id, anio, mes, dia, precision_fecha)
    values (
      p_iglesia_id, p_persona_id,
      nullif(p_datos->>'seminario_anio', '')::smallint,
      nullif(p_datos->>'seminario_mes', '')::smallint,
      nullif(p_datos->>'seminario_dia', '')::smallint,
      nullif(p_datos->>'seminario_precision_fecha', '')::public.precision_fecha_enum
    )
    on conflict (persona_id) where fecha_eliminacion is null do nothing;
  end if;

  -- Universidad del Rey Jesus (mismo patron)
  if coalesce((p_datos->>'universidad')::boolean, false) then
    insert into public.persona_universidad_rey_jesus (iglesia_id, persona_id, anio, mes, dia, precision_fecha)
    values (
      p_iglesia_id, p_persona_id,
      nullif(p_datos->>'universidad_anio', '')::smallint,
      nullif(p_datos->>'universidad_mes', '')::smallint,
      nullif(p_datos->>'universidad_dia', '')::smallint,
      nullif(p_datos->>'universidad_precision_fecha', '')::public.precision_fecha_enum
    )
    on conflict (persona_id) where fecha_eliminacion is null do nothing;
  end if;

  -- Mentor (Q-5: texto libre + es-miembro autodeclarado)
  if coalesce((p_datos->>'mentor')::boolean, false)
     and p_datos->>'mentor_nombre_txt' is not null
     and btrim(p_datos->>'mentor_nombre_txt') <> '' then
    insert into public.persona_mentor (iglesia_id, persona_id, mentor_nombre_txt, mentor_es_miembro)
    values (
      p_iglesia_id, p_persona_id, btrim(p_datos->>'mentor_nombre_txt'),
      coalesce((p_datos->>'mentor_es_miembro')::boolean, false)
    )
    on conflict (persona_id) where fecha_eliminacion is null do nothing;
  end if;

  -- Ministerios (multiple, ministerio_persona ya soporta esto -- solo UI nueva)
  if p_datos ? 'ministerios' and jsonb_typeof(p_datos->'ministerios') = 'array' then
    for v_item in select value from jsonb_array_elements(p_datos->'ministerios')
    loop
      if jsonb_typeof(v_item) = 'string' and (v_item #>> '{}') is not null then
        insert into public.ministerio_persona (iglesia_id, ministerio_id, persona_id, fecha_inicio)
        values (p_iglesia_id, (v_item #>> '{}')::uuid, p_persona_id, current_date);
      end if;
    end loop;
  end if;

  -- Conyuge/Familia (Q-6: se procesa aca, texto libre -- referencia_familiar)
  if p_datos ? 'familiares' and jsonb_typeof(p_datos->'familiares') = 'array' then
    for v_item in select value from jsonb_array_elements(p_datos->'familiares')
    loop
      if v_item ->> 'nombre_familiar' is not null and btrim(v_item->>'nombre_familiar') <> '' then
        select id into v_tipo_relacion_id from public.tipo_relacion
        where codigo = upper(v_item->>'tipo_relacion_codigo') and fecha_eliminacion is null;

        if v_tipo_relacion_id is not null then
          insert into public.referencia_familiar
            (iglesia_id, persona_id, nombre_familiar, tipo_relacion_id, es_miembro_iglesia)
          values (
            p_iglesia_id, p_persona_id, btrim(v_item->>'nombre_familiar'), v_tipo_relacion_id,
            coalesce((v_item->>'es_miembro')::boolean, false)
          );
        end if;
      end if;
    end loop;
  end if;

  -- KAN-217: censo de cargos (Efesio + otros cargos + rango de miembro).
  if p_datos ?| array['efesio_tipo', 'cargo_ministro', 'cargo_anciano', 'cargo_diacono',
                       'cargo_mentor', 'cargo_sub_mentor', 'cargo_lider_cdp', 'cargo_sublider_cdp',
                       'rango_miembro'] then
    insert into public.persona_censo_membresia
      (iglesia_id, persona_id, efesio_tipo, cargo_ministro, cargo_anciano, cargo_diacono,
       cargo_mentor, cargo_sub_mentor, cargo_lider_cdp, cargo_sublider_cdp, rango_miembro)
    values (
      p_iglesia_id, p_persona_id, nullif(p_datos->>'efesio_tipo', ''),
      coalesce((p_datos->>'cargo_ministro')::boolean, false),
      coalesce((p_datos->>'cargo_anciano')::boolean, false),
      coalesce((p_datos->>'cargo_diacono')::boolean, false),
      coalesce((p_datos->>'cargo_mentor')::boolean, false),
      coalesce((p_datos->>'cargo_sub_mentor')::boolean, false),
      coalesce((p_datos->>'cargo_lider_cdp')::boolean, false),
      coalesce((p_datos->>'cargo_sublider_cdp')::boolean, false),
      nullif(p_datos->>'rango_miembro', '')
    )
    on conflict (persona_id) do update set
      efesio_tipo = excluded.efesio_tipo,
      cargo_ministro = excluded.cargo_ministro,
      cargo_anciano = excluded.cargo_anciano,
      cargo_diacono = excluded.cargo_diacono,
      cargo_mentor = excluded.cargo_mentor,
      cargo_sub_mentor = excluded.cargo_sub_mentor,
      cargo_lider_cdp = excluded.cargo_lider_cdp,
      cargo_sublider_cdp = excluded.cargo_sublider_cdp,
      rango_miembro = excluded.rango_miembro;
  end if;
end;
$function$;
