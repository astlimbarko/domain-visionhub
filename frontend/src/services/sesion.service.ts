import {
  obtenerCorreoActual,
  obtenerIglesiasAccesibles,
  obtenerPersonaActual,
  soySuperAdmin,
} from './auth.service';
import { obtenerMiInvitacionPendiente } from './invitacion-lider.service';

/**
 * Arma los datos de sesión de la app a partir de un usuario ya autenticado en
 * Supabase (password o Google). Compartido por Login y AuthCallback para no
 * duplicar este Promise.all en cada punto de entrada.
 */
export async function construirSesionDesdeAuth() {
  const [persona, iglesias, esSuperAdmin, correo, membresiaPendiente] = await Promise.all([
    obtenerPersonaActual(),
    obtenerIglesiasAccesibles(),
    soySuperAdmin(),
    obtenerCorreoActual(),
    obtenerMiInvitacionPendiente(),
  ]);
  return {
    personaId: persona?.id ?? null,
    nombreCompleto: persona?.nombre_completo ?? null,
    correo,
    iglesias,
    esSuperAdmin,
    membresiaPendiente,
  };
}
