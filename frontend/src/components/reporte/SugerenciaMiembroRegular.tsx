import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useAgregarMiembroRegularCdp, useAsistenciasVisita } from '@/hooks/useReporte';

/** 2 o más asistencias como visita (pedido del owner, 2026-09-05, ajustado
 * el mismo día: primero se probó con "más de 2" -- 3ra visita en adelante --
 * pero el criterio real es "2 o más"). No es configurable por iglesia -- si
 * más adelante hace falta, mismo patrón que AUSENCIAS_SIMPATIZANTE (KAN-183,
 * configuracion_definicion). */
const MINIMO_ASISTENCIAS = 2;

interface Props {
  iglesiaId: string;
  casaDePazId: string;
  personaId: string;
  nombreCompleto: string;
  onPromovida: () => void;
}

/**
 * Aviso inline junto a una visita ya conocida (encontrada por la búsqueda
 * global de "Asistentes nuevos"): si ya asistió seguido, sugiere agregarla
 * como miembro regular de la CdP. Acción manual explícita con un clic -- el
 * owner ya revirtió una versión automática de esto el 2026-09-04 (ver
 * memoria fix-duplicacion-asistentes-nuevos), así que acá nada se mueve solo.
 */
export function SugerenciaMiembroRegular({ iglesiaId, casaDePazId, personaId, nombreCompleto, onPromovida }: Props) {
  const { data: asistencias = 0 } = useAsistenciasVisita(casaDePazId, personaId);
  const promover = useAgregarMiembroRegularCdp(casaDePazId);
  const [descartada, setDescartada] = useState(false);

  if (descartada || asistencias < MINIMO_ASISTENCIAS) return null;

  async function confirmar() {
    try {
      await promover.mutateAsync({ iglesiaId, personaId });
      toast.success(`${nombreCompleto} ahora es miembro regular de esta Casa de Paz`);
      onPromovida();
    } catch (e) {
      const error = e as { code?: string; message?: string } | null;
      const mensaje = typeof error?.message === 'string' ? error.message : '';
      // uq_membresia_principal_vigente: ya tiene una membresía principal
      // vigente en otra CdP -- no tiene sentido pedirle que elija, el líder
      // de la otra CdP es quien maneja ese traslado. RLS (42501): esta
      // acción solo la puede hacer el Líder de esta CdP (o un rol
      // operativo/pastor) -- un Sublíder o alguien editando un reporte ajeno
      // (Líder/Supervisor de Red, KAN-271) recibe este rechazo en vez de
      // romper silenciosamente.
      if (error?.code === '23505' && mensaje.includes('uq_membresia_principal_vigente')) {
        toast.error(`${nombreCompleto} ya es miembro de otra Casa de Paz`);
      } else if (error?.code === '42501') {
        toast.error('Solo el Líder de esta Casa de Paz puede agregar miembros regulares');
      } else {
        toast.error('No se pudo agregar como miembro regular');
      }
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-blue-500/40 bg-blue-500/10 p-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-blue-700 dark:text-blue-400">
        <strong>{nombreCompleto}</strong> ya asistió {asistencias} veces. ¿La agregás como miembro regular de esta Casa de Paz?
      </p>
      <div className="flex shrink-0 gap-1.5">
        <Button type="button" variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={() => setDescartada(true)}>
          Ahora no
        </Button>
        <Button type="button" size="sm" className="h-7 gap-1.5 px-2.5 text-xs" onClick={confirmar} disabled={promover.isPending}>
          {promover.isPending && <Spinner className="h-3 w-3" />}
          Sí, agregar
        </Button>
      </div>
    </div>
  );
}
