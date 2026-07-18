import { supabase } from './supabase';
import type { MonedaActiva, PanelConfiguracion } from '@/types/panel-supervisor.types';

export async function obtenerPanelConfiguracion(iglesiaId: string): Promise<PanelConfiguracion> {
  const { data, error } = await supabase.rpc('fn_panel_configuracion', { p_iglesia_id: iglesiaId });
  if (error) throw error;
  return data as PanelConfiguracion;
}

export async function setConfiguracion(iglesiaId: string, codigo: string, valor: string) {
  const { error } = await supabase.rpc('fn_set_configuracion', {
    p_iglesia_id: iglesiaId,
    p_codigo: codigo,
    p_valor: valor,
  });
  if (error) throw error;
}

export async function toggleDepartamento(departamentoId: string, activo: boolean) {
  const { error } = await supabase.from('departamento').update({ activo }).eq('id', departamentoId);
  if (error) throw error;
}

export async function obtenerMonedasActivas(iglesiaId: string): Promise<MonedaActiva[]> {
  const { data, error } = await supabase
    .from('iglesia_moneda')
    .select('id, moneda_id, activa, moneda:moneda_id(codigo, nombre, simbolo)')
    .eq('iglesia_id', iglesiaId)
    .eq('activa', true);
  if (error) throw error;
  return (data ?? []).map((r) => {
    const m = Array.isArray(r.moneda) ? r.moneda[0] : r.moneda;
    return {
      id: r.id,
      moneda_id: r.moneda_id,
      activa: r.activa,
      codigo: m?.codigo ?? '',
      nombre: m?.nombre ?? '',
      simbolo: m?.simbolo ?? '',
    };
  });
}

export async function cambiarMonedaDefecto(iglesiaId: string, monedaId: string) {
  const { error } = await supabase.from('iglesia').update({ moneda_defecto_id: monedaId }).eq('id', iglesiaId);
  if (error) throw error;
}
