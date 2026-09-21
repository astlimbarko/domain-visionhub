-- VisionHub -- KAN-406: alta rapida sin fecha de nacimiento exacta (Reporte
-- de Casa de Paz > Asistencia > agregar persona nueva). Hoy `persona.fecha_
-- nacimiento` ya es NULLABLE (confirmado contra la base real antes de
-- escribir esto: ningun NOT NULL, ningun CHECK que la exija salvo el trigger
-- fn_validar_campos_membresia_persona, que solo dispara cuando
-- membresia_completada = true -- el alta rapida de Reportes.tsx siempre
-- inserta con membresia_completada = false, asi que ese trigger no aplica
-- aca). Lo que falta es un lugar para guardar la edad aproximada SIN
-- inventar una fecha de nacimiento ficticia (pedido explicito del ticket).
--
-- Decision de modelado: una sola columna nueva, `edad_aproximada`, en vez de
-- una columna + un booleano "fecha_no_confirmada". La distincion entre
-- "fecha de nacimiento confirmada" y "edad aproximada, sin confirmar" ya
-- queda expresada sin ambiguedad con las 2 columnas existentes/nuevas:
--   - fecha_nacimiento IS NOT NULL                            -> confirmada.
--   - fecha_nacimiento IS NULL AND edad_aproximada IS NOT NULL -> aproximada,
--     sin confirmar (el caso nuevo de este ticket).
--   - ambas NULL -> sin dato (ya posible hoy, ej. una visita cargada sin
--     nada de esto).
-- Un booleano extra seria redundante con esa combinacion y podria
-- desincronizarse de los datos reales (ej. booleano en false con
-- fecha_nacimiento NULL). No se agrega CHECK de mutua exclusion a proposito:
-- cuando la persona complete el formulario de membresia en el proceso de
-- bautismo y cargue su fecha real, edad_aproximada puede quedar tal cual
-- como dato historico de cuando se la agrego sin saberla -- no hace falta
-- borrarla para poder guardar la fecha real.
ALTER TABLE public.persona
  ADD COLUMN edad_aproximada SMALLINT NULL;

ALTER TABLE public.persona
  ADD CONSTRAINT persona_edad_aproximada_rango
  CHECK (edad_aproximada IS NULL OR (edad_aproximada >= 0 AND edad_aproximada <= 120));

COMMENT ON COLUMN public.persona.edad_aproximada IS
  'KAN-406: edad aproximada en anios, cargada cuando no se conoce la fecha de nacimiento exacta (alta rapida de asistencia). Dato no confirmado -- nunca usar para derivar una fecha_nacimiento ficticia. fecha_nacimiento sigue siendo la unica fuente de verdad de edad confirmada.';
