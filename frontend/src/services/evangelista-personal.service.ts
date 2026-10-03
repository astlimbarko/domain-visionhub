import { supabase } from './supabase';
import type {
  DatosPersonaCredencial,
  EvangelistaDashboardDatos,
  EvangelistaHistorialItem,
  MedioSeguimiento,
  NuevaPersonaEvangelistaPayload,
  SeguimientoItem,
  TipoEvangelismoPersonal,
} from '@/types/evangelista-personal.types';

export async function esEvangelista(iglesiaId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('fn_es_evangelista_en', { p_iglesia_id: iglesiaId });
  if (error) throw error;
  return Boolean(data);
}

export async function puedeOtorgarEvangelista(iglesiaId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('fn_puede_otorgar_evangelista', { p_iglesia_id: iglesiaId });
  if (error) throw error;
  return Boolean(data);
}

export async function otorgarEvangelista(personaId: string, iglesiaId: string): Promise<void> {
  const { error } = await supabase.rpc('fn_otorgar_evangelista', { p_persona_id: personaId, p_iglesia_id: iglesiaId });
  if (error) throw error;
}

export async function revocarEvangelista(personaId: string, iglesiaId: string): Promise<void> {
  const { error } = await supabase.rpc('fn_revocar_evangelista', { p_persona_id: personaId, p_iglesia_id: iglesiaId });
  if (error) throw error;
}

export async function obtenerDatosPersonaCredencial(personaId: string): Promise<DatosPersonaCredencial> {
  const { data, error } = await supabase.rpc('fn_evangelista_datos_persona', { p_persona_id: personaId });
  if (error) throw error;
  const fila = data?.[0] as DatosPersonaCredencial | undefined;
  if (!fila) throw new Error('No se encontró la persona');
  return fila;
}

/** KAN-434: flujo completo del panel "Crear credencial para Evangelista" --
 * ver supabase/functions/crear-credencial-evangelista/index.ts. */
export async function crearCredencialEvangelista(
  personaId: string,
  iglesiaId: string,
  correo?: string,
  actualizarCorreoMembresia?: boolean
): Promise<{ ok: boolean; cuentaNueva: boolean; correo?: string }> {
  const { data, error } = await supabase.functions.invoke('crear-credencial-evangelista', {
    body: { personaId, iglesiaId, correo, actualizarCorreoMembresia },
  });
  if (error) {
    const contexto = (error as { context?: Response }).context;
    if (contexto) {
      const cuerpo = await contexto.json().catch(() => null);
      throw new Error(cuerpo?.error || error.message);
    }
    throw error;
  }
  return data;
}

/** Catálogo filtrado a propósito -- Semilla queda afuera (pedido del owner,
 * 2026-09-29), no se crea un catálogo nuevo, se reusa `tipo_evangelismo`. */
export async function obtenerTiposEvangelismoPersonal(iglesiaId: string): Promise<TipoEvangelismoPersonal[]> {
  const { data, error } = await supabase
    .from('tipo_evangelismo')
    .select('id, codigo, nombre')
    .or(`iglesia_id.is.null,iglesia_id.eq.${iglesiaId}`)
    .eq('activo', true)
    .in('codigo', ['UNO_A_UNO', 'ELITE'])
    .order('orden');
  if (error) throw error;
  return (data ?? []) as TipoEvangelismoPersonal[];
}

export async function registrarPersonaEvangelizada(payload: NuevaPersonaEvangelistaPayload): Promise<string> {
  const { data, error } = await supabase.rpc('fn_evangelista_registrar_persona', {
    p_datos: {
      persona_id: payload.persona_id ?? null,
      primer_nombre: payload.primer_nombre,
      segundo_nombre: payload.segundo_nombre ?? null,
      primer_apellido: payload.primer_apellido,
      segundo_apellido: payload.segundo_apellido ?? null,
      sexo: payload.sexo,
      fecha_nacimiento: payload.fecha_nacimiento || null,
      telefono: payload.telefono || null,
      domicilio: payload.domicilio || null,
      tipo_evangelismo_id: payload.tipo_evangelismo_id,
    },
  });
  if (error) throw error;
  return data as string;
}

export async function obtenerHistorialEvangelista(desde?: string, hasta?: string): Promise<EvangelistaHistorialItem[]> {
  const { data, error } = await supabase.rpc('fn_evangelista_historial', { p_desde: desde ?? null, p_hasta: hasta ?? null });
  if (error) throw error;
  return data ?? [];
}

export async function obtenerDashboardEvangelista(anio: number, mes: number): Promise<EvangelistaDashboardDatos> {
  const { data, error } = await supabase.rpc('fn_evangelista_dashboard', { p_anio: anio, p_mes: mes });
  if (error) throw error;
  return data as EvangelistaDashboardDatos;
}

export async function registrarSeguimiento(evangelismoId: string, medio: MedioSeguimiento, notas: string): Promise<string> {
  const { data, error } = await supabase.rpc('fn_evangelista_registrar_seguimiento', {
    p_evangelismo_id: evangelismoId,
    p_medio: medio,
    p_notas: notas || null,
  });
  if (error) throw error;
  return data as string;
}

export async function obtenerHistorialSeguimiento(evangelismoId: string): Promise<SeguimientoItem[]> {
  const { data, error } = await supabase.rpc('fn_evangelista_historial_seguimiento', { p_evangelismo_id: evangelismoId });
  if (error) throw error;
  return data ?? [];
}
