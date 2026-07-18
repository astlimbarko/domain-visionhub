import { supabase } from './supabase';
import type { RolSistema } from '@/types/auth.types';
import type { IglesiaAdmin, ResultadoInvitacion, UsuarioListado } from '@/types/admin.types';

export async function obtenerIglesiasTodas(): Promise<IglesiaAdmin[]> {
  const { data, error } = await supabase.from('iglesia').select('id, nombre, ciudad, activo').order('nombre');
  if (error) throw error;
  return data ?? [];
}

export async function crearIglesia(sufijo: string, ciudad: string): Promise<void> {
  const { data: cobertura, error: errorCobertura } = await supabase.from('cobertura').select('id').limit(1).single();
  if (errorCobertura) throw errorCobertura;

  const { data: moneda, error: errorMoneda } = await supabase.from('moneda').select('id').eq('codigo', 'BOB').single();
  if (errorMoneda) throw errorMoneda;

  // Sin .select() a propósito: fn_mis_iglesias() vuelve a consultar iglesia
  // por dentro (para el caso Super Admin), y pedir el registro recien
  // insertado en la misma sentencia (RETURNING / return=representation)
  // choca con la politica de SELECT de la propia tabla iglesia -- 403,
  // aunque fn_es_super_admin() de verdadero. Un INSERT sin devolver nada
  // evita el problema; la lista se refresca aparte con la invalidacion.
  const { error } = await supabase
    .from('iglesia')
    .insert({ sufijo, ciudad, cobertura_id: cobertura.id, moneda_defecto_id: moneda.id });
  if (error) throw error;
}

export async function obtenerUsuarios(iglesiaId?: string): Promise<UsuarioListado[]> {
  const { data, error } = await supabase.rpc('fn_listar_usuarios', { p_iglesia_id: iglesiaId ?? null });
  if (error) throw error;
  return data ?? [];
}

export async function invitarUsuario(correo: string, rol: RolSistema, iglesiaId: string | null): Promise<ResultadoInvitacion> {
  const { data, error } = await supabase.functions.invoke('invitar-usuario', {
    body: {
      correo,
      rol,
      iglesiaId,
      redirectTo: `${window.location.origin}/completar-cuenta`,
    },
  });
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

export async function crearUsuarioRol(usuarioId: string, rol: RolSistema, iglesiaId: string | null) {
  const { error } = await supabase.from('usuario_rol').insert({ usuario_id: usuarioId, rol, iglesia_id: iglesiaId });
  if (error) throw error;
}
