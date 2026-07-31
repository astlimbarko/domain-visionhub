import { supabase } from './supabase';

export async function solicitarOtp(): Promise<{ expiraEn: string }> {
  const { data, error } = await supabase.functions.invoke('solicitar-otp', { body: {} });
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
