-- Fix (2026-10-03): un COLABORADOR temporal de Afirmación (KAN-405) podía abrir
-- Altar/Bautismo/RSIL/Membresía (fn_puede_gestionar_afirmacion incluye
-- fn_es_colaborador_activo_en(...,'AFIRMACION')) pero NO podía guardar: el alta
-- "Nuevo" escribe con inserts directos a persona/telefono/direccion, y la RLS de
-- INSERT de esas tablas exige iglesia_id IN (fn_mis_iglesias()), que NO incluye a
-- los colaboradores. Resultado: "No se pudo crear la persona" (42501) para un
-- colaborador puro (sin persona/rol propio en esa iglesia) en CUALQUIER iglesia.
-- Afectados reales: mirnamercado467@gmail.com, damaris.salazarm@gmail.com (4 Anillo).
--
-- Fix: extender INSERT y SELECT (el frontend hace readback .select() tras insertar)
-- de las 5 tablas para aceptar también a un colaborador activo de AFIRMACION en esa
-- iglesia. Se preservan las condiciones extra de cada SELECT. (La solución más
-- limpia a futuro es que esas 4 pantallas usen una RPC SECURITY DEFINER única en
-- vez de inserts directos -- queda como mejora en ticket aparte.)

-- ── INSERT (with_check) ──────────────────────────────────────────────────────
ALTER POLICY pol_persona_insert ON public.persona
  WITH CHECK (iglesia_id IN (SELECT fn_mis_iglesias()) OR fn_es_colaborador_activo_en(iglesia_id, 'AFIRMACION'));

ALTER POLICY pol_telefono_insert ON public.telefono
  WITH CHECK (iglesia_id IN (SELECT fn_mis_iglesias()) OR fn_es_colaborador_activo_en(iglesia_id, 'AFIRMACION'));

ALTER POLICY pol_telefono_asignacion_insert ON public.telefono_asignacion
  WITH CHECK (iglesia_id IN (SELECT fn_mis_iglesias()) OR fn_es_colaborador_activo_en(iglesia_id, 'AFIRMACION'));

ALTER POLICY pol_direccion_insert ON public.direccion
  WITH CHECK (iglesia_id IN (SELECT fn_mis_iglesias()) OR fn_es_colaborador_activo_en(iglesia_id, 'AFIRMACION'));

ALTER POLICY pol_direccion_asignacion_insert ON public.direccion_asignacion
  WITH CHECK (iglesia_id IN (SELECT fn_mis_iglesias()) OR fn_es_colaborador_activo_en(iglesia_id, 'AFIRMACION'));

-- ── SELECT (using) -- se preservan las condiciones extra existentes ──────────
ALTER POLICY pol_persona_select ON public.persona
  USING (
    (iglesia_id IN (SELECT fn_mis_iglesias())
     OR fn_es_operativo_en_o_par_satelite(iglesia_id)
     OR fn_es_colaborador_activo_en(iglesia_id, 'AFIRMACION'))
    AND fecha_eliminacion IS NULL
  );

ALTER POLICY pol_telefono_select ON public.telefono
  USING (
    (iglesia_id IN (SELECT fn_mis_iglesias()) OR fn_es_colaborador_activo_en(iglesia_id, 'AFIRMACION'))
    AND fecha_eliminacion IS NULL
  );

ALTER POLICY pol_telefono_asignacion_select ON public.telefono_asignacion
  USING (
    (iglesia_id IN (SELECT fn_mis_iglesias()) OR fn_es_colaborador_activo_en(iglesia_id, 'AFIRMACION'))
    AND fecha_eliminacion IS NULL
    AND (persona_id IS NULL OR fn_puede_ver_confidencial(persona_id))
  );

ALTER POLICY pol_direccion_select ON public.direccion
  USING (
    (iglesia_id IN (SELECT fn_mis_iglesias()) OR fn_es_colaborador_activo_en(iglesia_id, 'AFIRMACION'))
    AND fecha_eliminacion IS NULL
  );

ALTER POLICY pol_direccion_asignacion_select ON public.direccion_asignacion
  USING (
    (iglesia_id IN (SELECT fn_mis_iglesias()) OR fn_es_colaborador_activo_en(iglesia_id, 'AFIRMACION'))
    AND fecha_eliminacion IS NULL
    AND (persona_id IS NULL OR fn_puede_ver_confidencial(persona_id))
  );
