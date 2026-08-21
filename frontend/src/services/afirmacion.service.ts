import { supabase } from './supabase';
import type {
  CasaDePazAfirmacion,
  CasaPazUrlAfirmacion,
  DatosPersonaAfirmacion,
  EstadisticasRegistroAfirmacion,
  EstadoUrl,
  LiderCdpAfirmacion,
  RegistrarPersonaAfirmacionResponse,
  SetEstadoUrlResponse,
} from '@/types/afirmacion.types';
import type { CamposObligatorios } from '@/types/registro-publico.types';

// fn_config_formulario ya existe (06_configuracion.sql) y ya se usa para
// FORMULARIO_REPORTE (reporte.service.ts) -- se reutiliza aca con
// FORMULARIO_MEMBRESIA para que el registro interno pinte los mismos
// asteriscos de obligatoriedad que el registro publico. Sin migracion nueva.
// Devuelve las claves crudas de configuracion_definicion.codigo
// (MEMBRESIA_CI_OBLIGATORIO, etc.) -- se traducen aca al shape limpio que ya
// espera CamposMembresiaFields (mismo shape que fn_resolver_url_registro
// arma a mano para el flujo publico).
export async function obtenerCamposObligatoriosMembresia(iglesiaId: string): Promise<CamposObligatorios> {
  const { data, error } = await supabase.rpc('fn_config_formulario', {
    p_iglesia_id: iglesiaId,
    p_formulario: 'FORMULARIO_MEMBRESIA',
  });
  if (error) throw error;
  const raw = (data ?? {}) as Record<string, boolean>;
  return {
    ci: raw.MEMBRESIA_CI_OBLIGATORIO ?? false,
    fecha_nacimiento: raw.MEMBRESIA_FECHA_NACIMIENTO_OBLIGATORIO ?? false,
    ocupacion: raw.MEMBRESIA_OCUPACION_OBLIGATORIO ?? false,
    grado_instruccion: raw.MEMBRESIA_GRADO_INSTRUCCION_OBLIGATORIO ?? false,
  };
}

export async function listarLideresCdpAfirmacion(iglesiaId: string): Promise<LiderCdpAfirmacion[]> {
  const { data, error } = await supabase.rpc('fn_listar_lideres_cdp_afirmacion', { p_iglesia_id: iglesiaId });
  if (error) throw error;
  return data ?? [];
}

export async function registrarPersonaAfirmacion(
  datos: DatosPersonaAfirmacion,
  casaDePazCargoId: string,
): Promise<RegistrarPersonaAfirmacionResponse> {
  const { data, error } = await supabase.rpc('fn_registrar_persona_afirmacion', {
    p_datos: datos,
    p_casa_de_paz_cargo_id: casaDePazCargoId,
  });
  if (error) throw error;
  return data as RegistrarPersonaAfirmacionResponse;
}

export async function listarUrlsAfirmacion(iglesiaId: string): Promise<CasaPazUrlAfirmacion[]> {
  const { data, error } = await supabase.rpc('fn_listar_casa_paz_url_afirmacion', { p_iglesia_id: iglesiaId });
  if (error) throw error;
  return data ?? [];
}

export async function setEstadoUrlsAfirmacion(ids: string[], estado: EstadoUrl): Promise<SetEstadoUrlResponse> {
  const { data, error } = await supabase.rpc('fn_set_estado_casa_paz_url', { p_ids: ids, p_estado: estado });
  if (error) throw error;
  return data as SetEstadoUrlResponse;
}

// KAN-127: todas las Casas de Paz de la iglesia, con o sin líder vigente.
export async function listarCasasDePazAfirmacion(iglesiaId: string): Promise<CasaDePazAfirmacion[]> {
  const { data, error } = await supabase.rpc('fn_listar_casas_de_paz_afirmacion', { p_iglesia_id: iglesiaId });
  if (error) throw error;
  return data ?? [];
}

// Plan panel Afirmación 2026-08-20, punto 1/4 (KAN-214): registros por URL vs. formulario interno.
export async function obtenerEstadisticasRegistroAfirmacion(iglesiaId: string): Promise<EstadisticasRegistroAfirmacion> {
  const { data, error } = await supabase.rpc('fn_afirmacion_estadisticas_registro', { p_iglesia_id: iglesiaId });
  if (error) throw error;
  return data as EstadisticasRegistroAfirmacion;
}
