import { supabase } from './supabase';
import type { RolSistema } from '@/types/auth.types';
import type { DashboardSuperAdmin, IglesiaAdmin, ResultadoInvitacion, UsuarioListado } from '@/types/admin.types';

export async function obtenerDashboardSuperAdmin(): Promise<DashboardSuperAdmin> {
  const { data, error } = await supabase.rpc('fn_dashboard_super_admin');
  if (error) throw error;
  return data as DashboardSuperAdmin;
}

export async function obtenerIglesiasTodas(): Promise<IglesiaAdmin[]> {
  const { data, error } = await supabase.from('iglesia').select('id, nombre, ciudad, activo').order('nombre');
  if (error) throw error;
  return data ?? [];
}

export async function crearIglesia(sufijo: string, ciudad: string, pin?: string): Promise<void> {
  const { error } = await supabase.rpc('fn_crear_iglesia', { p_sufijo: sufijo, p_ciudad: ciudad, p_pin: pin ?? null });
  if (error) throw error;
}

export async function obtenerUsuarios(iglesiaId?: string): Promise<UsuarioListado[]> {
  const { data, error } = await supabase.rpc('fn_listar_usuarios', { p_iglesia_id: iglesiaId ?? null });
  if (error) throw error;
  return data ?? [];
}

export async function invitarUsuario(
  correo: string,
  rol: RolSistema,
  iglesiaId: string | null,
  pin?: string
): Promise<ResultadoInvitacion> {
  const { data, error } = await supabase.functions.invoke('invitar-usuario', {
    body: {
      correo,
      rol,
      iglesiaId,
      pin,
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

export async function crearUsuarioRol(usuarioId: string, rol: RolSistema, iglesiaId: string | null, pin?: string) {
  const { error } = await supabase.rpc('fn_crear_usuario_rol', {
    p_usuario_id: usuarioId,
    p_rol: rol,
    p_iglesia_id: iglesiaId,
    p_pin: pin ?? null,
  });
  if (error) throw error;
}
