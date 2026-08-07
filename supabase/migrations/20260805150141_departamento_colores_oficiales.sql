-- VisionHub — Colores oficiales de Departamento (Supabase remoto)
-- Aditiva e idempotente: conserva entidades, líderes y permisos existentes.

begin;

alter table public.departamento
  add column if not exists color_nombre text,
  add column if not exists color text;

update public.departamento
set
  color_nombre = case upper(codigo)
    when 'EVANGELISMO' then 'Amarillo'
    when 'AFIRMACION' then 'Azul'
    when 'DISCIPULADO' then 'Rojo'
    when 'ENVIO' then 'Gris'
  end,
  color = case upper(codigo)
    when 'EVANGELISMO' then '#F5C518'
    when 'AFIRMACION' then '#0071E3'
    when 'DISCIPULADO' then '#FF3B30'
    when 'ENVIO' then '#8E8E93'
  end
where upper(codigo) in ('EVANGELISMO', 'AFIRMACION', 'DISCIPULADO', 'ENVIO')
  and (
    color_nombre is distinct from case upper(codigo)
      when 'EVANGELISMO' then 'Amarillo'
      when 'AFIRMACION' then 'Azul'
      when 'DISCIPULADO' then 'Rojo'
      when 'ENVIO' then 'Gris'
    end
    or color is distinct from case upper(codigo)
      when 'EVANGELISMO' then '#F5C518'
      when 'AFIRMACION' then '#0071E3'
      when 'DISCIPULADO' then '#FF3B30'
      when 'ENVIO' then '#8E8E93'
    end
  );

alter table public.departamento
  alter column color_nombre set not null,
  alter column color set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.departamento'::regclass
      and conname = 'chk_departamento_color_nombre'
  ) then
    alter table public.departamento
      add constraint chk_departamento_color_nombre
      check (btrim(color_nombre) <> '');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.departamento'::regclass
      and conname = 'chk_departamento_color'
  ) then
    alter table public.departamento
      add constraint chk_departamento_color
      check (color ~ '^#[0-9A-Fa-f]{6}$');
  end if;
end
$$;

comment on column public.departamento.color_nombre is
  'Nombre legible del color institucional del Departamento.';
comment on column public.departamento.color is
  'Código hexadecimal #RRGGBB del color institucional del Departamento.';

commit;
