import { supabase } from './supabase';
import type { Avance } from '@/types/avance.types';

/** KAN-388: fn_avances_visibles ya filtra por rol/alcance del lado del
 * backend -- el cliente no decide nada, solo pinta lo que vuelve. */
export async function obtenerAvancesVisibles(): Promise<Avance[]> {
  const { data, error } = await supabase.rpc('fn_avances_visibles');
  if (error) throw error;
  return (data ?? []) as Avance[];
}
