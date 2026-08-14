import {
  obtenerCorreoActual,
  obtenerIglesiasAccesibles,
  obtenerPersonaActual,
  soySuperAdmin,
} from './auth.service';
import { obtenerMiMembresiaIncompleta } from './membresia-extendida.service';

/**
 * Arma los datos de sesión de la app a partir de un usuario ya autenticado en
 * Supabase (password o Google). Compartido por Login y AuthCallback para no
 * duplicar este Promise.all en cada punto de entrada.
 *
 * KAN-126 (2026-08-11): antes solo se consultaba fn_mi_invitacion_pendiente
 * (acotado a invitacion_lider/invitacion_departamento). Se generaliza a
 * fn_mi_membresia_incompleta, que delega en el mismo chequeo de invitación
 * primero (comportamiento existente sin cambios) y solo agrega el caso de
 * cualquier usuario_rol vigente sin Persona (Q-8) -- ej. Pastor/Supervisor
 * asignado directo desde Administración, sin invitación formal.
 */
export async function construirSesionDesdeAuth() {
  const [persona, iglesias, esSuperAdmin, correo, membresiaPendiente] = await Promise.all([
    obtenerPersonaActual(),
    obtenerIglesiasAccesibles(),
    soySuperAdmin(),
    obtenerCorreoActual(),
    obtenerMiMembresiaIncompleta(),
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
