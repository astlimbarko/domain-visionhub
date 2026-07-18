import { supabase } from './supabase';
import type {
  DatosRegistroPublico,
  RegistrarPersonaViaUrlResponse,
  ResolverUrlRegistroResponse,
} from '@/types/registro-publico.types';

export async function resolverUrlRegistro(slug: string): Promise<ResolverUrlRegistroResponse> {
  const { data, error } = await supabase.rpc('fn_resolver_url_registro', { p_slug: slug });
  if (error) throw error;
  return data as ResolverUrlRegistroResponse;
}

export async function registrarPersonaViaUrl(
  slug: string,
  datos: DatosRegistroPublico
): Promise<RegistrarPersonaViaUrlResponse> {
  const { data, error } = await supabase.rpc('fn_registrar_persona_via_url', {
    p_slug: slug,
    p_datos: datos,
  });
  if (error) throw error;
  return data as RegistrarPersonaViaUrlResponse;
}
