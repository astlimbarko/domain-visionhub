import { supabase } from './supabase';
import type { NuevaVisita, VisitaRed } from '@/types/visitas.types';

export async function obtenerVisitasRed(redId: string): Promise<VisitaRed[]> {
  const { data, error } = await supabase.rpc('fn_visitas_red', { p_red_id: redId });
  if (error) throw error;
  return data ?? [];
}

/**
 * Insert directo a `visita_cdp` -- mismo patrón que `crearVisita`/`crearEvento`:
 * la política RLS `pol_visita_cdp_insert` (56_visitas_red.sql) ya exige
 * `fn_es_lider_de_red(red_id)`, no hace falta una RPC de escritura aparte.
 */
export async function crearVisita(datos: NuevaVisita) {
  const { error } = await supabase.from('visita_cdp').insert({
    iglesia_id: datos.iglesiaId,
    casa_de_paz_id: datos.casaDePazId,
    red_id: datos.redId,
    lider_red_id: datos.liderRedId,
    motivo: datos.motivo,
    aspectos: datos.aspectos,
    aspecto_otro_detalle: datos.aspectoOtroDetalle || null,
    observaciones: datos.observaciones || null,
    tiene_adn_casa: datos.tieneAdnCasa ?? null,
    ensenanza_correcta: datos.ensenanzaCorrecta ?? null,
    fecha_visita: datos.fechaVisita,
  });
  if (error) throw error;
}
