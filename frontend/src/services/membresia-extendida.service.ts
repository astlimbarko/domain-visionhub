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

// KAN-126 (capa de datos únicamente -- ver frontend/src/hooks/useMembresiaExtendida.ts
// y bitácora del 2026-08-09: el enganche real en PrivateLayout.tsx/auth.store.ts
// queda bloqueado a propósito, esos archivos están fuera de alcance en esta
// sesión por el refactor paralelo de sesión/roles).
export async function obtenerMiMembresiaIncompleta(): Promise<MembresiaIncompleta | null> {
  const { data, error } = await supabase.rpc('fn_mi_membresia_incompleta');
  if (error) throw error;
  return data;
}
