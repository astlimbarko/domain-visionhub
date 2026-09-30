// KAN-488 (harness/21, Membresía desde 0): autoguardado del borrador en la
// BD (tabla membresia_borrador), 1 por usuario+iglesia. Mismo criterio que el
// borrador de reporte de CdP (KAN-435): el payload es todo el formulario como
// JSON, no toca las tablas reales de persona hasta que se presiona "Guardar".
import { supabase } from './supabase';
import type { DatosMembresiaNuevos } from '@/types/membresia-nuevos.types';

export async function guardarBorradorMembresia(iglesiaId: string, payload: DatosMembresiaNuevos): Promise<string> {
  const { data, error } = await supabase.rpc('fn_guardar_borrador_membresia', {
    p_iglesia_id: iglesiaId,
    p_payload: payload,
  });
  if (error) throw error;
  return data as string;
}

export async function obtenerBorradorMembresia(iglesiaId: string): Promise<DatosMembresiaNuevos | null> {
  const { data, error } = await supabase.rpc('fn_obtener_borrador_membresia', { p_iglesia_id: iglesiaId });
  if (error) throw error;
  return (data as DatosMembresiaNuevos | null) ?? null;
}

export async function eliminarBorradorMembresia(iglesiaId: string): Promise<void> {
  const { error } = await supabase.rpc('fn_eliminar_borrador_membresia', { p_iglesia_id: iglesiaId });
  if (error) throw error;
}
