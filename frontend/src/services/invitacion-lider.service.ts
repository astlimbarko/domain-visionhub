import { supabase } from './supabase';
import type { InvitacionLider, InvitacionPendiente, RolInvitable } from '@/types/invitacion-lider.types';

async function extraerError(error: unknown): Promise<Error> {
  const contexto = (error as { context?: Response }).context;
  if (contexto) {
    const cuerpo = await contexto.json().catch(() => null);
    return new Error(cuerpo?.error || (error as Error).message);
  }
  return error as Error;
}

export async function invitarLider(
  correo: string,
  rol: RolInvitable,
  redId: string | null,
  casaDePazId: string | null
): Promise<{ id: string; correo: string }> {
  const { data, error } = await supabase.functions.invoke('invitar-lider', {
    body: {
      accion: 'invitar',
      correo,
      rol,
      redId,
      casaDePazId,
      redirectTo: `${window.location.origin}/completar-cuenta`,
    },
  });
  if (error) throw await extraerError(error);
  return data;
}

export async function reenviarInvitacionLider(invitacionId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('invitar-lider', {
    body: {
      accion: 'reenviar',
      invitacionId,
      redirectTo: `${window.location.origin}/completar-cuenta`,
    },
  });
  if (error) throw await extraerError(error);
}

export async function obtenerInvitacionesLider(iglesiaId: string): Promise<InvitacionLider[]> {
  const { data, error } = await supabase.rpc('fn_listar_invitaciones_lider', { p_iglesia_id: iglesiaId });
  if (error) throw error;
  return data ?? [];
}

export async function obtenerMiInvitacionPendiente(): Promise<InvitacionPendiente | null> {
  const { data, error } = await supabase.rpc('fn_mi_invitacion_pendiente');
  if (error) throw error;
  return data;
}

export async function completarMembresia(datos: Record<string, unknown>): Promise<{ nombre_completo: string; destino: string }> {
  const { data, error } = await supabase.rpc('fn_completar_membresia', { p_datos: datos });
  if (error) throw error;
  return data;
}
