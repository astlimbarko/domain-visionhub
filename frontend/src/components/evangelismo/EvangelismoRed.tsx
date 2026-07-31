import { useMemo, useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight, Flag, HeartHandshake, Home, Pencil, Target, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { AMBAR, AZUL, KpiMosaico, MARINO, MORADO, TEAL, VERDE } from '@/components/dashboard/DashboardUI';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { useAuthStore } from '@/store/auth.store';
import { useTasaEvangelismoRed, useEvangelismoRed, useMetasCdpRed, useAsignarMetaEvangelismo } from '@/hooks/useEvangelismo';
import { AsignarMetaRedDialog } from '@/components/evangelismo/AsignarMetaRedDialog';
import { CalendarioEvangelismo } from '@/components/evangelismo/CalendarioEvangelismo';
import { aISO, fechaLegible, nombreMes } from '@/utils/calendario-fechas';
import type { MetaCdpRed } from '@/types/evangelismo.types';

interface Props {
  redId: string;
}

/**
 * Evangelismo a nivel Red: mismo espíritu que Evangelismo.tsx (CdP) pero con
 * datos agregados de todas las CdP de la Red -- cuántas evangelizó cada una,
 * qué día, y una sección nueva para que el Líder de Red les asigne meta
 * (meta_evangelismo_asignada ya soportaba esto -- 12_evangelismo.sql -- pero
 * nada en el front la usaba).
 */
export function EvangelismoRed({ redId }: Props) {
  const personaId = useAuthStore((s) => s.personaId);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;

  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth());
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);
  const [cdpParaMeta, setCdpParaMeta] = useState<MetaCdpRed | null>(null);

  const desde = aISO(new Date(anio, mes, 1));
  const hasta = aISO(new Date(anio, mes + 1, 0));

  const { data: tasa, isLoading: cargandoTasa } = useTasaEvangelismoRed(redId, desde, hasta);
  const { data: evangelizados = [], isLoading: cargandoLista, isFetching: actualizandoLista } = useEvangelismoRed(redId, desde, hasta);
  const { data: metasCdp = [], isLoading: cargandoMetas } = useMetasCdpRed(redId);
  const asignarMeta = useAsignarMetaEvangelismo(redId);

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

  const evangelizadosDelDiaSeleccionado = useMemo(() => {
    if (!diaSeleccionado) return [];
    return evangelizados.filter((e) => e.fecha === diaSeleccionado);
  }, [evangelizados, diaSeleccionado]);

  // Agrupado por CdP -- lo que pidió el owner: "que el calendario muestre
  // qué día cada Casa de Paz salió a evangelizar", no solo una lista plana.
  const porCdpDelDiaSeleccionado = useMemo(() => {
    const grupos = new Map<string, { etiqueta: string; personas: typeof evangelizadosDelDiaSeleccionado }>();
    for (const e of evangelizadosDelDiaSeleccionado) {
      const g = grupos.get(e.casa_de_paz_id) ?? { etiqueta: e.casa_de_paz_etiqueta, personas: [] };
      g.personas.push(e);
      grupos.set(e.casa_de_paz_id, g);
    }
    return Array.from(grupos.values()).sort((a, b) => a.etiqueta.localeCompare(b.etiqueta));
  }, [evangelizadosDelDiaSeleccionado]);

  const porcentaje = tasa?.meta_total ? Math.min(tasa.tasa ?? 0, 100) : 0;

  async function handleAsignar(params: { meta: number; fechaInicio: string; fechaFin: string }) {
    if (!cdpParaMeta || !iglesiaActivaId || !personaId) return;
    await asignarMeta.mutateAsync({
      iglesiaId: iglesiaActivaId,
      casaDePazId: cdpParaMeta.casa_de_paz_id,
      asignadorId: personaId,
      meta: params.meta,
      fechaInicio: params.fechaInicio,
      fechaFin: params.fechaFin,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/20 p-3 sm:flex-row sm:items-center sm:p-2 sm:pl-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={irMesAnterior} aria-label="Mes anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="flex w-36 items-center justify-center gap-1.5 text-center text-sm font-semibold tracking-tight capitalize">
            {nombreMes(anio, mes)}
            {actualizandoLista && !cargandoLista && <Spinner className="h-3 w-3 text-muted-foreground" />}
          </span>
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={irMesSiguiente} aria-label="Mes siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader icon={Target} color={AZUL} titulo="Tasa de evangelismo de la Red" descripcion={`Todas las Casas de Paz, ${nombreMes(anio, mes)}`} />
        <div className="p-6">
          {cargandoTasa ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <KpiCard
                titulo="Evangelizados de la Red"
                valor={tasa?.evangelizados ?? 0}
                subtitulo={tasa?.meta_total ? `${tasa.tasa}% de la meta (${tasa.meta_total})` : 'Sin meta definida'}
                porcentaje={tasa?.meta_total ? porcentaje : null}
                icon={Target}
                color={AZUL}
              />
              <KpiMosaico label="Meta total de la Red" icon={Flag} color={AMBAR} sub="Suma de las metas vigentes por CdP">
                {tasa?.meta_total ?? 0}
              </KpiMosaico>
              <KpiMosaico label="Casas de Paz con meta" icon={Users} color={VERDE} sub={`de ${tasa?.cdp_total ?? 0} en total`}>
                {tasa?.cdp_con_meta ?? 0}
              </KpiMosaico>
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader icon={Flag} color={MORADO} titulo="Metas por Casa de Paz" descripcion="Asigná o revisá la meta vigente de cada una" />
        <div className="p-5">
          {cargandoMetas ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
            </div>
          ) : metasCdp.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay Casas de Paz activas en tu Red.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {metasCdp.map((c) => (
                <div key={c.casa_de_paz_id} className="flex flex-col gap-3 rounded-xl border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `color-mix(in oklab, ${MORADO} 14%, transparent)` }}>
                      <Home className="h-4 w-4" style={{ color: MORADO }} />
                    </span>
                    <p className="truncate text-sm font-bold text-foreground">{c.etiqueta}</p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    {c.meta != null ? (
                      <span className="flex items-center gap-1.5 text-sm">
                        <span className="font-bold text-foreground">{c.meta}</span>
                        <span className="text-xs text-muted-foreground">{c.origen === 'ASIGNADA' ? '(asignada)' : '(propia)'}</span>
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Sin meta</span>
                    )}
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCdpParaMeta(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                      {c.origen === 'ASIGNADA' ? 'Cambiar' : 'Asignar'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card lg:col-span-2">
          <TarjetaHeader icon={CalendarRange} color={TEAL} titulo="Calendario de evangelismo" descripcion="Días en los que alguna Casa de Paz registró evangelismo" />
          <div className="p-4">
            {cargandoLista ? (
              <Skeleton className="h-80 w-full rounded-2xl" />
            ) : (
              <CalendarioEvangelismo anio={anio} mes={mes} evangelizados={evangelizados} diaSeleccionado={diaSeleccionado} onSeleccionarDia={setDiaSeleccionado} />
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <TarjetaHeader
            icon={HeartHandshake}
            color={MARINO}
            titulo={diaSeleccionado ? fechaLegible(diaSeleccionado) : 'Por Casa de Paz'}
            descripcion={diaSeleccionado ? `${evangelizadosDelDiaSeleccionado.length} evangelizado(s)` : 'Elegí un día del calendario'}
            accion={
              diaSeleccionado && (
                <Button variant="ghost" size="sm" className="shrink-0 gap-1 text-xs" onClick={() => setDiaSeleccionado(null)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Volver
                </Button>
              )
            }
          />
          <div className="p-5">
            {!diaSeleccionado && <p className="text-sm text-muted-foreground">Elegí un día en el calendario para ver qué Casa de Paz salió a evangelizar.</p>}
            {diaSeleccionado && porCdpDelDiaSeleccionado.length === 0 && <p className="text-sm text-muted-foreground">Nadie registrado este día.</p>}
            {diaSeleccionado && porCdpDelDiaSeleccionado.length > 0 && (
              <div className="flex flex-col gap-4">
                {porCdpDelDiaSeleccionado.map((g) => (
                  <div key={g.etiqueta} className="flex flex-col gap-2">
                    <p className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
                      <Home className="h-3.5 w-3.5" style={{ color: MARINO }} /> {g.etiqueta}
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">{g.personas.length}</span>
                    </p>
                    {g.personas.map((e) => (
                      <p key={e.id} className="pl-5 text-sm text-foreground">{e.nombre_completo}</p>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <AsignarMetaRedDialog
        open={!!cdpParaMeta}
        onOpenChange={(open) => !open && setCdpParaMeta(null)}
        cdp={cdpParaMeta}
        asignando={asignarMeta.isPending}
        onAsignar={handleAsignar}
      />
    </div>
  );
}
