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

// KAN-126: generaliza fn_mi_invitacion_pendiente (acotado a invitacion_lider/
// invitacion_departamento) a cualquier usuario_rol vigente sin Persona (Q-8)
// -- delega en el mismo chequeo de invitación primero, así que ese caso no
// cambia de comportamiento. Enganchado en sesion.service.ts (2026-08-11,
// ya no bloqueado por el refactor paralelo de sesión/roles).
//
// KAN-179 (seguimiento): p_iglesiaId opcional -- sin él resuelve por el rol
// más antiguo (uso original, login). Con él, revisa específicamente esa
// iglesia (uso: re-chequeo al cambiar de rol activo, PrivateLayout.tsx) --
// para que alguien con roles en más de una iglesia también sea "molestado"
// si le falta la ficha en la iglesia a la que recién cambió, no solo en la
// del rol más antiguo.
export async function obtenerMiMembresiaIncompleta(iglesiaId?: string): Promise<MembresiaIncompleta | null> {
  const { data, error } = await supabase.rpc('fn_mi_membresia_incompleta', { p_iglesia_id: iglesiaId ?? null });
  if (error) throw error;
  return data;
}

// KAN-126: completar Membresía para el caso general (usuario_rol vigente sin
// invitación asociada, Q-8) -- fn_completar_membresia (invitación real) sigue
// siendo la vía para invitacion_lider/invitacion_departamento, sin cambios.
export async function completarMembresiaGeneral(
  datos: Record<string, unknown>
): Promise<{ nombre_completo: string; destino: string | null }> {
  const { data, error } = await supabase.rpc('fn_completar_membresia_general', { p_datos: datos });
  if (error) throw error;
  return data;
}

// KAN-179: guardado progresivo -- se llama al avanzar de página (1..4) en el
// caso general. La página 1 crea/actualiza la Persona real (en borrador);
// las páginas 2-4 solo acumulan en el borrador JSONB, sin tocar tablas hijas
// todavía (eso pasa una sola vez, al finalizar con completarMembresiaGeneral).
export async function guardarPasoMembresiaGeneral(paso: number, datos: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.rpc('fn_guardar_paso_membresia_general', { p_paso: paso, p_datos: datos });
  if (error) throw error;
}
