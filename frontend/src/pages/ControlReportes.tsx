import { useState } from 'react';
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
import { useMisRoles } from '@/hooks/useDashboard';

/**
 * Control de Reportes del Líder de Red: vista supervisora de solo lectura sobre
 * las Casas de Paz de su(s) Red(es). Si lidera varias redes, un selector elige
 * cuál mirar. La restricción de alcance la garantiza el backend (RLS + los
 * datos que devuelve `fn_mis_roles_dashboard`).
 */
export function ControlReportes() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const { data: roles, isLoading } = useMisRoles(iglesiaActivaId);
  const redes = roles?.redes_lider ?? [];

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
        titulo="Control de Reportes"
        descripcion="Todavía no tenés una Red asignada, así que no hay Casas de Paz que supervisar."
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
