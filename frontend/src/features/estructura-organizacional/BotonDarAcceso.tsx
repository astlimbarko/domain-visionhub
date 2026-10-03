import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { useDarAccesoPersona } from '@/hooks/useInvitacionLider';

/**
 * 2026-10-03: "Dar acceso" a un responsable (líder/sublíder) que YA existe en
 * el sistema pero NO tiene cuenta. Le crea la cuenta con contraseña 12345678
 * (la cambia al entrar) vinculándola a la persona existente -- sin duplicar.
 * Si la persona no tiene correo cargado, se pide uno acá mismo.
 *
 * Estilo liviano (texto, sin fondo) igual que RestablecerContrasenaBoton /
 * BotonReenviarInvitacion, para que conviva en la misma fila.
 */
const ESTILO_DEFECTO =
  "relative flex shrink-0 cursor-pointer items-center gap-1 text-[11px] font-semibold text-emerald-700 before:absolute before:-inset-2 before:content-[''] hover:text-emerald-900 disabled:cursor-not-allowed disabled:opacity-50";

export function BotonDarAcceso({
  personaId,
  correo,
  className,
}: {
  personaId: string;
  /** Correo de la persona (si ya lo tiene cargado). Si no, se pide uno. */
  correo?: string | null;
  className?: string;
}) {
  const darAcceso = useDarAccesoPersona();
  const [pidiendoCorreo, setPidiendoCorreo] = useState(false);
  const [correoNuevo, setCorreoNuevo] = useState('');

  function ejecutar(correoFinal: string) {
    darAcceso.mutate(
      { personaId, correo: correoFinal },
      {
        onSuccess: () => {
          toast.success('Acceso creado. Contraseña: 12345678 (la cambia al entrar).');
          setPidiendoCorreo(false);
          setCorreoNuevo('');
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo dar acceso'),
      },
    );
  }

  function manejarClick() {
    const c = correo?.trim();
    if (c) {
      ejecutar(c);
    } else {
      setPidiendoCorreo(true);
    }
  }

  if (pidiendoCorreo) {
    return (
      <div className="flex items-center gap-1.5">
        <Input
          type="email"
          autoFocus
          placeholder="correo@ejemplo.com"
          value={correoNuevo}
          onChange={(e) => setCorreoNuevo(e.target.value)}
          className="h-7 w-44 text-xs"
        />
        <button
          type="button"
          disabled={darAcceso.isPending || !correoNuevo.trim()}
          onClick={() => ejecutar(correoNuevo.trim().toLowerCase())}
          className="relative shrink-0 cursor-pointer text-[11px] font-semibold text-emerald-700 before:absolute before:-inset-2 before:content-[''] hover:text-emerald-900 disabled:opacity-50"
        >
          {darAcceso.isPending ? 'Creando…' : 'Crear acceso'}
        </button>
        <button
          type="button"
          onClick={() => { setPidiendoCorreo(false); setCorreoNuevo(''); }}
          className="relative shrink-0 cursor-pointer text-[11px] font-semibold text-slate-400 before:absolute before:-inset-2 before:content-[''] hover:text-slate-600"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button type="button" disabled={darAcceso.isPending} onClick={manejarClick} className={className ?? ESTILO_DEFECTO}>
      <KeyRound className="h-3 w-3" />
      {darAcceso.isPending ? 'Creando…' : 'Dar acceso'}
    </button>
  );
}
