import { supabase } from './supabase';
import { obtenerUrlBase } from '@/utils/app-url';
import type { RolSistema } from '@/types/auth.types';
import type { CuentaBusqueda, DashboardSuperAdmin, IglesiaAdmin, ResultadoInvitacion, UsuarioListado } from '@/types/admin.types';

export async function buscarCuentas(busqueda: string): Promise<CuentaBusqueda[]> {
  const { data, error } = await supabase.rpc('fn_buscar_cuentas', { p_busqueda: busqueda });
  if (error) throw error;
  return data ?? [];
}

export async function obtenerDashboardSuperAdmin(): Promise<DashboardSuperAdmin> {
  const { data, error } = await supabase.rpc('fn_dashboard_super_admin');
  if (error) throw error;
  return data as DashboardSuperAdmin;
}

export async function obtenerIglesiasTodas(): Promise<IglesiaAdmin[]> {
  const { data, error } = await supabase
    .from('iglesia')
    .select('id, nombre, sufijo, ciudad, correo, activo, tipo, iglesia_padre_id')
    .order('nombre');
  if (error) throw error;
  return data ?? [];
}

export async function crearIglesia(
  sufijo: string,
  ciudad: string,
  iglesiaPadreId: string | null,
  tipo: 'HIJA' | 'SATELITE',
  pastorUsuarioId: string | null,
  pastorCorreoNuevo: string | null,
  pin?: string
): Promise<{ id: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke('crear-iglesia', {
    body: {
      sufijo,
      ciudad,
      iglesiaPadreId,
      tipo,
      pastorUsuarioId,
      pastorCorreoNuevo,
      pin,
      redirectTo: `${obtenerUrlBase()}/completar-cuenta`,
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

export async function actualizarIglesia(
  iglesiaId: string, sufijo: string, ciudad: string, correo: string | null, pin?: string
): Promise<void> {
  const { error } = await supabase.rpc('fn_actualizar_iglesia', {
    p_iglesia_id: iglesiaId, p_sufijo: sufijo, p_ciudad: ciudad, p_correo: correo, p_pin: pin ?? null,
  });
  if (error) throw error;
}

export async function toggleIglesiaActiva(iglesiaId: string, activa: boolean, pin?: string): Promise<void> {
  const { error } = await supabase.rpc('fn_toggle_iglesia_activa', {
    p_iglesia_id: iglesiaId, p_activa: activa, p_pin: pin ?? null,
  });
  if (error) throw error;
}

export async function eliminarIglesia(iglesiaId: string, pin?: string): Promise<void> {
  const { error } = await supabase.rpc('fn_eliminar_iglesia', { p_iglesia_id: iglesiaId, p_pin: pin ?? null });
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
      redirectTo: `${obtenerUrlBase()}/completar-cuenta`,
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

export async function actualizarUsuarioRol(
  usuarioRolId: string, rol: RolSistema, iglesiaId: string | null, pin?: string
): Promise<void> {
  const { error } = await supabase.rpc('fn_actualizar_usuario_rol', {
    p_usuario_rol_id: usuarioRolId, p_rol: rol, p_iglesia_id: iglesiaId, p_pin: pin ?? null,
  });
  if (error) throw error;
}

export async function toggleUsuarioRol(usuarioRolId: string, activo: boolean, pin?: string): Promise<void> {
  const { error } = await supabase.rpc('fn_toggle_usuario_rol', {
    p_usuario_rol_id: usuarioRolId, p_activo: activo, p_pin: pin ?? null,
  });
  if (error) throw error;
}

/** KAN-154: a diferencia de toggleUsuarioRol (da de baja UN cargo puntual),
 * esto elimina la cuenta completa -- todos los cargos y personas asociadas
 * a ese usuario_id, de una sola vez. Pensado para limpieza manual de
 * cuentas de prueba. */
export async function eliminarCuentaUsuario(usuarioId: string, pin?: string): Promise<void> {
  const { error } = await supabase.rpc('fn_eliminar_cuenta_usuario', {
    p_usuario_id: usuarioId, p_pin: pin ?? null,
  });
  if (error) throw error;
}
