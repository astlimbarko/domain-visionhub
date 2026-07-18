import { supabase } from './supabase';
import { aISO } from '@/utils/calendario-fechas';
import type { MinisterioResumen, ParticipanteMinisterio } from '@/types/ministerios.types';

export async function obtenerMinisterios(iglesiaId: string): Promise<MinisterioResumen[]> {
  const { data, error } = await supabase.rpc('fn_listar_ministerios', { p_iglesia_id: iglesiaId });
  if (error) throw error;
  return data ?? [];
}

export async function obtenerParticipantes(ministerioId: string): Promise<ParticipanteMinisterio[]> {
  const { data, error } = await supabase.rpc('fn_listar_participantes_ministerio', { p_ministerio_id: ministerioId });
  if (error) throw error;
  return data ?? [];
}

export async function crearMinisterio(iglesiaId: string, nombre: string): Promise<{ id: string }> {
  const codigo = nombre
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const { data, error } = await supabase
    .from('ministerio')
    .insert({ iglesia_id: iglesiaId, codigo, nombre: nombre.trim(), orden: 99 })
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

export async function toggleActivoMinisterio(ministerioId: string, activo: boolean) {
  const { error } = await supabase.from('ministerio').update({ activo }).eq('id', ministerioId);
  if (error) throw error;
}

export async function agregarParticipante(iglesiaId: string, ministerioId: string, personaId: string) {
  const { error } = await supabase.from('ministerio_persona').insert({
    iglesia_id: iglesiaId,
    ministerio_id: ministerioId,
    persona_id: personaId,
    fecha_inicio: aISO(new Date()),
  });
  if (error) throw error;
}

export async function quitarParticipante(participanteId: string) {
  const { error } = await supabase.from('ministerio_persona').update({ fecha_fin: aISO(new Date()) }).eq('id', participanteId);
  if (error) throw error;
}

export async function hacerLiderMinisterio(participanteId: string, liderAnteriorId?: string) {
  if (liderAnteriorId) {
    const { error } = await supabase.from('ministerio_persona').update({ es_lider: false }).eq('id', liderAnteriorId);
    if (error) throw error;
  }
  const { error } = await supabase.from('ministerio_persona').update({ es_lider: true }).eq('id', participanteId);
  if (error) throw error;
}
