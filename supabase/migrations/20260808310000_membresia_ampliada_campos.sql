-- VisionHub -- KAN-123/124/125/126: Membresia ampliada.
--
-- Fase A del cluster (ver harness/17-membresia-ampliada/*). Cierra las 8
-- preguntas abiertas de open-questions.md (respuestas completas en los
-- comentarios de Jira de cada ticket, motivo detallado ahi) -- resumen:
--   Q-1 catalogo de discipulados: GLOBAL, sin iglesia_id (mismo patron que
--       motivo_llegada/cargo, 16_rls.sql).
--   Q-2 discipulado repetible: SI, sin indice unico.
--   Q-3 Seminario/Universidad: tablas dedicadas (no generica).
--   Q-4 fecha con precision: anio/mes/dia SMALLINT nullable (no DATE unico),
--       para no obligar a inventar un dia/mes que la persona no recuerda.
--   Q-5 "mentor disponible": sin cargo ni catalogo nuevo -- texto libre +
--       casillero autodeclarado "es miembro" (persona_mentor.mentor_persona_id
--       queda como columna reservada para un vinculo manual futuro desde la
--       ficha de persona, no se llena desde este formulario).
--   Q-6 Conyuge/Familia: se procesa al guardar (transaccional, dentro de las
--       mismas funciones atomicas de alta), reutilizando referencia_familiar
--       ya existente -- mismo criterio que Q-5, texto libre.
--   Q-7 persistencia entre paginas del wizard (KAN-124): cliente
--       (localStorage), sin estado BORRADOR en el servidor.
--   Q-8 KAN-126 alcance: usuario_rol vigente (fecha_eliminacion IS NULL),
--       excluyendo SUPER_ADMIN. red_cargo/casa_de_paz_cargo/departamento_cargo
--       NO se agregan como vector adicional: los tres tienen persona_id NOT
--       NULL en el esquema real (08_estructura.sql/48_funciones_afirmacion.sql),
--       o sea que no pueden existir para un usuario sin persona todavia --
--       usuario_rol ya cubre todo el universo real posible.
--
-- Todo aditivo: tablas/enum/columnas nuevas, sin UPDATE/DELETE de datos
-- existentes. RLS + auditoria + trg_bloquear_delete en cada tabla nueva,
-- mismo patron que el resto del esquema.

begin;

-- ============================================================
-- 1. Enum de precision de fecha (Q-4), reutilizado por Discipulados,
-- Seminario, Universidad y Bautismo.
-- ============================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'precision_fecha_enum') then
    create type public.precision_fecha_enum as enum ('EXACTA', 'APROXIMADA', 'SOLO_MES_ANIO', 'SOLO_ANIO');
  end if;
end $$;

-- ============================================================
-- 2. Catalogo de discipulados (Q-1: global) + seed de los 6 valores del
-- ticket KAN-123. Pertenece conceptualmente al futuro Departamento de
-- Discipulado -- solo el catalogo, no se construye el modulo.
-- ============================================================
create table if not exists public.tipo_discipulado (
  id uuid primary key default gen_random_uuid(),
  codigo varchar(60) not null unique,
  nombre varchar(150) not null,
  orden smallint not null default 0,
  activo boolean not null default true,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz,
  creado_por uuid references auth.users(id),
  actualizado_por uuid references auth.users(id),
  fecha_eliminacion timestamptz,
  eliminado_por uuid references auth.users(id)
);

drop trigger if exists trg_auditoria_tipo_discipulado on public.tipo_discipulado;
create trigger trg_auditoria_tipo_discipulado
  before insert or update on public.tipo_discipulado
  for each row execute function public.fn_auditoria();

drop trigger if exists trg_no_delete_tipo_discipulado on public.tipo_discipulado;
create trigger trg_no_delete_tipo_discipulado
  before delete on public.tipo_discipulado
  for each row execute function public.fn_bloquear_delete();

insert into public.tipo_discipulado (codigo, nombre, orden) values
  ('FUNDAMENTOS_VIDA_REINO', 'Fundamentos de Vida de Reino', 1),
  ('CARACTER_CRISTO_1', 'Carácter de Cristo 1', 2),
  ('CARACTER_CRISTO_2', 'Carácter de Cristo 2', 3),
  ('DISCIPULADO_FAMILIA', 'Discipulado de la Familia', 4),
  ('LIDERES_CASAS_PAZ', 'Líderes de Casas de Paz', 5),
  ('DISCIPULADO_INTEGRAL_DAI', 'Discipulado Integral DAI', 6)
on conflict (codigo) do update set nombre = excluded.nombre, orden = excluded.orden;

alter table public.tipo_discipulado enable row level security;
revoke all on table public.tipo_discipulado from public, anon;
grant select on table public.tipo_discipulado to authenticated;

drop policy if exists pol_tipo_discipulado_select on public.tipo_discipulado;
create policy pol_tipo_discipulado_select on public.tipo_discipulado
  for select to authenticated using (fecha_eliminacion is null);

drop policy if exists pol_tipo_discipulado_insert on public.tipo_discipulado;
create policy pol_tipo_discipulado_insert on public.tipo_discipulado
  for insert to authenticated with check (public.fn_es_super_admin());

drop policy if exists pol_tipo_discipulado_update on public.tipo_discipulado;
create policy pol_tipo_discipulado_update on public.tipo_discipulado
  for update to authenticated using (public.fn_es_super_admin()) with check (public.fn_es_super_admin());

-- Lectura anon-safe (catalogo 100% global, sin datos de iglesia): el
-- registro publico por URL (KAN-125) necesita pintar la lista de
-- discipulados sin sesion.
create or replace function public.fn_listar_tipos_discipulado()
returns table (id uuid, codigo varchar, nombre varchar, orden smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select id, codigo, nombre, orden
  from public.tipo_discipulado
  where activo and fecha_eliminacion is null
  order by orden;
$$;

grant execute on function public.fn_listar_tipos_discipulado() to anon, authenticated;

-- ============================================================
-- 3. persona_discipulado (Q-2: repetible, sin indice unico).
-- ============================================================
create table if not exists public.persona_discipulado (
  id uuid primary key default gen_random_uuid(),
  iglesia_id uuid not null references public.iglesia(id),
  persona_id uuid not null references public.persona(id),
  tipo_discipulado_id uuid not null references public.tipo_discipulado(id),
  anio smallint,
  mes smallint,
  dia smallint,
  precision_fecha public.precision_fecha_enum,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz,
  creado_por uuid references auth.users(id),
  actualizado_por uuid references auth.users(id),
  fecha_eliminacion timestamptz,
  eliminado_por uuid references auth.users(id),
  constraint chk_persona_discipulado_mes check (mes is null or mes between 1 and 12),
  constraint chk_persona_discipulado_dia check (dia is null or dia between 1 and 31),
  constraint chk_persona_discipulado_anio check (anio is null or anio between 1900 and 2100)
);

create index if not exists idx_persona_discipulado_persona
  on public.persona_discipulado (persona_id) where fecha_eliminacion is null;

drop trigger if exists trg_auditoria_persona_discipulado on public.persona_discipulado;
create trigger trg_auditoria_persona_discipulado
  before insert or update on public.persona_discipulado
  for each row execute function public.fn_auditoria();

drop trigger if exists trg_no_delete_persona_discipulado on public.persona_discipulado;
create trigger trg_no_delete_persona_discipulado
  before delete on public.persona_discipulado
  for each row execute function public.fn_bloquear_delete();

-- ============================================================
-- 4. persona_seminario / persona_universidad_rey_jesus (Q-3: tablas
-- dedicadas). Una fila = "si". Ausencia de fila = "no" (mismo criterio de
-- presencia que ya usa mentor/familia mas abajo).
-- ============================================================
create table if not exists public.persona_seminario (
  id uuid primary key default gen_random_uuid(),
  iglesia_id uuid not null references public.iglesia(id),
  persona_id uuid not null references public.persona(id),
  anio smallint,
  mes smallint,
  dia smallint,
  precision_fecha public.precision_fecha_enum,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz,
  creado_por uuid references auth.users(id),
  actualizado_por uuid references auth.users(id),
  fecha_eliminacion timestamptz,
  eliminado_por uuid references auth.users(id),
  constraint chk_persona_seminario_mes check (mes is null or mes between 1 and 12),
  constraint chk_persona_seminario_dia check (dia is null or dia between 1 and 31),
  constraint chk_persona_seminario_anio check (anio is null or anio between 1900 and 2100)
);

create unique index if not exists uq_persona_seminario_persona
  on public.persona_seminario (persona_id) where fecha_eliminacion is null;

drop trigger if exists trg_auditoria_persona_seminario on public.persona_seminario;
create trigger trg_auditoria_persona_seminario
  before insert or update on public.persona_seminario
  for each row execute function public.fn_auditoria();

drop trigger if exists trg_no_delete_persona_seminario on public.persona_seminario;
create trigger trg_no_delete_persona_seminario
  before delete on public.persona_seminario
  for each row execute function public.fn_bloquear_delete();

create table if not exists public.persona_universidad_rey_jesus (
  id uuid primary key default gen_random_uuid(),
  iglesia_id uuid not null references public.iglesia(id),
  persona_id uuid not null references public.persona(id),
  anio smallint,
  mes smallint,
  dia smallint,
  precision_fecha public.precision_fecha_enum,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz,
  creado_por uuid references auth.users(id),
  actualizado_por uuid references auth.users(id),
  fecha_eliminacion timestamptz,
  eliminado_por uuid references auth.users(id),
  constraint chk_persona_universidad_rey_jesus_mes check (mes is null or mes between 1 and 12),
  constraint chk_persona_universidad_rey_jesus_dia check (dia is null or dia between 1 and 31),
  constraint chk_persona_universidad_rey_jesus_anio check (anio is null or anio between 1900 and 2100)
);

create unique index if not exists uq_persona_universidad_rey_jesus_persona
  on public.persona_universidad_rey_jesus (persona_id) where fecha_eliminacion is null;

drop trigger if exists trg_auditoria_persona_universidad_rey_jesus on public.persona_universidad_rey_jesus;
create trigger trg_auditoria_persona_universidad_rey_jesus
  before insert or update on public.persona_universidad_rey_jesus
  for each row execute function public.fn_auditoria();

drop trigger if exists trg_no_delete_persona_universidad_rey_jesus on public.persona_universidad_rey_jesus;
create trigger trg_no_delete_persona_universidad_rey_jesus
  before delete on public.persona_universidad_rey_jesus
  for each row execute function public.fn_bloquear_delete();

-- ============================================================
-- 5. persona_mentor (Q-5: sin cargo/catalogo nuevo). mentor_persona_id
-- queda reservado para un vinculo manual futuro (ficha de persona); este
-- formulario solo escribe mentor_nombre_txt + mentor_es_miembro.
-- ============================================================
create table if not exists public.persona_mentor (
  id uuid primary key default gen_random_uuid(),
  iglesia_id uuid not null references public.iglesia(id),
  persona_id uuid not null references public.persona(id),
  mentor_persona_id uuid references public.persona(id),
  mentor_nombre_txt varchar(200),
  mentor_es_miembro boolean not null default false,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz,
  creado_por uuid references auth.users(id),
  actualizado_por uuid references auth.users(id),
  fecha_eliminacion timestamptz,
  eliminado_por uuid references auth.users(id),
  constraint chk_persona_mentor_identificacion check (
    mentor_persona_id is not null or (mentor_nombre_txt is not null and btrim(mentor_nombre_txt) <> '')
  )
);

create unique index if not exists uq_persona_mentor_persona
  on public.persona_mentor (persona_id) where fecha_eliminacion is null;

drop trigger if exists trg_auditoria_persona_mentor on public.persona_mentor;
create trigger trg_auditoria_persona_mentor
  before insert or update on public.persona_mentor
  for each row execute function public.fn_auditoria();

drop trigger if exists trg_no_delete_persona_mentor on public.persona_mentor;
create trigger trg_no_delete_persona_mentor
  before delete on public.persona_mentor
  for each row execute function public.fn_bloquear_delete();

-- ============================================================
-- 6. Bautismo: columnas en persona_detalle (extension 1:1, no tabla nueva).
-- ============================================================
alter table public.persona_detalle
  add column if not exists bautizado boolean,
  add column if not exists bautizado_en_nuestra_iglesia boolean,
  add column if not exists bautismo_anio smallint,
  add column if not exists bautismo_mes smallint,
  add column if not exists bautismo_dia smallint,
  add column if not exists bautismo_precision_fecha public.precision_fecha_enum;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.persona_detalle'::regclass and conname = 'chk_persona_detalle_bautismo_mes'
  ) then
    alter table public.persona_detalle
      add constraint chk_persona_detalle_bautismo_mes check (bautismo_mes is null or bautismo_mes between 1 and 12);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.persona_detalle'::regclass and conname = 'chk_persona_detalle_bautismo_dia'
  ) then
    alter table public.persona_detalle
      add constraint chk_persona_detalle_bautismo_dia check (bautismo_dia is null or bautismo_dia between 1 and 31);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.persona_detalle'::regclass and conname = 'chk_persona_detalle_bautismo_anio'
  ) then
    alter table public.persona_detalle
      add constraint chk_persona_detalle_bautismo_anio check (bautismo_anio is null or bautismo_anio between 1900 and 2100);
  end if;
end $$;

-- ============================================================
-- 7. Conyuge/Familia (Q-6): reutiliza referencia_familiar (harness/02-persona-parentela,
-- 09_parentela.sql). Se agrega solo el campo "es miembro de la iglesia"
-- autodeclarado -- mismo motivo que persona_mentor.mentor_es_miembro.
-- ============================================================
alter table public.referencia_familiar
  add column if not exists es_miembro_iglesia boolean not null default false;

-- ============================================================
-- 8. RLS de las tablas nuevas por iglesia (mismo patron que familia/
-- ministerio_persona, 27_permisos_estructura.sql): select por iglesia,
-- mutacion por operativo o por la propia persona duena del dato.
-- ============================================================
do $$
declare
  t text;
begin
  foreach t in array array['persona_discipulado', 'persona_seminario', 'persona_universidad_rey_jesus', 'persona_mentor']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon', t);
    execute format('grant select, insert, update on table public.%I to authenticated', t);

    execute format('drop policy if exists pol_%1$s_select on public.%1$I', t);
    execute format(
      'create policy pol_%1$s_select on public.%1$I for select to authenticated using (iglesia_id in (select public.fn_mis_iglesias()) and fecha_eliminacion is null)',
      t
    );

    execute format('drop policy if exists pol_%1$s_insert on public.%1$I', t);
    execute format(
      'create policy pol_%1$s_insert on public.%1$I for insert to authenticated with check (iglesia_id in (select public.fn_mis_iglesias()) and (public.fn_es_operativo_en(iglesia_id) or persona_id = public.fn_mi_persona_id()))',
      t
    );

    execute format('drop policy if exists pol_%1$s_update on public.%1$I', t);
    execute format(
      'create policy pol_%1$s_update on public.%1$I for update to authenticated using (iglesia_id in (select public.fn_mis_iglesias()) and (public.fn_es_operativo_en(iglesia_id) or persona_id = public.fn_mi_persona_id())) with check (iglesia_id in (select public.fn_mis_iglesias()) and (public.fn_es_operativo_en(iglesia_id) or persona_id = public.fn_mi_persona_id()))',
      t
    );
  end loop;
end $$;

-- ============================================================
-- 9. Helper compartido: inserta los campos ampliados de KAN-123 dentro de
-- la misma transaccion atomica que ya usan los 3 flujos de alta (Q-6: se
-- procesa "al guardar", no antes). SECURITY DEFINER, sin GRANT EXECUTE a
-- anon/authenticated a proposito -- solo se llama desde otras funciones
-- SECURITY DEFINER que ya validaron permiso/contexto (misma logica que
-- fn_familia_simetria llamada solo por su propio trigger).
-- ============================================================
create or replace function public.fn_guardar_membresia_extendida(
  p_persona_id uuid,
  p_iglesia_id uuid,
  p_datos jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
end;
$$;

-- ============================================================
-- 10. Enganche: las 3 funciones atomicas de alta llaman al helper de arriba
-- al final, antes del RETURN. Mismo cuerpo que ya existia (19_registro_publico.sql
-- + 21_validaciones_membresia.sql, 42_invitacion_lideres.sql, 49_afirmacion_registro.sql),
-- solo se agrega la llamada -- sin cambios de comportamiento existente.
-- ============================================================

create or replace function public.fn_registrar_persona_via_url(p_slug varchar, p_datos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url public.casa_paz_url;
  v_persona_id uuid;
  v_intentos int;
begin
  select * into v_url from public.casa_paz_url where slug = p_slug and fecha_eliminacion is null;

  if not found or v_url.estado <> 'ACTIVO'
     or not public.fn_config_bool(v_url.iglesia_id, 'REGISTRO_URL_ACTIVO') then
    raise exception 'REGISTRO_URL_NO_DISPONIBLE: el enlace no admite registro en este momento'
      using errcode = 'P0001';
  end if;

  select count(*) into v_intentos from public.persona_llegada
  where casa_paz_url_id = v_url.id and fecha_creacion > now() - interval '10 minutes';
  if v_intentos >= 20 then
    raise exception 'REGISTRO_URL_LIMITE_EXCEDIDO: demasiados registros recientes para este enlace'
      using errcode = 'P0001';
  end if;

  insert into public.persona (iglesia_id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
                        sexo, fecha_nacimiento, ci, correo)
  values (v_url.iglesia_id, p_datos->>'primer_nombre', p_datos->>'segundo_nombre',
          p_datos->>'primer_apellido', p_datos->>'segundo_apellido',
          (p_datos->>'sexo')::public.sexo_enum, (p_datos->>'fecha_nacimiento')::date,
          p_datos->>'ci', p_datos->>'correo')
  returning id into v_persona_id;

  insert into public.persona_detalle (persona_id, estado_civil, grado_instruccion, ocupacion, nacimiento_ciudad)
  values (v_persona_id, (p_datos->>'estado_civil')::public.estado_civil_enum,
          (p_datos->>'grado_instruccion')::public.grado_instruccion_enum,
          p_datos->>'ocupacion', p_datos->>'nacimiento_ciudad');

  insert into public.persona_llegada (iglesia_id, persona_id, motivo_llegada_id, fecha_ingreso,
                                invitado_por_id, casa_paz_url_id)
  values (v_url.iglesia_id, v_persona_id,
          (select id from public.motivo_llegada where codigo = 'INVITACION_PERSONAL'),
          current_date, v_url.persona_id, v_url.id);

  insert into public.casa_de_paz_membresia (iglesia_id, casa_de_paz_id, persona_id, es_principal, fecha_inicio)
  values (v_url.iglesia_id, v_url.casa_de_paz_id, v_persona_id, true, current_date);

  -- KAN-123: campos ampliados (Discipulados/Seminario/Universidad/Mentor/
  -- Bautismo/Familia). Ministerios queda fuera del flujo publico anonimo a
  -- proposito (no hay forma anon-safe de listar ministerios de la iglesia
  -- sin sesion todavia) -- p_datos->'ministerios' simplemente se ignora si
  -- el frontend publico no lo manda.
  perform public.fn_guardar_membresia_extendida(v_persona_id, v_url.iglesia_id, p_datos);

  return jsonb_build_object(
    'nombre_completo', (select public.fn_nombre_completo(p) from public.persona p where p.id = v_persona_id),
    'casa_de_paz_nombre', (select nombre from public.casa_de_paz where id = v_url.casa_de_paz_id)
  );
end;
$$;

grant execute on function public.fn_registrar_persona_via_url(varchar, jsonb) to anon, authenticated;

create or replace function public.fn_completar_membresia(p_datos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invitacion_lider;
  v_persona_id uuid;
begin
  select * into v_inv from public.invitacion_lider
  where usuario_id = auth.uid() and estado = 'PENDIENTE' and fecha_eliminacion is null
  order by fecha_creacion desc limit 1;

  if not found then
    raise exception 'MEMBRESIA_SIN_INVITACION_PENDIENTE: no hay una invitacion pendiente para completar' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.persona where usuario_id = auth.uid() and fecha_eliminacion is null) then
    raise exception 'MEMBRESIA_YA_COMPLETADA: ya existe una persona para este usuario' using errcode = 'P0001';
  end if;

  insert into public.persona (iglesia_id, usuario_id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
                        sexo, fecha_nacimiento, ci, correo)
  values (v_inv.iglesia_id, auth.uid(), p_datos->>'primer_nombre', p_datos->>'segundo_nombre',
          p_datos->>'primer_apellido', p_datos->>'segundo_apellido',
          (p_datos->>'sexo')::public.sexo_enum, (p_datos->>'fecha_nacimiento')::date,
          p_datos->>'ci', p_datos->>'correo')
  returning id into v_persona_id;

  insert into public.persona_detalle (persona_id, estado_civil, grado_instruccion, ocupacion, nacimiento_ciudad)
  values (v_persona_id, (p_datos->>'estado_civil')::public.estado_civil_enum,
          (p_datos->>'grado_instruccion')::public.grado_instruccion_enum,
          p_datos->>'ocupacion', p_datos->>'nacimiento_ciudad');

  if v_inv.rol = 'LIDER_RED' then
    update public.red_cargo set fecha_fin = current_date
    where red_id = v_inv.red_id and cargo_id = v_inv.cargo_id and fecha_fin is null and fecha_eliminacion is null;
    insert into public.red_cargo (iglesia_id, red_id, persona_id, cargo_id, fecha_inicio)
    values (v_inv.iglesia_id, v_inv.red_id, v_persona_id, v_inv.cargo_id, current_date);

  elsif v_inv.rol = 'LIDER_CDP' then
    update public.casa_de_paz_cargo set fecha_fin = current_date
    where casa_de_paz_id = v_inv.casa_de_paz_id and cargo_id = v_inv.cargo_id and fecha_fin is null and fecha_eliminacion is null;
    insert into public.casa_de_paz_cargo (iglesia_id, casa_de_paz_id, persona_id, cargo_id, fecha_inicio)
    values (v_inv.iglesia_id, v_inv.casa_de_paz_id, v_persona_id, v_inv.cargo_id, current_date);

  elsif v_inv.rol = 'SUBLIDER_CDP' then
    insert into public.casa_de_paz_cargo (iglesia_id, casa_de_paz_id, persona_id, cargo_id, fecha_inicio)
    values (v_inv.iglesia_id, v_inv.casa_de_paz_id, v_persona_id, v_inv.cargo_id, current_date);
  end if;

  update public.invitacion_lider set estado = 'COMPLETADA', fecha_completada = now() where id = v_inv.id;

  -- KAN-123: campos ampliados, incluye Ministerios (flujo autenticado, iglesia
  -- ya resuelta -- distinto del publico anonimo de arriba).
  perform public.fn_guardar_membresia_extendida(v_persona_id, v_inv.iglesia_id, p_datos);

  return jsonb_build_object(
    'nombre_completo', (select public.fn_nombre_completo(p) from public.persona p where p.id = v_persona_id),
    'destino', coalesce((select nombre from public.red where id = v_inv.red_id), public.fn_etiqueta_cdp(v_inv.casa_de_paz_id))
  );
end;
$$;

grant execute on function public.fn_completar_membresia(jsonb) to authenticated;

create or replace function public.fn_registrar_persona_afirmacion(p_datos jsonb, p_casa_de_paz_cargo_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cargo        public.casa_de_paz_cargo;
  v_iglesia_id   uuid;
  v_persona_id   uuid;
begin
  select cc.* into v_cargo
  from public.casa_de_paz_cargo cc
  join public.cargo c on c.id = cc.cargo_id
  join public.casa_de_paz cdp on cdp.id = cc.casa_de_paz_id
  where cc.id = p_casa_de_paz_cargo_id
    and c.codigo = 'LIDER_CDP'
    and cc.fecha_fin is null and cc.fecha_eliminacion is null
    and cdp.activo and cdp.fecha_eliminacion is null;

  if not found then
    raise exception 'AFIRMACION_LIDER_CDP_INVALIDO: el lider de casa de paz elegido no tiene un cargo vigente'
      using errcode = 'P0001';
  end if;

  v_iglesia_id := v_cargo.iglesia_id;

  if not public.fn_es_lider_afirmacion_en(v_iglesia_id) then
    raise exception 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      using errcode = 'P0001';
  end if;

  insert into public.persona (iglesia_id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
                        sexo, fecha_nacimiento, ci, correo)
  values (v_iglesia_id, p_datos->>'primer_nombre', p_datos->>'segundo_nombre',
          p_datos->>'primer_apellido', p_datos->>'segundo_apellido',
          (p_datos->>'sexo')::public.sexo_enum, (p_datos->>'fecha_nacimiento')::date,
          p_datos->>'ci', p_datos->>'correo')
  returning id into v_persona_id;

  insert into public.persona_detalle (persona_id, estado_civil, grado_instruccion, ocupacion, nacimiento_ciudad)
  values (v_persona_id, (p_datos->>'estado_civil')::public.estado_civil_enum,
          (p_datos->>'grado_instruccion')::public.grado_instruccion_enum,
          p_datos->>'ocupacion', p_datos->>'nacimiento_ciudad');

  insert into public.persona_llegada (iglesia_id, persona_id, motivo_llegada_id, fecha_ingreso, invitado_por_id)
  values (v_iglesia_id, v_persona_id,
          (select id from public.motivo_llegada where codigo = 'INVITACION_PERSONAL'),
          current_date, v_cargo.persona_id);

  insert into public.casa_de_paz_membresia (iglesia_id, casa_de_paz_id, persona_id, es_principal, fecha_inicio)
  values (v_iglesia_id, v_cargo.casa_de_paz_id, v_persona_id, true, current_date);

  -- KAN-123: campos ampliados, incluye Ministerios.
  perform public.fn_guardar_membresia_extendida(v_persona_id, v_iglesia_id, p_datos);

  return jsonb_build_object(
    'persona_id', v_persona_id,
    'nombre_completo', (select public.fn_nombre_completo(p) from public.persona p where p.id = v_persona_id),
    'casa_de_paz_nombre', public.fn_etiqueta_cdp(v_cargo.casa_de_paz_id)
  );
end;
$$;

grant execute on function public.fn_registrar_persona_afirmacion(jsonb, uuid) to authenticated;

-- ============================================================
-- 11. KAN-126 (Fase D del plan, solo capa de datos -- ver nota mas abajo
-- sobre por que no se engancha en PrivateLayout.tsx todavia). Generaliza
-- fn_mi_invitacion_pendiente (42_invitacion_lideres.sql) al caso de
-- cualquier usuario_rol vigente sin Persona, sin importar si vino por
-- invitacion (Q-8).
-- ============================================================
create or replace function public.fn_mi_membresia_incompleta()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_invitacion jsonb;
  r record;
begin
  -- Caso ya resuelto (invitacion_lider/invitacion_departamento): no se toca.
  v_invitacion := public.fn_mi_invitacion_pendiente();
  if v_invitacion is not null then
    return v_invitacion;
  end if;

  if exists (select 1 from public.persona where usuario_id = auth.uid() and fecha_eliminacion is null) then
    return null;
  end if;

  -- Q-8: usuario_rol vigente, excluyendo SUPER_ADMIN (rol tecnico sin
  -- Persona por diseno). red_cargo/casa_de_paz_cargo/departamento_cargo no
  -- se consultan aca: los tres exigen persona_id NOT NULL en el esquema
  -- real, por lo que no pueden existir todavia para alguien sin Persona.
  select ur.rol, i.nombre as iglesia_nombre, ur.iglesia_id
  into r
  from public.usuario_rol ur
  join public.iglesia i on i.id = ur.iglesia_id
  where ur.usuario_id = auth.uid()
    and ur.rol <> 'SUPER_ADMIN'
    and ur.fecha_eliminacion is null
  order by ur.fecha_creacion asc
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', null,
    'rol', r.rol,
    'iglesia_nombre', r.iglesia_nombre,
    'destino', null,
    'campos_obligatorios', jsonb_build_object(
      'ci', public.fn_config_bool(r.iglesia_id, 'MEMBRESIA_CI_OBLIGATORIO'),
      'fecha_nacimiento', public.fn_config_bool(r.iglesia_id, 'MEMBRESIA_FECHA_NACIMIENTO_OBLIGATORIO'),
      'ocupacion', public.fn_config_bool(r.iglesia_id, 'MEMBRESIA_OCUPACION_OBLIGATORIO'),
      'grado_instruccion', public.fn_config_bool(r.iglesia_id, 'MEMBRESIA_GRADO_INSTRUCCION_OBLIGATORIO')
    )
  );
end;
$$;

grant execute on function public.fn_mi_membresia_incompleta() to authenticated;

commit;

-- Reversion manual, solo antes de que existan datos funcionales:
-- drop function public.fn_mi_membresia_incompleta();
-- drop function public.fn_guardar_membresia_extendida(uuid, uuid, jsonb);
-- drop function public.fn_listar_tipos_discipulado();
-- alter table public.referencia_familiar drop column es_miembro_iglesia;
-- alter table public.persona_detalle drop column bautizado, drop column bautizado_en_nuestra_iglesia,
--   drop column bautismo_anio, drop column bautismo_mes, drop column bautismo_dia, drop column bautismo_precision_fecha;
-- drop table public.persona_mentor;
-- drop table public.persona_universidad_rey_jesus;
-- drop table public.persona_seminario;
-- drop table public.persona_discipulado;
-- drop table public.tipo_discipulado;
-- drop type public.precision_fecha_enum;
