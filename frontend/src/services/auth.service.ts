import { supabase } from './supabase';
import type { IglesiaAccesible } from '@/types/auth.types';

export async function iniciarSesion(correo: string, contrasena: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: correo,
    password: contrasena,
  });
  if (error) throw error;
  return data;
}

export async function cerrarSesion() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function obtenerIglesiasAccesibles(): Promise<IglesiaAccesible[]> {
  const { data, error } = await supabase.rpc('fn_mis_iglesias_detalle');
  if (error) throw error;
  return (data ?? []) as IglesiaAccesible[];
}

export async function obtenerPersonaActual(): Promise<{ id: string; nombre_completo: string } | null> {
  const { data, error } = await supabase
    .from('v_persona')
    .select('id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido')
    .eq('usuario_id', (await supabase.auth.getUser()).data.user?.id ?? '')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const nombre = [data.primer_nombre, data.segundo_nombre, data.primer_apellido, data.segundo_apellido]
    .filter(Boolean)
    .join(' ');
  return { id: data.id, nombre_completo: nombre };
}
