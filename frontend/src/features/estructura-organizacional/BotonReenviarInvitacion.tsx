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
 * deja de alcanzar para este caso). Deliberadamente compacto -- un solo
 * renglón de texto, no un panel nuevo, para no invadir espacio en fichas que
 * ya tienen varias secciones.
 */
export function BotonReenviarInvitacion({ entidad }: Props) {
  const reenviar = useReenviarInvitacionCargo();

  return (
    <p className="mt-1 flex items-center gap-2 text-xs">
      <span className="text-amber-700">Aún no completó su membresía</span>
      <button
        type="button"
        disabled={reenviar.isPending}
        onClick={() =>
          reenviar.mutate(entidad, {
            onSuccess: () => toast.success('Invitación reenviada'),
            onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo reenviar'),
          })
        }
        className="relative flex shrink-0 cursor-pointer items-center gap-1 font-semibold text-blue-700 before:absolute before:-inset-x-2 before:-inset-y-2 before:content-[''] hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw className="h-3 w-3" />
        {reenviar.isPending ? 'Enviando…' : 'Reenviar'}
      </button>
    </p>
  );
}
