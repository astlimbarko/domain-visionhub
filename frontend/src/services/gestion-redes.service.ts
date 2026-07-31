import { supabase } from './supabase';

async function extraerError(error: unknown): Promise<Error> {
  const contexto = (error as { context?: Response }).context;
  if (contexto) {
    const cuerpo = await contexto.json().catch(() => null);
    return new Error(cuerpo?.error || (error as Error).message);
  }
  return error as Error;
}

/**
 * Menú "Gestión de Redes" del Supervisor de la Visión en Acción
 * (2026-08-01, pedido del owner): crear/desactivar Redes y designar Líder
 * de Red, todo con confirmación OTP -- antes se hacía sin PIN, mezclado en
 * Casas de Paz (GestionEstructuraVista.tsx).
 */
export async function crearRedSupervisor(
  iglesiaId: string,
  nombre: string,
  liderPersonaId: string | null,
  liderCorreoNuevo: string | null,
  pin?: string
): Promise<{ id: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke('crear-red', {
    body: {
      iglesiaId,
      nombre,
      liderPersonaId,
      liderCorreoNuevo,
      pin,
      redirectTo: `${window.location.origin}/completar-cuenta`,
    },
  });
  if (error) throw await extraerError(error);
  return data;
}

export async function desactivarRedSupervisor(redId: string, pin?: string): Promise<void> {
  const { error } = await supabase.rpc('fn_desactivar_red_supervisor', { p_red_id: redId, p_pin: pin ?? null });
  if (error) throw error;
}

export async function asignarLiderRedSupervisor(redId: string, personaId: string, pin?: string): Promise<string> {
  const { data, error } = await supabase.rpc('fn_asignar_lider_red_supervisor', {
    p_red_id: redId,
    p_persona_id: personaId,
    p_pin: pin ?? null,
  });
  if (error) throw error;
  return data as string;
}
