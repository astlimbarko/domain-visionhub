import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useReenviarInvitacionLider } from '@/hooks/useInvitacionLider';
import { useReenviarInvitacionCargo } from './useEstructuraOrganizacional';
import type { EntidadReenvioInvitacion } from './types';

interface Props {
  /** Si el responsable es todavía un placeholder de invitación (nunca
   * aceptó, invitacion_lider.estado sigue PENDIENTE) -- reenvía por el
   * mecanismo viejo (mismo que ya usaba la sección de "Invitaciones
   * pendientes", intacta y sin tocar). */
  invitacionId?: string | null;
  /** Si el responsable ya es una Persona real (aceptó, tiene cargo) pero
   * `membresia_completada = false` -- reenvía por el mecanismo nuevo
   * (KAN-263, Edge Function reenviar-invitacion-cargo). Exactamente una de
   * las dos props debe venir con valor. */
  entidad?: EntidadReenvioInvitacion;
  className?: string;
}

// Mismo estilo (texto liviano, sin fondo ni borde) que RestablecerContrasenaBoton
// -- pedido explícito del owner: el primer diseño (pastilla con fondo/borde)
// se sentía "invasivo" y desplazaba demasiado la tarjeta hacia abajo cuando
// había líder + varios sublíderes pendientes a la vez.
const ESTILO_DEFECTO =
  "relative flex shrink-0 cursor-pointer items-center gap-1 text-xs font-semibold text-amber-700 before:absolute before:-inset-x-2 before:-inset-y-3.5 before:content-[''] hover:text-amber-900 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * KAN-263: un solo botón "Reenviar invitación" para los 2 casos de
 * membresía pendiente (nunca aceptó la invitación / aceptó pero nunca
 * terminó el formulario) -- pedido explícito del owner: que se vea junto al
 * botón "Cambiar"/"Restablecer contraseña" de la entidad, no en una sección
 * aparte más abajo (así se veía hoy solo el caso viejo, y el nuevo no se
 * veía en ningún lado).
 */
export function BotonReenviarInvitacion({ invitacionId, entidad, className }: Props) {
  const reenviarVieja = useReenviarInvitacionLider();
  const reenviarNueva = useReenviarInvitacionCargo();
  const enviando = invitacionId ? reenviarVieja.isPending : reenviarNueva.isPending;

  function manejarClick() {
    if (invitacionId) {
      reenviarVieja.mutate(invitacionId, {
        onSuccess: () => toast.success('Invitación reenviada'),
        onError: () => toast.error('No se pudo reenviar'),
      });
      return;
    }
    if (!entidad) return;
    reenviarNueva.mutate(entidad, {
      onSuccess: () => toast.success('Invitación reenviada'),
      onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo reenviar'),
    });
  }

  return (
    <button type="button" disabled={enviando} onClick={manejarClick} className={className ?? ESTILO_DEFECTO}>
      <RefreshCw className="h-3 w-3" />
      {enviando ? 'Enviando…' : 'Reenviar invitación'}
    </button>
  );
}
