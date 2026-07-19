import { supabase } from './supabase';
import type { MultiplicacionCdp, MultiplicacionRed } from '@/types/multiplicacion.types';

export async function listarMultiplicacionesCdp(iglesiaId: string): Promise<MultiplicacionCdp[]> {
  const { data, error } = await supabase.rpc('fn_listar_multiplicaciones_cdp', { p_iglesia_id: iglesiaId });
  if (error) throw error;
  return data ?? [];
}

export async function multiplicarCdp(params: {
  origenId: string;
  nombreNueva?: string;
  personaIds: string[];
  liderNuevoId?: string;
  motivo: string;
  pin?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('fn_multiplicar_cdp', {
    p_origen_id: params.origenId,
    p_nombre_nueva: params.nombreNueva ?? null,
    p_persona_ids: params.personaIds,
    p_lider_nuevo_id: params.liderNuevoId ?? null,
    p_motivo: params.motivo,
    p_pin: params.pin ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function listarMultiplicacionesRed(iglesiaId: string): Promise<MultiplicacionRed[]> {
  const { data, error } = await supabase.rpc('fn_listar_multiplicaciones_red', { p_iglesia_id: iglesiaId });
  if (error) throw error;
  return data ?? [];
}

export async function multiplicarRed(params: {
  origenId: string;
  nombreNueva: string;
  cdpIds: string[];
  liderNuevoId?: string;
  motivo: string;
  pin?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('fn_multiplicar_red', {
    p_origen_id: params.origenId,
    p_nombre_nueva: params.nombreNueva,
    p_cdp_ids: params.cdpIds,
    p_lider_nuevo_id: params.liderNuevoId ?? null,
    p_motivo: params.motivo,
    p_pin: params.pin ?? null,
  });
  if (error) throw error;
  return data as string;
}
