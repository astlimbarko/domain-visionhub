import { supabase } from './supabase';
import type { FusionCdp, FusionRed } from '@/types/fusion.types';

export async function listarFusionesCdp(iglesiaId: string): Promise<FusionCdp[]> {
  const { data, error } = await supabase.rpc('fn_listar_fusiones_cdp', { p_iglesia_id: iglesiaId });
  if (error) throw error;
  return data ?? [];
}

export async function fusionarCdp(origenId: string, destinoId: string, motivo: string, pin?: string): Promise<string> {
  const { data, error } = await supabase.rpc('fn_fusionar_cdp', {
    p_origen_id: origenId,
    p_destino_id: destinoId,
    p_motivo: motivo,
    p_pin: pin ?? null,
  });
  if (error) throw error;
  return data;
}

export async function deshacerFusionCdp(fusionId: string, motivo: string, pin?: string) {
  const { error } = await supabase.rpc('fn_deshacer_fusion_cdp', {
    p_fusion_id: fusionId,
    p_motivo: motivo,
    p_pin: pin ?? null,
  });
  if (error) throw error;
}

export async function listarFusionesRed(iglesiaId: string): Promise<FusionRed[]> {
  const { data, error } = await supabase.rpc('fn_listar_fusiones_red', { p_iglesia_id: iglesiaId });
  if (error) throw error;
  return data ?? [];
}

export async function fusionarRed(origenId: string, destinoId: string, motivo: string, pin?: string): Promise<string> {
  const { data, error } = await supabase.rpc('fn_fusionar_red', {
    p_origen_id: origenId,
    p_destino_id: destinoId,
    p_motivo: motivo,
    p_pin: pin ?? null,
  });
  if (error) throw error;
  return data;
}

export async function deshacerFusionRed(fusionId: string, motivo: string, pin?: string) {
  const { error } = await supabase.rpc('fn_deshacer_fusion_red', {
    p_fusion_id: fusionId,
    p_motivo: motivo,
    p_pin: pin ?? null,
  });
  if (error) throw error;
}
