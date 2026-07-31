import { supabase } from './supabase';
import { aISO } from '@/utils/calendario-fechas';
import type { MonedaActiva, PanelConfiguracion } from '@/types/panel-supervisor.types';
import type { CargoVigente } from '@/types/casas-de-paz.types';

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

/**
 * Líder de Departamento (hoy solo existe "Departamento de Afirmación") --
 * básico: solo asignar a alguien que ya tiene una Persona en el sistema
 * (invitar por correo queda para después, ver 2026-08-01). Escritura directa
 * a la tabla vía RLS, mismo patrón que red_cargo/casa_de_paz_cargo (nunca
 * hubo pantalla para esto -- se documentó como "se asigna por DB" en
 * 47_departamento_cargo.sql).
 */
export async function obtenerCargoVigenteDepartamento(departamentoId: string): Promise<CargoVigente[]> {
  const { data, error } = await supabase
    .from('departamento_cargo')
    .select('id, persona_id, fecha_inicio, persona:persona_id(primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, correo)')
    .eq('departamento_id', departamentoId)
    .is('fecha_fin', null);
  if (error) throw error;
  return (data ?? []).map((r) => {
    const p = Array.isArray(r.persona) ? r.persona[0] : r.persona;
    return {
      id: r.id,
      persona_id: r.persona_id,
      fecha_inicio: r.fecha_inicio,
      correo: p?.correo ?? null,
      nombre_completo: [p?.primer_nombre, p?.segundo_nombre, p?.primer_apellido, p?.segundo_apellido].filter(Boolean).join(' '),
    };
  });
}

export async function asignarCargoDepartamento(iglesiaId: string, departamentoId: string, personaId: string, cargoId: string) {
  const vigentes = await obtenerCargoVigenteDepartamento(departamentoId);
  for (const v of vigentes) {
    const { error } = await supabase.from('departamento_cargo').update({ fecha_fin: aISO(new Date()) }).eq('id', v.id);
    if (error) throw error;
  }
  const { error } = await supabase.from('departamento_cargo').insert({
    iglesia_id: iglesiaId,
    departamento_id: departamentoId,
    persona_id: personaId,
    cargo_id: cargoId,
    fecha_inicio: aISO(new Date()),
  });
  if (error) throw error;
}

export async function quitarCargoDepartamento(cargoAsignacionId: string) {
  const { error } = await supabase.from('departamento_cargo').update({ fecha_fin: aISO(new Date()) }).eq('id', cargoAsignacionId);
  if (error) throw error;
}
