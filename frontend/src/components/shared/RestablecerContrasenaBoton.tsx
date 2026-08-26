import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { solicitarRecuperacionContrasena } from '@/services/auth.service';
import { obtenerUrlBase } from '@/utils/app-url';
import { ROUTES } from '@/utils/constants';

interface Props {
  correo: string;
  className?: string;
}

const ESTILO_DEFECTO =
  "relative flex shrink-0 cursor-pointer items-center gap-1 text-xs font-semibold text-slate-500 before:absolute before:-inset-x-2 before:-inset-y-3.5 before:content-[''] hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Botón chico reusable para reenviarle el enlace de restablecer contraseña a
 * una cuenta ya confirmada -- mismo mecanismo (resetPasswordForEmail) que ya
 * usan Administracion.tsx y GestionEstructuraVista.tsx, pensado para los
 * cargos asignados desde el Constructor (Red/Casa de Paz/Departamento),
 * donde antes no había forma de ayudar a alguien que perdió su contraseña.
 */
export function RestablecerContrasenaBoton({ correo, className }: Props) {
  const [enviando, setEnviando] = useState(false);

  function manejarClick() {
    setEnviando(true);
    solicitarRecuperacionContrasena(correo, `${obtenerUrlBase()}${ROUTES.COMPLETAR_CUENTA}`)
      .then(() => toast.success(`Enlace de restablecimiento enviado a ${correo}`))
      .catch(() => toast.error('No se pudo enviar el enlace'))
      .finally(() => setEnviando(false));
  }

  return (
    <button type="button" disabled={enviando} onClick={manejarClick} className={className ?? ESTILO_DEFECTO}>
      <KeyRound className="h-3 w-3" />
      {enviando ? 'Enviando…' : 'Restablecer contraseña'}
    </button>
  );
}
