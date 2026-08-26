import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useReenviarInvitacionCargo } from './useEstructuraOrganizacional';
import type { EntidadReenvioInvitacion } from './types';

interface Props {
  entidad: EntidadReenvioInvitacion;
}

/**
 * KAN: aparece SOLO cuando el responsable de una entidad (Red, Casa de Paz,
 * Departamento, Pastor/Supervisor) todavía tiene la membresía incompleta --
 * sin importar si invitacion_lider sigue "pendiente" (desde KAN-252 esa fila
 * pasa a COMPLETADA en el primer login, antes de que la persona termine el
 * formulario, así que el "Reenviar" de la sección de invitaciones pendientes
 * deja de alcanzar para este caso). Pedido explícito del owner: un SEGUNDO
 * BOTÓN al lado de "Cambiar"/"Asignar" (mismo tamaño), no un renglón de
 * texto aparte -- así no agrega una fila nueva a la ficha.
 */
export function BotonReenviarInvitacion({ entidad }: Props) {
  const reenviar = useReenviarInvitacionCargo();

  return (
    <button
      type="button"
      title="Aún no completó su membresía -- reenviar invitación/recordatorio"
      disabled={reenviar.isPending}
      onClick={() =>
        reenviar.mutate(entidad, {
          onSuccess: () => toast.success('Invitación reenviada'),
          onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo reenviar'),
        })
      }
      className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <RefreshCw className="h-3 w-3" />
      {reenviar.isPending ? 'Enviando…' : 'Reenviar'}
    </button>
  );
}
