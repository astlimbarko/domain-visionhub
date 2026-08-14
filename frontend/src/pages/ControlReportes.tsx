import { Skeleton } from '@/components/ui/skeleton';
import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';
import { ControlReportesVista } from '@/components/reporte/ControlReportesVista';
import { useContextoActivo } from '@/hooks/useContextoActivo';

/**
 * Control de Reportes de la Red seleccionada en el ContextoActivo.
 * El backend mantiene la restriccion real mediante RPC y RLS.
 */
export function ControlReportes() {
  const { contextoActivo, cargando } = useContextoActivo();
  const redActiva = contextoActivo?.alcance === 'RED' ? contextoActivo.redId : undefined;

  if (cargando) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!redActiva) {
    return (
      <ProximamentePlaceholder
        titulo="Control de Reportes"
        descripcion="No hay una Red activa para mostrar su control de reportes."
      />
    );
  }

  return <ControlReportesVista key={redActiva} redId={redActiva} />;
}
