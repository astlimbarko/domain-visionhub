import { useMemo, useState } from 'react';
import { Archive, Home, Network, UserRound } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { useAuthStore } from '@/store/auth.store';
import { useHistoricoCdpEliminadas, useRedes } from '@/hooks/useCasasDePaz';

function fmtFechaHora(fecha: string) {
  return new Date(fecha).toLocaleString('es-BO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** KAN-34: Histórico Anual de Casas de Paz eliminadas -- consultable sin
 * restaurar nada, no se mezcla con la lista de CdP activas (vive en su
 * propia pestaña, con su propia consulta contra fn_historico_cdp_eliminadas). */
export function HistoricoCdpEliminadasVista() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const { data: redes = [] } = useRedes(iglesiaActivaId);

  const anioActual = new Date().getFullYear();
  const [anio, setAnio] = useState<number>(anioActual);
  const [redId, setRedId] = useState<string>('TODAS');

  const { data: historico = [], isLoading } = useHistoricoCdpEliminadas(iglesiaActivaId, anio, redId === 'TODAS' ? undefined : redId);

  const anios = useMemo(() => Array.from({ length: 6 }, (_, i) => anioActual - i), [anioActual]);

  return (
    <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
      <TarjetaHeader
        icon={Archive}
        color="var(--muted-foreground)"
        titulo="Histórico Anual"
        descripcion="Casas de Paz eliminadas -- consulta sin restaurar."
      />
      <div className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap gap-2">
          <Select value={String(anio)} onValueChange={(v) => setAnio(Number(v))}>
            <SelectTrigger size="sm" className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {anios.map((a) => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={redId} onValueChange={setRedId}>
            <SelectTrigger size="sm" className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAS">Todas las Redes</SelectItem>
              {redes.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : historico.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay Casas de Paz eliminadas en {anio}{redId !== 'TODAS' ? ' para esa Red' : ''}.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {historico.map((h) => (
              <div key={h.id} className="flex flex-col gap-1.5 rounded-xl border border-border px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 font-medium">
                    <Home className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {h.etiqueta}
                  </p>
                  <span className="text-[12px] text-muted-foreground">Eliminada el {fmtFechaHora(h.fecha_eliminacion)}</span>
                </div>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Network className="h-3.5 w-3.5 shrink-0" /> {h.red_nombre ?? 'Sin red registrada'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <UserRound className="h-3.5 w-3.5 shrink-0" /> {h.lider_nombre ?? 'Sin líder registrado'}
                  </span>
                  {h.eliminado_por_nombre && <span>Eliminada por {h.eliminado_por_nombre}</span>}
                </p>
                {h.motivo_eliminacion && (
                  <p className="text-[13px] text-foreground"><span className="font-medium">Motivo:</span> {h.motivo_eliminacion}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
