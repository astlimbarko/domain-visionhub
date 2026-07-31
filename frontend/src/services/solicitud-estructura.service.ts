import { supabase } from './supabase';

export async function aprobarSolicitudEstructura(id: string): Promise<void> {
  const { error } = await supabase.rpc('fn_aprobar_solicitud_estructura', { p_id: id });
  if (error) throw error;
}

export async function rechazarSolicitudEstructura(id: string, motivo?: string): Promise<void> {
  const { error } = await supabase.rpc('fn_rechazar_solicitud_estructura', { p_id: id, p_motivo: motivo ?? null });
  if (error) throw error;
}
