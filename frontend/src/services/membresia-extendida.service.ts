import { supabase } from './supabase';
import type { MembresiaIncompleta, TipoDiscipulado } from '@/types/membresia-extendida.types';

// KAN-123: catálogo global de discipulados, anon-safe (fn_listar_tipos_discipulado)
// -- se usa igual en los 3 flujos (público, invitación, Afirmación), no hace
// falta una variante autenticada aparte.
export async function listarTiposDiscipulado(): Promise<TipoDiscipulado[]> {
  const { data, error } = await supabase.rpc('fn_listar_tipos_discipulado');
  if (error) throw error;
  return data ?? [];
}

// KAN-126: generaliza fn_mi_invitacion_pendiente a cualquier usuario_rol
// vigente sin Persona (Q-8 en KAN-123). Se llama desde construirSesionDesdeAuth
// (sesion.service.ts) en el mismo punto donde antes solo se consultaba la
// invitación -- fn_mi_membresia_incompleta ya delega en fn_mi_invitacion_pendiente
// primero, así que el caso de invitación existente no cambia de comportamiento.
export async function obtenerMiMembresiaIncompleta(): Promise<MembresiaIncompleta | null> {
  const { data, error } = await supabase.rpc('fn_mi_membresia_incompleta');
  if (error) throw error;
  return data;
}

// KAN-126: completar Membresía para el caso general (usuario_rol vigente sin
// invitación asociada -- invitacion.id === null). fn_completar_membresia
// (invitacion-lider.service.ts) exige una invitacion_lider y no sirve acá.
export async function completarMembresiaGeneral(
  datos: Record<string, unknown>
): Promise<{ nombre_completo: string; destino: string | null }> {
  const { data, error } = await supabase.rpc('fn_completar_membresia_general', { p_datos: datos });
  if (error) throw error;
  return data;
}
