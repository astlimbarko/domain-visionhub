-- VisionHub -- KAN-252 (fix urgente, mismo hallazgo que KAN-254): otro
-- trigger dormido se activo hoy al subir Ocupacion/Grado de instruccion a
-- obligatorio para todas las iglesias. fn_validar_campos_membresia_detalle
-- (BEFORE INSERT OR UPDATE en persona_detalle, sin ninguna excepcion) exige
-- ocupacion/grado_instruccion SIEMPRE que la iglesia los tenga obligatorios
-- -- pero el diseno original (KAN-230/233, comentario explicito en el
-- frontend: "ninguno de los dos se exige a nivel de base de datos, a
-- diferencia de ci/fecha_nacimiento") es que el checkbox "No aplica" del
-- frontend los exima SIEMPRE, sin excepcion, justamente porque no hay forma
-- de guardar "no aplica" en esta tabla (a diferencia de persona, que si
-- tiene membresia_completada para distinguir borrador de completo).
--
-- Mientras estos 2 flags estuvieron en 'false' en todas las iglesias este
-- trigger nunca se activaba. Al subirlos a 'true' hoy (20260825190000) quedo
-- bloqueando CUALQUIER alta/edicion de persona_detalle con "No aplica"
-- marcado -- en la practica, cualquier membresia nueva en cualquier
-- iglesia. Se corrige devolviendo el trigger a su diseno original: no
-- exige nada, la obligatoriedad de estos 2 campos queda solo a nivel de
-- frontend (con "No aplica" para eximirla), igual que siempre debio ser.
CREATE OR REPLACE FUNCTION public.fn_validar_campos_membresia_detalle()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  RETURN NEW;
END;
$$;
