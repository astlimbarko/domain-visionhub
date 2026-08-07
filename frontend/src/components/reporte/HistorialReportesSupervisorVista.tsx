import { useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';
import { ControlReportesVista } from '@/components/reporte/ControlReportesVista';
import { useAuthStore } from '@/store/auth.store';
import { useRedes } from '@/hooks/useCasasDePaz';

/**
 * "Historial de Reportes" del Supervisor: mismo Control de Reportes que ya
 * tiene el Líder de Red (grilla mensual por Casa de Paz, en la fecha de
 * reunión de cada una), pero con un selector de Red que recorre TODAS las
 * redes de la iglesia (`useRedes`), no solo las que el Supervisor lidera
 * personalmente -- a diferencia de `ControlReportes.tsx` (Líder de Red), que
 * usa `useMisRoles().redes_lider`. `ControlReportesVista` no cambia: ya es
 * genérica por `redId`, sin nada hardcodeado a "mi propia red" (pedido del
 * owner, 2026-08-04).
 */
export function HistorialReportesSupervisorVista() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const { data: redesTodas = [], isLoading } = useRedes(iglesiaActivaId);
  const redes = useMemo(() => redesTodas.filter((r) => r.activo), [redesTodas]);

  const [redId, setRedId] = useState<string>();
  const redActiva = redId ?? redes[0]?.id;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (redes.length === 0) {
    return (
      <ProximamentePlaceholder
        titulo="Historial de Reportes"
        descripcion="Todavía no hay Redes activas en esta iglesia, así que no hay Casas de Paz que supervisar."
      />
    );
  }

  const selectorRed = redes.length > 1 && (
    <Select value={redActiva} onValueChange={setRedId}>
      <SelectTrigger className="h-9 w-44 rounded-xl text-sm">
        <SelectValue placeholder="Elegí una red" />
      </SelectTrigger>
      <SelectContent>
        {redes.map((r) => (
          <SelectItem key={r.id} value={r.id}>
            {r.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return redActiva ? <ControlReportesVista key={redActiva} redId={redActiva} accionExtra={selectorRed} /> : null;
}
