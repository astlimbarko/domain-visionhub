-- KAN-423 seguimiento (2026-09-22, pedido explícito del owner en vivo):
-- cada testimonio puede indicar quién lo contó. Si es alguien de la
-- iglesia, se busca y se vincula por persona_id (buscador inteligente,
-- mismo patrón que Disertador/Diezmante); si no es de la iglesia, se
-- guarda solo el nombre libre en nombre_persona. Ambos campos son
-- opcionales -- el testimonio se puede cargar sin decir quién lo contó.

begin;

ALTER TABLE public.casa_de_paz_reporte_testimonio
  ADD COLUMN persona_id uuid REFERENCES public.persona(id),
  ADD COLUMN nombre_persona text;

COMMENT ON COLUMN public.casa_de_paz_reporte_testimonio.persona_id IS
  'Quién contó el testimonio, si es una persona ya registrada en la iglesia. NULL si no se indicó o si es alguien externo (ver nombre_persona).';
COMMENT ON COLUMN public.casa_de_paz_reporte_testimonio.nombre_persona IS
  'Nombre de quien contó el testimonio: de la persona encontrada (persona_id) o texto libre si es alguien externo a la iglesia.';

commit;
