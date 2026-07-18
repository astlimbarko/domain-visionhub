import { supabase } from './supabase';
import type { ComparativoIngreso, NuevoIngreso, TipoIngreso, TotalIngreso } from '@/types/finanzas.types';

export async function obtenerTiposIngreso(iglesiaId: string): Promise<TipoIngreso[]> {
  const { data, error } = await supabase
    .from('finanzas_tipo_ingreso')
    .select('id, codigo, nombre')
    .or(`iglesia_id.is.null,iglesia_id.eq.${iglesiaId}`)
    .eq('activo', true)
    .order('orden');
  if (error) throw error;
  return data ?? [];
}

export async function obtenerIngresosCdp(casaDePazId: string, desde: string, hasta: string): Promise<TotalIngreso[]> {
  const { data, error } = await supabase.rpc('fn_ingresos_cdp', {
    p_casa_de_paz_id: casaDePazId,
    p_desde: desde,
    p_hasta: hasta,
  });
  if (error) throw error;
  return data ?? [];
}

export async function obtenerComparativo(casaDePazId: string, desde: string, hasta: string): Promise<ComparativoIngreso[]> {
  const { data, error } = await supabase.rpc('fn_ingresos_comparativo', {
    p_casa_de_paz_id: casaDePazId,
    p_desde: desde,
    p_hasta: hasta,
  });
  if (error) throw error;
  return data ?? [];
}

export async function crearIngreso(datos: NuevoIngreso) {
  const { error } = await supabase.from('finanzas_ingreso').insert(datos);
  if (error) throw error;
}
