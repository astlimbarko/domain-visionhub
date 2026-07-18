import { supabase } from './supabase';
import type { CasaDePazPropia, Cumpleanos, Evento, NuevoEvento, Proximo, TipoEvento } from '@/types/calendario.types';

export async function obtenerMisCasasDePaz(personaId: string): Promise<CasaDePazPropia[]> {
  const { data, error } = await supabase
    .from('casa_de_paz_cargo')
    .select('casa_de_paz_id, cargo:cargo_id(codigo)')
    .eq('persona_id', personaId)
    .is('fecha_fin', null);
  if (error) throw error;

  const propias = (data ?? []).filter((r) => {
    const cargo = Array.isArray(r.cargo) ? r.cargo[0] : r.cargo;
    return cargo?.codigo === 'LIDER_CDP' || cargo?.codigo === 'SUBLIDER_CDP';
  });

  // La Casa de Paz no tiene nombre propio salvo que la iglesia lo elija: se
  // identifica por el lider (+ zona si el mismo lider tiene mas de una CdP).
  return Promise.all(
    propias.map(async (r) => {
      const { data: etiqueta } = await supabase.rpc('fn_etiqueta_cdp', { p_casa_de_paz_id: r.casa_de_paz_id });
      return { casa_de_paz_id: r.casa_de_paz_id, nombre: etiqueta ?? '' };
    })
  );
}

export async function obtenerTiposEvento(iglesiaId: string): Promise<TipoEvento[]> {
  const { data, error } = await supabase
    .from('tipo_evento')
    .select('id, codigo, nombre, color, icono')
    .or(`iglesia_id.is.null,iglesia_id.eq.${iglesiaId}`)
    .eq('activo', true)
    .order('orden');
  if (error) throw error;
  return data ?? [];
}

export async function obtenerEventosMes(
  casaDePazId: string,
  desde: string,
  hasta: string,
  tipoEventoId?: string
): Promise<Evento[]> {
  const { data, error } = await supabase.rpc('fn_eventos_cdp', {
    p_casa_de_paz_id: casaDePazId,
    p_desde: desde,
    p_hasta: hasta,
    p_tipo_evento_id: tipoEventoId ?? null,
  });
  if (error) throw error;
  return data ?? [];
}

export async function obtenerCumpleanos(casaDePazId: string, desde: string, hasta: string): Promise<Cumpleanos[]> {
  const { data, error } = await supabase.rpc('fn_cumpleanos_cdp', {
    p_casa_de_paz_id: casaDePazId,
    p_desde: desde,
    p_hasta: hasta,
  });
  if (error) throw error;
  return data ?? [];
}

export async function obtenerProximos(casaDePazId: string): Promise<Proximo[]> {
  const { data, error } = await supabase.rpc('fn_proximos_cdp', { p_casa_de_paz_id: casaDePazId });
  if (error) throw error;
  return data ?? [];
}

export async function crearEvento(evento: NuevoEvento) {
  const { error } = await supabase.from('evento').insert(evento);
  if (error) throw error;
}
