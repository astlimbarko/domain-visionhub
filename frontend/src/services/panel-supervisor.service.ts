import { supabase } from './supabase';
import type { MonedaActiva, PanelConfiguracion } from '@/types/panel-supervisor.types';

export async function obtenerPanelConfiguracion(iglesiaId: string): Promise<PanelConfiguracion> {
  const { data, error } = await supabase.rpc('fn_panel_configuracion', { p_iglesia_id: iglesiaId });
  if (error) throw error;
  return data as PanelConfiguracion;
}

export async function setConfiguracion(iglesiaId: string, codigo: string, valor: string, pin?: string) {
  const { error } = await supabase.rpc('fn_set_configuracion', {
    p_iglesia_id: iglesiaId,
    p_codigo: codigo,
    p_valor: valor,
    p_pin: pin ?? null,
  });
  if (error) throw error;
}

export async function toggleDepartamento(departamentoId: string, activo: boolean, pin?: string) {
  const { error } = await supabase.rpc('fn_toggle_departamento', {
    p_departamento_id: departamentoId,
    p_activo: activo,
    p_pin: pin ?? null,
  });
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

export async function cambiarMonedaDefecto(iglesiaId: string, monedaId: string, pin?: string) {
  const { error } = await supabase.rpc('fn_cambiar_moneda_defecto', {
    p_iglesia_id: iglesiaId,
    p_moneda_id: monedaId,
    p_pin: pin ?? null,
  });
  if (error) throw error;
}

export async function renombrarIglesia(iglesiaId: string, prefijo: string, sufijo: string, pin?: string) {
  const { error } = await supabase.rpc('fn_renombrar_iglesia', {
    p_iglesia_id: iglesiaId,
    p_prefijo: prefijo,
    p_sufijo: sufijo,
    p_pin: pin ?? null,
  });
  if (error) throw error;
}
