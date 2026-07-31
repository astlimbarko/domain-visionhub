import { supabase } from './supabase';
import type { Notificacion } from '@/types/notificacion.types';

export async function obtenerMisNotificaciones(soloNoLeidas = false): Promise<Notificacion[]> {
  const { data, error } = await supabase.rpc('fn_mis_notificaciones', { p_solo_no_leidas: soloNoLeidas });
  if (error) throw error;
  return (data ?? []) as Notificacion[];
}

export async function obtenerNotificacionesNoLeidasCount(): Promise<number> {
  const { data, error } = await supabase.rpc('fn_notificaciones_no_leidas_count');
  if (error) throw error;
  return (data as number) ?? 0;
}

export async function marcarNotificacionLeida(id: string): Promise<void> {
  const { error } = await supabase.rpc('fn_marcar_notificacion_leida', { p_id: id });
  if (error) throw error;
}

export async function marcarTodasLeidas(): Promise<void> {
  const { error } = await supabase.rpc('fn_marcar_todas_leidas');
  if (error) throw error;
}
