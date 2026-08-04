import { useEffect, useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';
import { HistorialAsistencia as HistorialAsistenciaSeccion } from '@/components/reporte/HistorialAsistencia';
import { useAuthStore } from '@/store/auth.store';
import { useRedes, useCdps } from '@/hooks/useCasasDePaz';

/**
 * "Historial de Asistencia" del Supervisor: mismo criterio que
 * `HistorialReportesSupervisorVista` -- se agrupa por Red (todas las de la
 * iglesia, `useRedes`), y dentro de cada Red se elige una Casa de Paz para
 * ver su historial real, reusando `HistorialAsistenciaSeccion` tal cual la
 * usa el Líder/Sublíder de CdP (pedido del owner, 2026-08-04).
 */
export function HistorialAsistenciaSupervisorVista() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const { data: redesTodas = [], isLoading: cargandoRedes } = useRedes(iglesiaActivaId);
  const redes = useMemo(() => redesTodas.filter((r) => r.activo), [redesTodas]);

  const [redId, setRedId] = useState<string>();
  const redActiva = redId ?? redes[0]?.id;

  const { data: cdpsTodas = [], isLoading: cargandoCdps } = useCdps(iglesiaActivaId, redActiva);
  const cdps = useMemo(() => cdpsTodas.filter((c) => c.activo), [cdpsTodas]);

  const [casaDePazId, setCasaDePazId] = useState<string>();
  const cdpActiva = casaDePazId ?? cdps[0]?.id;

  // Al cambiar de Red, la CdP elegida de la Red anterior ya no aplica.
  useEffect(() => { setCasaDePazId(undefined); }, [redActiva]);

  if (cargandoRedes) {
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
        titulo="Historial de Asistencia"
        descripcion="Todavía no hay Redes activas en esta iglesia, así que no hay historial que mostrar."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        {redes.length > 1 && (
          <Select value={redActiva} onValueChange={setRedId}>
            <SelectTrigger className="w-full rounded-2xl sm:w-56">
              <SelectValue placeholder="Elegí una red" />
            </SelectTrigger>
            <SelectContent>
              {redes.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {!cargandoCdps && cdps.length > 1 && (
          <Select value={cdpActiva} onValueChange={setCasaDePazId}>
            <SelectTrigger className="w-full rounded-2xl sm:w-56">
              <SelectValue placeholder="Elegí una Casa de Paz" />
            </SelectTrigger>
            <SelectContent>
              {cdps.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.etiqueta}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {cargandoCdps ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : cdps.length === 0 ? (
        <ProximamentePlaceholder
          titulo="Historial de Asistencia"
          descripcion="Esta Red todavía no tiene Casas de Paz activas."
        />
      ) : (
        <HistorialAsistenciaSeccion key={cdpActiva} casaDePazId={cdpActiva} />
      )}
    </div>
  );
}
