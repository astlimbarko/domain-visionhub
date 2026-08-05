import { useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Home, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { AZUL, VERDE } from '@/components/dashboard/DashboardUI';
import { BloqueFinanciero, agruparFinanzasPorCdp } from '@/components/finanzas/BloqueFinanciero';
import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';
import { useAuthStore } from '@/store/auth.store';
import { useCdps, useRedes } from '@/hooks/useCasasDePaz';
import { useIngresosRedPeriodo } from '@/hooks/useDashboard';
import { aISO, nombreMes } from '@/utils/calendario-fechas';

/**
 * Finanzas del Supervisor: lo que genera cada Red (todas las de la iglesia,
 * `useRedes`) y, dentro de cada una, lo que genera cada una de sus Casas de
 * Paz -- mismo cálculo (`agruparFinanzasPorCdp`) que ya usa
 * `DashboardLiderRed.tsx` para su propia Red, solo lectura (el Supervisor no
 * carga ingresos, los ve). Pedido del owner, 2026-08-04.
 */
export function FinanzasSupervisorVista() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const { data: redesTodas = [], isLoading: cargandoRedes } = useRedes(iglesiaActivaId);
  const redes = useMemo(() => redesTodas.filter((r) => r.activo), [redesTodas]);

  const [redId, setRedId] = useState<string>();
  const redActiva = redId ?? redes[0]?.id;

  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth());
  const desde = aISO(new Date(anio, mes, 1));
  const hasta = aISO(new Date(anio, mes + 1, 0));

  // Todas las CdP de la Red (no solo las que tuvieron ingresos ese mes) --
  // sin esto, una CdP sin movimientos directamente desaparecía del desglose
  // en vez de aparecer en $0 (bug real, owner 2026-08-05).
  const { data: cdpsTodas = [], isLoading: cargandoCdps } = useCdps(iglesiaActivaId, redActiva);
  const cdps = useMemo(() => cdpsTodas.filter((c) => c.activo), [cdpsTodas]);

  const { data: ingresos = [], isLoading: cargandoIngresos } = useIngresosRedPeriodo(redActiva, desde, hasta);
  const { global, porCdp } = useMemo(
    () => agruparFinanzasPorCdp(ingresos, cdps.map((c) => c.etiqueta)),
    [ingresos, cdps]
  );
  const [cdpAbierta, setCdpAbierta] = useState<string | null>(null);

  function irMesAnterior() {
    const f = new Date(anio, mes - 1, 1);
    setAnio(f.getFullYear());
    setMes(f.getMonth());
  }

  function irMesSiguiente() {
    const f = new Date(anio, mes + 1, 1);
    setAnio(f.getFullYear());
    setMes(f.getMonth());
  }

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
        titulo="Finanzas"
        descripcion="Todavía no hay Redes activas en esta iglesia, así que no hay finanzas que mostrar."
      />
    );
  }

  const cdpsConDatos = Array.from(porCdp.entries());

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {redes.length > 1 && (
          <Select value={redActiva} onValueChange={setRedId}>
            <SelectTrigger className="w-full sm:w-56 rounded-xl text-sm">
              <SelectValue placeholder="Red" />
            </SelectTrigger>
            <SelectContent>
              {redes.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={irMesAnterior} aria-label="Mes anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="w-36 text-center text-sm font-semibold tracking-tight">{nombreMes(anio, mes)}</span>
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={irMesSiguiente} aria-label="Mes siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {cargandoIngresos || cargandoCdps ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : (
        <>
          <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <TarjetaHeader icon={Wallet} color={VERDE} titulo="Contabilidad de la Red" descripcion={`Ofrendas y diezmos de todas las Casas de Paz, ${nombreMes(anio, mes)}`} />
            <div className="p-5">
              <BloqueFinanciero resumen={global} />
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <TarjetaHeader icon={Home} color={AZUL} titulo="Por Casa de Paz" descripcion="Tocá una para ver su desglose" />
            <div className="flex flex-col gap-1 p-5">
              {cdps.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Esta Red todavía no tiene Casas de Paz activas.</p>
              ) : (
                cdpsConDatos.map(([etiqueta, resumen]) => {
                  const abierta = cdpAbierta === etiqueta;
                  const totalEntradas = Array.from(resumen.total.entries());
                  return (
                    <div key={etiqueta} className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => setCdpAbierta((prev) => (prev === etiqueta ? null : etiqueta))}
                        className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm transition-colors hover:bg-muted/50"
                      >
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                          style={{ backgroundColor: `color-mix(in oklab, ${AZUL} 12%, transparent)` }}
                        >
                          <Wallet className="h-3.5 w-3.5" style={{ color: AZUL }} />
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium text-foreground">{etiqueta}</span>
                        {totalEntradas.length > 0 && (
                          <span className="shrink-0 text-[12px] font-medium text-muted-foreground">
                            {totalEntradas.map(([s, m]) => `${s} ${m.toFixed(2)}`).join(' · ')}
                          </span>
                        )}
                        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform', abierta && 'rotate-180')} />
                      </button>
                      {abierta && (
                        <div className="mb-1 rounded-xl border border-border/60 bg-muted/20 p-4">
                          <BloqueFinanciero resumen={resumen} />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
