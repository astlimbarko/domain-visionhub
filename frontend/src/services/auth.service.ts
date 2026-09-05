import { supabase } from './supabase';
import { ROUTES } from '@/utils/constants';
import type { IglesiaAccesible } from '@/types/auth.types';

export async function iniciarSesion(correo: string, contrasena: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: correo,
    password: contrasena,
  });
  if (error) throw error;
  return data;
}

/** Redirige a Google y vuelve a AuthCallback, que termina de armar la sesión de la app. */
export async function iniciarSesionConGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}${ROUTES.AUTH_CALLBACK}` },
  });
  if (error) throw error;
}

/**
 * KAN-144/146: vincula Google a la sesión temporal que ya abrió el link de
 * invitación por correo -- a diferencia de `iniciarSesionConGoogle`
 * (signInWithOAuth, un login nuevo), esto usa linkIdentity porque la persona
 * YA está autenticada (sesión de invitación) y lo que se busca es agregarle
 * el proveedor Google a ESA MISMA cuenta, no crear/loguear una distinta.
 * Requiere enable_manual_linking = true en la config de Supabase Auth.
 */
export async function vincularGoogleAInvitacion() {
  const { error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}${ROUTES.AUTH_CALLBACK}` },
  });
  if (error) throw error;
}

export async function cerrarSesion() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function solicitarRecuperacionContrasena(correo: string, redirectTo: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(correo, { redirectTo });
  if (error) throw error;
}

export async function establecerContrasena(nuevaContrasena: string) {
  const { error } = await supabase.auth.updateUser({ password: nuevaContrasena });
  if (error) throw error;
}

/**
 * Bug real 2026-08-27: si la contraseña nueva es igual a la anterior,
 * GoTrue rechaza el cambio (`code: "same_password"`) pero las 2 pantallas que
 * llaman a establecerContrasena (Cuenta.tsx, CompletarCuenta.tsx) mostraban
 * un "Error"/"No se pudo guardar" genérico, sin decir por qué -- la persona
 * no tenía forma de saber que tenía que elegir una contraseña distinta.
 */
export function mensajeErrorContrasena(error: unknown, generico: string): string {
  const codigo = (error as { code?: string })?.code;
  const mensaje = error instanceof Error ? error.message : '';
  if (codigo === 'same_password' || /different from the old password/i.test(mensaje)) {
    return 'La contraseña nueva tiene que ser distinta a la anterior.';
  }
  return generico;
}

export async function obtenerCorreoActual(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? null;
}

/**
 * KAN-278: cuenta con una contraseña temporal puesta por un admin
 * (`establecer-contrasena-temporal`) -- app_metadata solo lo puede tocar el
 * service role, nunca el propio usuario, así que no puede sacárselo con
 * `updateUser`.
 */
export async function obtenerDebeCambiarContrasena(): Promise<boolean> {
  const { data } = await supabase.auth.getUser();
  return data.user?.app_metadata?.debe_cambiar_contrasena === true;
}

/** Apaga el flag de arriba en la propia cuenta, justo después de establecer
 * una contraseña real vía `establecerContrasena`. */
export async function confirmarCambioContrasena(): Promise<void> {
  const { error } = await supabase.functions.invoke('confirmar-cambio-contrasena');
  if (error) throw error;
}

export async function obtenerIglesiasAccesibles(): Promise<IglesiaAccesible[]> {
  const { data, error } = await supabase.rpc('fn_mis_iglesias_detalle');
  if (error) throw error;
  return (data ?? []) as IglesiaAccesible[];
}

export async function soySuperAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('fn_es_super_admin');
  if (error) throw error;
  return data === true;
}

export async function obtenerMiTitulo(iglesiaId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('fn_mi_titulo', { p_iglesia_id: iglesiaId });
  if (error) throw error;
  return data;
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
