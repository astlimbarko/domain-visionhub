-- VisionHub -- KAN-251, punto 3/4 (2026-09-17): el Pastor/Supervisor de la
-- iglesia madre puede LEER la estructura (iglesia, redes, CdP, departamentos,
-- personas) de su satélite vigente -- decisión del owner confirmada: reusar
-- el Constructor existente (no un panel nuevo aparte), navegando a
-- /constructor/<id_satelite> tal cual ya hace con su propia iglesia.
--
-- Alcance explícito de esta relajación: SOLO lectura de estructura
-- (iglesia/red/casa_de_paz/departamento/persona). NO se toca finanzas ni
-- reportes -- esas tablas siguen exactamente igual que antes, según lo
-- acordado.
--
-- Helper nuevo, reusa fn_son_madre_satelite_vigente (migración 20260917130000):
CREATE OR REPLACE FUNCTION public.fn_es_operativo_en_o_par_satelite(p_iglesia_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT fn_es_pastor_en(p_iglesia_id) OR fn_es_operativo_en(p_iglesia_id)
    OR EXISTS (
      SELECT 1 FROM iglesia x
      WHERE fn_son_madre_satelite_vigente(p_iglesia_id, x.id)
        AND (fn_es_pastor_en(x.id) OR fn_es_operativo_en(x.id))
    );
$function$;

-- fn_puede_ver_cdp / fn_puede_ver_red: agregar el mismo escape, sin tocar
-- ninguna otra rama existente.
CREATE OR REPLACE FUNCTION public.fn_puede_ver_cdp(p_casa_de_paz_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.casa_de_paz cdp
    where cdp.id = p_casa_de_paz_id
      and (
        public.fn_es_super_admin()
        or public.fn_es_pastor_en(cdp.iglesia_id)
        or public.fn_es_operativo_en(cdp.iglesia_id)
        or public.fn_es_lider_departamento(cdp.iglesia_id, 'EVANGELISMO')
        or public.fn_es_lider_cdp(cdp.id)
        or public.fn_es_sublider_cdp(cdp.id)
        or exists (
          select 1
          from public.casa_de_paz_red cdr
          where cdr.casa_de_paz_id = cdp.id
            and cdr.fecha_fin is null
            and cdr.fecha_eliminacion is null
            and public.fn_es_lider_de_red(cdr.red_id)
        )
        or public.fn_es_operativo_en_o_par_satelite(cdp.iglesia_id)
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.fn_puede_ver_red(p_red_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.red r
    where r.id = p_red_id
      and (
        public.fn_es_super_admin()
        or public.fn_es_pastor_en(r.iglesia_id)
        or public.fn_es_operativo_en(r.iglesia_id)
        or public.fn_es_lider_departamento(r.iglesia_id, 'EVANGELISMO')
        or public.fn_es_lider_de_red(r.id)
        or exists (
          select 1
          from public.casa_de_paz_red cdr
          join public.casa_de_paz_cargo cc
            on cc.casa_de_paz_id = cdr.casa_de_paz_id
          join public.cargo ca on ca.id = cc.cargo_id
          where cdr.red_id = r.id
            and cdr.fecha_fin is null
            and cdr.fecha_eliminacion is null
            and cc.persona_id = public.fn_mi_persona_id()
            and ca.codigo in ('LIDER_CDP', 'SUBLIDER_CDP')
            and cc.fecha_fin is null
            and cc.fecha_eliminacion is null
        )
        or public.fn_es_operativo_en_o_par_satelite(r.iglesia_id)
      )
  );
$function$;

-- iglesia / departamento / persona: mismo patrón "iglesia_id IN fn_mis_iglesias()"
-- directo en la RLS -- se agrega el escape ahí mismo.
DROP POLICY IF EXISTS pol_iglesia_select ON iglesia;
CREATE POLICY pol_iglesia_select ON iglesia FOR SELECT TO authenticated USING (
  (id IN (SELECT fn_mis_iglesias()) OR fn_es_operativo_en_o_par_satelite(id))
  AND fecha_eliminacion IS NULL
);

DROP POLICY IF EXISTS pol_departamento_select ON departamento;
CREATE POLICY pol_departamento_select ON departamento FOR SELECT TO authenticated USING (
  (iglesia_id IN (SELECT fn_mis_iglesias()) OR fn_es_operativo_en_o_par_satelite(iglesia_id))
  AND fecha_eliminacion IS NULL
);

DROP POLICY IF EXISTS pol_persona_select ON persona;
CREATE POLICY pol_persona_select ON persona FOR SELECT TO authenticated USING (
  (iglesia_id IN (SELECT fn_mis_iglesias()) OR fn_es_operativo_en_o_par_satelite(iglesia_id))
  AND fecha_eliminacion IS NULL
);
