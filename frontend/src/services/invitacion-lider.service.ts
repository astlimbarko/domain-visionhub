import { supabase } from './supabase';
import { obtenerUrlBase } from '@/utils/app-url';
import type { CuentaHuerfana, InvitacionDepartamento, InvitacionLider, InvitacionPendiente, RolInvitable } from '@/types/invitacion-lider.types';

export interface ErrorPersonaExistente extends Error {
  personaId?: string;
  personaNombre?: string;
}

async function extraerError(error: unknown): Promise<ErrorPersonaExistente> {
  const contexto = (error as { context?: Response }).context;
  if (contexto) {
    const cuerpo = await contexto.json().catch(() => null);
    const resultado: ErrorPersonaExistente = new Error(cuerpo?.error || (error as Error).message);
    if (cuerpo?.personaId) {
      resultado.personaId = cuerpo.personaId;
      resultado.personaNombre = cuerpo.personaNombre;
    }
    return resultado;
  }
  return error as Error;
}

/** KAN-376 seguimiento (2026-09-14): datos mínimos para crear la Persona +
 * cargo real de una vez, junto con la contraseña directa -- sin esto la
 * cuenta quedaba en un estado intermedio (contraseña, sin rol real hasta
 * que alguien completara el wizard). Acotado a Líder/Sublíder de CdP. */
export interface DatosPersonaAltaDirecta {
  primerNombre: string;
  segundoNombre?: string;
  primerApellido: string;
  segundoApellido?: string;
  sexo: 'M' | 'F';
}

export async function invitarLider(
  correo: string,
  rol: RolInvitable | 'SUPERVISOR_RED' | null,
  redId: string | null,
  casaDePazId: string | null,
  departamentoId: string | null = null,
  pin?: string,
  /** KAN-376 seguimiento: si viene, crea la cuenta con esta contraseña ya
   * confirmada en vez de mandar el correo de invitación. */
  contrasena?: string,
  datosPersona?: DatosPersonaAltaDirecta
): Promise<{ id: string; correo: string; cuentaHuerfanaReparada?: boolean }> {
  const { data, error } = await supabase.functions.invoke('invitar-lider', {
    body: {
      accion: 'invitar',
      correo,
      rol,
      redId,
      casaDePazId,
      departamentoId,
      pin,
      contrasena,
      datosPersona,
      redirectTo: `${obtenerUrlBase()}/completar-cuenta`,
    },
  });
  if (error) throw await extraerError(error);
  return data;
}

export async function obtenerInvitacionesDepartamento(iglesiaId: string): Promise<InvitacionDepartamento[]> {
  const { data, error } = await supabase.rpc('fn_listar_invitaciones_departamento', { p_iglesia_id: iglesiaId });
  if (error) throw error;
  return data ?? [];
}

export async function reenviarInvitacionLider(invitacionId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('invitar-lider', {
    body: {
      accion: 'reenviar',
      invitacionId,
      redirectTo: `${obtenerUrlBase()}/completar-cuenta`,
    },
  });
  if (error) throw await extraerError(error);
}

export async function cancelarInvitacionLider(invitacionId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('invitar-lider', {
    body: { accion: 'cancelar', invitacionId },
  });
  if (error) throw await extraerError(error);
}

export async function corregirCorreoInvitacionLider(invitacionId: string, correoNuevo: string, pin?: string): Promise<void> {
  const { error } = await supabase.functions.invoke('invitar-lider', {
    body: {
      accion: 'corregir',
      invitacionId,
      correo: correoNuevo,
      pin,
      redirectTo: `${obtenerUrlBase()}/completar-cuenta`,
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

/** KAN-424: panel de Super Admin -- cuentas de auth.users sin Persona
 * vinculada (quedaron a medias de un alta anterior). */
export async function listarCuentasHuerfanas(): Promise<CuentaHuerfana[]> {
  const { data, error } = await supabase.rpc('fn_listar_cuentas_huerfanas');
  if (error) throw error;
  return data ?? [];
}

/** KAN-424: banea la cuenta de forma definitiva (no se puede borrar
 * físicamente si alguna vez quedó referenciada por un usuario_rol/
 * invitacion_lider soft-eliminado) para sacarla del listado. */
export async function descartarCuentaHuerfana(usuarioId: string, pinDescarte?: string): Promise<void> {
  const { error } = await supabase.functions.invoke('invitar-lider', {
    body: { accion: 'descartar_huerfana', usuarioId, pinDescarte },
  });
  if (error) throw await extraerError(error);
}
