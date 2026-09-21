import { supabase } from './supabase';
import type {
  ColaboradorAuditoriaItem,
  ColaboradorCodigoGenerado,
  ColaboradorHistorialItem,
  ColaboradorListado,
  MiColaboracionActiva,
  PersonaEditarAfirmacion,
} from '@/types/colaborador.types';
import type { DatosPersonaAfirmacion } from '@/types/afirmacion.types';

// ─── Líder: generar/revocar el código ─────────────────────────────────────

export async function generarCodigoColaborador(
  iglesiaId: string,
  departamentoCodigo: string,
  duracionMinutos: number,
): Promise<ColaboradorCodigoGenerado> {
  const { data, error } = await supabase.rpc('fn_generar_codigo_colaborador', {
    p_iglesia_id: iglesiaId,
    p_departamento_codigo: departamentoCodigo,
    p_duracion_minutos: duracionMinutos,
  });
  if (error) throw error;
  return data as ColaboradorCodigoGenerado;
}

export async function revocarCodigoColaborador(codigoId: string): Promise<void> {
  const { error } = await supabase.rpc('fn_revocar_codigo_colaborador', { p_codigo_id: codigoId });
  if (error) throw error;
}

// ─── Colaborador: canjear código y ver el propio estado/historial ────────

export async function redimirCodigoColaborador(codigo: string): Promise<MiColaboracionActiva> {
  const { data, error } = await supabase.rpc('fn_redimir_codigo_colaborador', { p_codigo: codigo });
  if (error) throw error;
  return data as MiColaboracionActiva;
}

export async function obtenerMiColaboracionActiva(): Promise<MiColaboracionActiva | null> {
  const { data, error } = await supabase.rpc('fn_mi_colaboracion_activa');
  if (error) throw error;
  const filas = (data ?? []) as MiColaboracionActiva[];
  return filas[0] ?? null;
}

export async function obtenerMiHistorialColaborador(): Promise<ColaboradorHistorialItem[]> {
  const { data, error } = await supabase.rpc('fn_mi_historial_colaborador');
  if (error) throw error;
  return (data ?? []) as ColaboradorHistorialItem[];
}

// ─── Líder: panel de gestión ───────────────────────────────────────────────

export async function listarColaboradores(iglesiaId: string, departamentoCodigo: string): Promise<ColaboradorListado[]> {
  const { data, error } = await supabase.rpc('fn_listar_colaboradores', {
    p_iglesia_id: iglesiaId,
    p_departamento_codigo: departamentoCodigo,
  });
  if (error) throw error;
  return (data ?? []) as ColaboradorListado[];
}

export async function obtenerAuditoriaColaborador(sesionId: string): Promise<ColaboradorAuditoriaItem[]> {
  const { data, error } = await supabase.rpc('fn_colaborador_auditoria', { p_sesion_id: sesionId });
  if (error) throw error;
  return (data ?? []) as ColaboradorAuditoriaItem[];
}

export async function extenderColaboradorSesion(sesionId: string, minutosAdicionales: number): Promise<void> {
  const { error } = await supabase.rpc('fn_extender_colaborador_sesion', {
    p_sesion_id: sesionId,
    p_minutos_adicionales: minutosAdicionales,
  });
  if (error) throw error;
}

export async function pausarColaboradorSesion(sesionId: string): Promise<void> {
  const { error } = await supabase.rpc('fn_pausar_colaborador_sesion', { p_sesion_id: sesionId });
  if (error) throw error;
}

export async function reanudarColaboradorSesion(sesionId: string): Promise<void> {
  const { error } = await supabase.rpc('fn_reanudar_colaborador_sesion', { p_sesion_id: sesionId });
  if (error) throw error;
}

export async function finalizarColaboradorSesion(sesionId: string): Promise<void> {
  const { error } = await supabase.rpc('fn_finalizar_colaborador_sesion', { p_sesion_id: sesionId });
  if (error) throw error;
}

// ─── KAN-405 seguimiento: editar una persona que el propio Colaborador (o
// Líder de Afirmación) registró -- pedido explícito del owner en vivo,
// "su propio historial" debe poder reabrirse y corregirse, no ser de solo
// lectura. Gate real en el backend: creado_por = auth.uid(). ────────────────

export async function obtenerPersonaEditarAfirmacion(personaId: string): Promise<PersonaEditarAfirmacion> {
  const { data, error } = await supabase.rpc('fn_obtener_persona_editar_afirmacion', { p_persona_id: personaId });
  if (error) throw error;
  return data as PersonaEditarAfirmacion;
}

export async function editarPersonaAfirmacion(
  personaId: string,
  datos: DatosPersonaAfirmacion,
): Promise<{ persona_id: string; nombre_completo: string }> {
  const { data, error } = await supabase.rpc('fn_editar_persona_afirmacion', {
    p_persona_id: personaId,
    p_datos: datos,
  });
  if (error) throw error;
  return data as { persona_id: string; nombre_completo: string };
}
