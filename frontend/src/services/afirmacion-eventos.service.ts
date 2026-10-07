import { supabase } from './supabase';
import type { TipoEvento, EventoAfirmacion, FilaHistorialProcesoConEvento } from '@/types/afirmacion-eventos.types';

export async function listarTiposEvento(): Promise<TipoEvento[]> {
  const { data, error } = await supabase.rpc('fn_afirmacion_tipos_evento');
  if (error) throw error;
  return data ?? [];
}

export async function listarEventosAfirmacion(
  iglesiaId: string,
  soloActivos = false
): Promise<EventoAfirmacion[]> {
  const { data, error } = await supabase.rpc('fn_afirmacion_listar_eventos', {
    p_iglesia_id: iglesiaId,
    p_solo_activos: soloActivos,
  });
  if (error) throw error;
  return data ?? [];
}

export async function crearEventoAfirmacion(
  iglesiaId: string,
  titulo: string,
  tipoEventoId: string,
  fechaInicio: string,
  fechaFin: string | null,
  descripcion: string | null
): Promise<string> {
  const { data, error } = await supabase.rpc('fn_afirmacion_crear_evento', {
    p_iglesia_id: iglesiaId,
    p_titulo: titulo,
    p_tipo_evento_id: tipoEventoId,
    p_fecha_inicio: fechaInicio,
    p_fecha_fin: fechaFin,
    p_descripcion: descripcion,
  });
  if (error) throw error;
  return data as string;
}

export async function obtenerDetalleEventoAfirmacion(eventoId: string): Promise<EventoAfirmacion | null> {
  const { data, error } = await supabase.rpc('fn_afirmacion_evento_detalle', {
    p_evento_id: eventoId,
  });
  if (error) throw error;
  // La RPC devuelve un setof (array de 1 fila), no un objeto: tomar la primera.
  return ((data ?? []) as EventoAfirmacion[])[0] ?? null;
}

export async function obtenerHistorialProcesoConEvento(
  iglesiaId: string,
  procesoCodigo: string,
  registradoPor: string | null = null,
  eventoId: string | null = null
): Promise<FilaHistorialProcesoConEvento[]> {
  const { data, error } = await supabase.rpc('fn_afirmacion_historial_proceso', {
    p_iglesia_id: iglesiaId,
    p_proceso_codigo: procesoCodigo,
    p_registrado_por: registradoPor,
    p_evento_id: eventoId,
  });
  if (error) throw error;
  return data ?? [];
}
