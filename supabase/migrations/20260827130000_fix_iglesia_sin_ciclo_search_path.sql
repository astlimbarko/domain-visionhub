-- VisionHub -- fix de bug latente de search_path en fn_iglesia_sin_ciclo.
--
-- Sintoma real (2026-08-27): al asignar Supervisor de la Vision en Accion a una
-- iglesia SATELITE (ej. Centro de Vida Montero, satelite de 4 Anillo) el sistema
-- fallaba con "relation \"iglesia\" does not exist". No es un bloqueo multi-tenant
-- (KAN-251): es un bug de search_path preexistente.
--
-- Causa raiz: fn_iglesia_sin_ciclo es el trigger BEFORE INSERT OR UPDATE de la
-- tabla iglesia (valida que la jerarquia madre/hija/satelite no tenga ciclos).
-- No tenia SET search_path propio, asi que heredaba el search_path del contexto
-- que dispara el UPDATE. fn_estructura_asignar_supervisor (y asignar_pastor,
-- cambiar moneda, renombrar, etc.) corren con SET search_path = '' y hacen
-- UPDATE public.iglesia; al dispararse el trigger con search_path vacio, su
-- "FROM iglesia" sin calificar no resolvia -> relation "iglesia" does not exist.
--
-- Por que solo se manifestaba con satelites/hijas: el WHILE del trigger solo
-- entra al loop (y solo ahi ejecuta el SELECT ... FROM iglesia) cuando la fila
-- tiene iglesia_padre_id NO nulo. Para una iglesia sin padre el loop no corre y
-- el bug quedaba latente -- por eso asignar cargos en iglesias normales siempre
-- funciono y esto recien aparecio al operar sobre una satelite real.
--
-- Fix: fijar SET search_path = '' en la propia funcion (queda inmune al contexto
-- que la llame) y calificar public.iglesia. Logica identica, sin cambios de
-- comportamiento.

CREATE OR REPLACE FUNCTION public.fn_iglesia_sin_ciclo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_actual UUID := NEW.iglesia_padre_id;
  v_saltos INT := 0;
BEGIN
  WHILE v_actual IS NOT NULL LOOP
    IF v_actual = NEW.id THEN
      RAISE EXCEPTION 'IGLESIA_CICLO: la iglesia % no puede ser descendiente de si misma', NEW.id
        USING ERRCODE = 'P0001';
    END IF;
    v_saltos := v_saltos + 1;
    IF v_saltos > 50 THEN
      RAISE EXCEPTION 'IGLESIA_CICLO: jerarquia demasiado profunda o ciclo detectado'
        USING ERRCODE = 'P0001';
    END IF;
    SELECT iglesia_padre_id INTO v_actual FROM public.iglesia WHERE id = v_actual;
  END LOOP;
  RETURN NEW;
END;
$$;
