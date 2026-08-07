import { useMemo, useState } from 'react';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarRange, ChevronLeft, ChevronRight, Flag, Heart, HeartHandshake, Home, MapPin, Pencil, Target, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TarjetaHeader, GRADIENTE_HERO, DEGRADADO_IDENTIDAD } from '@/components/shared/SeccionPerfil';
import { KpiMosaico } from '@/components/dashboard/DashboardUI';
import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';
import { AsignarMetaRedDialog } from '@/components/evangelismo/AsignarMetaRedDialog';
import { CalendarioEvangelismo } from '@/components/evangelismo/CalendarioEvangelismo';
import { PersonaNombreLink } from '@/components/personas/PersonaNombreLink';
import { EVANGELISMO_COLOR } from '@/utils/evangelismo-colores';
import { asignarMetaRedEvangelismo, obtenerEvangelismoRed, obtenerMetaRedAsignada, obtenerTasaEvangelismoRed } from '@/services/evangelismo.service';
import { useAuthStore } from '@/store/auth.store';
import { useRedes, useCdpsIglesia } from '@/hooks/useCasasDePaz';
import { useMetaRedAsignada } from '@/hooks/useEvangelismo';
import { aISO, fechaLegible, nombreMes } from '@/utils/calendario-fechas';
import type { RedResumen } from '@/types/casas-de-paz.types';
import type { EvangelizadoRed, MetaCdpRed } from '@/types/evangelismo.types';

const { AZUL, VERDE, MORADO, AMARILLO, CELESTE } = EVANGELISMO_COLOR;

/** Sentinel para distinguir "asignar a todas las Redes" de una Red real en el mismo diálogo. */
const ID_TODAS_LAS_REDES = '__TODAS_REDES__';

/** Una fila del modal "Metas por Red" -- cada Red tiene su propio hook de lectura
 * (`useMetaRedAsignada`), así que vive en su propio componente. */
function RedMetaFila({ red, onEditar }: { red: RedResumen; onEditar: (item: MetaCdpRed) => void }) {
  const { data: metaRed, isLoading } = useMetaRedAsignada(red.id);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `color-mix(in oklab, ${AZUL} 14%, transparent)` }}>
          <Heart className="h-4 w-4" style={{ color: AZUL }} />
        </span>
        <p className="truncate text-sm font-bold text-foreground">{red.nombre}</p>
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        {isLoading ? (
          <Skeleton className="h-4 w-24 rounded" />
        ) : metaRed ? (
          <span className="text-sm">
            <span className="font-bold text-foreground">{metaRed.meta}</span>
            <span className="ml-1.5 text-xs text-muted-foreground">vigente hasta {fechaLegible(metaRed.fecha_fin)}</span>
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Sin meta</span>
        )}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => onEditar({ casa_de_paz_id: red.id, etiqueta: red.nombre, meta: metaRed?.meta ?? null, origen: metaRed ? 'ASIGNADA_RED' : null })}
        >
          <Pencil className="h-3.5 w-3.5" />
          {metaRed ? 'Cambiar' : 'Asignar'}
        </Button>
      </div>
    </div>
  );
}

/**
 * Evangelismo del Supervisor: panel único iglesia-wide, rediseñado a pedido
 * exacto del owner (2026-08-06) -- header con acción "Asignar metas", barras
 * de "Metas de la Red" (una por Red, editables en un modal), 4 KPI
 * agregados de toda la iglesia (Total Meta, Evangelizados, Avance, Casas
 * Activas) y un Calendario + Detalle del día agregando la actividad de
 * TODAS las Redes -- ya no hay que elegir una Red para ver algo, todo el
 * panel es de la iglesia entera.
 *
 * "Metas de la Red" son las que el Supervisor le asigna a cada Red
 * (`meta_evangelismo_asignada.red_id`, no la "Meta Global" -- suma de metas
 * por CdP -- que sigue existiendo tal cual dentro de cada `EvangelismoRed.tsx`
 * cuando el Líder de Red o el propio Supervisor entran al detalle de una
 * Casa de Paz puntual). Tienen prioridad por sobre las metas CdP-específicas
 * (fn_meta_efectiva, 104_fix_prioridad_meta_supervisor.sql).
 */
export function EvangelismoSupervisorVista() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const personaId = useAuthStore((s) => s.personaId);
  const queryClient = useQueryClient();

  const { data: redesTodas = [], isLoading: cargandoRedes } = useRedes(iglesiaActivaId);
  const redes = useMemo(() => redesTodas.filter((r) => r.activo), [redesTodas]);
  const { data: cdpsTodas = [], isLoading: cargandoCdps } = useCdpsIglesia(iglesiaActivaId);
  const cdps = useMemo(() => cdpsTodas.filter((c) => c.activo), [cdpsTodas]);
  const cdpPorId = useMemo(() => new Map(cdps.map((c) => [c.id, c])), [cdps]);

  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth());
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);
  const [modalMetasAbierto, setModalMetasAbierto] = useState(false);
  const [redParaMeta, setRedParaMeta] = useState<MetaCdpRed | null>(null);
  const [bulkAsignando, setBulkAsignando] = useState(false);

  const desde = aISO(new Date(anio, mes, 1));
  const hasta = aISO(new Date(anio, mes + 1, 0));

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

  // Un solo resumen por Red (meta vigente + tasa + evangelizados del mes),
  // para armar tanto las barras como los 4 KPI y el calendario agregado --
  // sin esto haría falta un hook por dato y por Red (3 × N consultas en vez
  // de N).
  const resumenPorRed = useQueries({
    queries: redes.map((r) => ({
      queryKey: ['evangelismo', 'supervisor-resumen-red', r.id, desde, hasta],
      queryFn: async () => {
        const [meta, tasa, evangelizados] = await Promise.all([
          obtenerMetaRedAsignada(r.id),
          obtenerTasaEvangelismoRed(r.id, desde, hasta),
          obtenerEvangelismoRed(r.id, desde, hasta),
        ]);
        return { redId: r.id, meta, tasa, evangelizados };
      },
      enabled: !!r.id,
    })),
  });
  const cargandoResumen = resumenPorRed.some((q) => q.isLoading);
  const filas = useMemo(() => resumenPorRed.map((q) => q.data).filter((d): d is NonNullable<typeof d> => !!d), [resumenPorRed]);

  const totalMeta = filas.reduce((s, f) => s + (f.meta?.meta ?? 0), 0);
  const totalEvangelizados = filas.reduce((s, f) => s + Number(f.tasa?.evangelizados ?? 0), 0);
  const avance = totalMeta > 0 ? Math.round((totalEvangelizados / totalMeta) * 1000) / 10 : null;

  const evangelizadosTodos = useMemo<EvangelizadoRed[]>(() => filas.flatMap((f) => f.evangelizados), [filas]);

  // Agrupado por CdP el día elegido, con su líder -- lo que pidió el owner
  // ("Detalle del día": Casa de Paz, cantidad, Líder), no una lista plana de personas.
  const grupoDelDia = useMemo(() => {
    if (!diaSeleccionado) return [];
    const conteos = new Map<string, { etiqueta: string; cantidad: number }>();
    for (const e of evangelizadosTodos) {
      if (e.fecha !== diaSeleccionado) continue;
      const g = conteos.get(e.casa_de_paz_id) ?? { etiqueta: e.casa_de_paz_etiqueta, cantidad: 0 };
      g.cantidad += 1;
      conteos.set(e.casa_de_paz_id, g);
    }
    return Array.from(conteos.entries())
      .map(([casaDePazId, g]) => ({ casaDePazId, etiqueta: g.etiqueta, cantidad: g.cantidad, liderId: cdpPorId.get(casaDePazId)?.lider_id ?? null, liderNombre: cdpPorId.get(casaDePazId)?.lider_nombre ?? null }))
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta));
  }, [evangelizadosTodos, diaSeleccionado, cdpPorId]);

  const asignarMetaRed = useMutation({
    mutationFn: (params: { redId: string; meta: number; fechaInicio: string; fechaFin: string }) =>
      asignarMetaRedEvangelismo({
        iglesiaId: iglesiaActivaId as string,
        redId: params.redId,
        asignadorId: personaId as string,
        meta: params.meta,
        fechaInicio: params.fechaInicio,
        fechaFin: params.fechaFin,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evangelismo', 'red-meta-asignada'] });
      queryClient.invalidateQueries({ queryKey: ['evangelismo', 'red-tasa'] });
      queryClient.invalidateQueries({ queryKey: ['evangelismo', 'red-metas'] });
      queryClient.invalidateQueries({ queryKey: ['evangelismo', 'supervisor-resumen-red'] });
    },
  });

  async function handleAsignar(params: { meta: number; fechaInicio: string; fechaFin: string }) {
    if (!redParaMeta || !iglesiaActivaId || !personaId) return;

    if (redParaMeta.casa_de_paz_id === ID_TODAS_LAS_REDES) {
      setBulkAsignando(true);
      try {
        const resultados = await Promise.allSettled(
          redes.map((r) => asignarMetaRed.mutateAsync({ redId: r.id, meta: params.meta, fechaInicio: params.fechaInicio, fechaFin: params.fechaFin }))
        );
        const fallidas = resultados.filter((r) => r.status === 'rejected').length;
        if (fallidas === resultados.length) {
          toast.error('No se pudo asignar la meta a ninguna Red (todas ya tenían una meta que se solapa en esas fechas)');
          throw new Error('BULK_FALLO_TOTAL');
        }
        if (fallidas > 0) {
          toast.error(`Se asignó a ${resultados.length - fallidas} de ${resultados.length} Redes (${fallidas} ya tenían una meta que se solapa en esas fechas)`);
        } else {
          toast.success(`Meta de ${params.meta} asignada a las ${resultados.length} Redes`);
        }
      } finally {
        setBulkAsignando(false);
      }
      return;
    }

    try {
      await asignarMetaRed.mutateAsync({ redId: redParaMeta.casa_de_paz_id, meta: params.meta, fechaInicio: params.fechaInicio, fechaFin: params.fechaFin });
      toast.success(`Meta asignada a ${redParaMeta.etiqueta}`);
    } catch (e) {
      const error = e as { message?: string } | null;
      const mensaje = typeof error?.message === 'string' ? error.message : '';
      if (mensaje.includes('excl_meta_asignada_red_solapada') || mensaje.includes('exclusion')) {
        toast.error('Ya hay una meta asignada para esa Red en un rango que se solapa');
      } else {
        toast.error('No se pudo asignar la meta');
      }
      throw e;
    }
  }

  if (cargandoRedes) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-32 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (redes.length === 0) {
    return (
      <ProximamentePlaceholder
        titulo="Evangelismo"
        descripcion="Todavía no hay Redes activas en esta iglesia, así que no hay evangelismo que mostrar."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-xl shadow-[var(--brand-navy)]/25 sm:p-8" style={{ background: GRADIENTE_HERO }}>
        <div className="pointer-events-none absolute -top-16 -right-10 h-52 w-52 rounded-full bg-white/15 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-lg shadow-black/25" style={{ background: DEGRADADO_IDENTIDAD }}>
              <HeartHandshake className="h-7 w-7 text-white" />
            </div>
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Evangelismo</h1>
              <p className="text-[13px] text-white/70">Gestioná las metas y el seguimiento mensual</p>
            </div>
          </div>
          <Button onClick={() => setModalMetasAbierto(true)} className="h-10 shrink-0 gap-2 rounded-xl border border-white/25 bg-white/10 px-4 text-white backdrop-blur-sm hover:bg-white/20">
            <Flag className="h-4 w-4" />
            Asignar metas
          </Button>
        </div>
      </div>

      {/* ── Navegación de mes ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-2 self-center rounded-2xl border border-border/60 bg-muted/20 p-2 sm:self-start sm:pl-4">
        <span className="w-36 text-center text-sm font-semibold tracking-tight capitalize">{nombreMes(anio, mes)}</span>
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={irMesAnterior} aria-label="Mes anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={irMesSiguiente} aria-label="Mes siguiente">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* ── 4 KPI agregados de toda la iglesia ───────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiMosaico label="Total Meta" icon={Flag} color={AZUL}>{cargandoResumen ? '—' : totalMeta}</KpiMosaico>
        <KpiMosaico label="Evangelizados" icon={HeartHandshake} color={VERDE}>{cargandoResumen ? '—' : totalEvangelizados}</KpiMosaico>
        <KpiMosaico label="Avance" icon={Target} color={AMARILLO}>{cargandoResumen || avance == null ? '—' : `${avance}%`}</KpiMosaico>
        <KpiMosaico label="Casas Activas" icon={Home} color={CELESTE}>{cargandoCdps ? '—' : cdps.length}</KpiMosaico>
      </div>

      {/* ── Metas de la Red: barras de PROGRESO (se llenan a medida que evangelizan) + editar ── */}
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader icon={Flag} color={MORADO} titulo="Metas de la Red" descripcion="Avance del mes contra la meta que le asignaste a cada Red -- tocá una barra o Editar para cambiarla" />
        <div className="flex flex-col gap-5 p-6">
          {cargandoResumen ? (
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${redes.length}, minmax(0, 1fr))` }}>
              {redes.map((r) => <Skeleton key={r.id} className="h-36 w-full rounded-xl" />)}
            </div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${redes.length}, minmax(0, 1fr))` }}>
              {redes.map((r) => {
                const fila = filas.find((f) => f.redId === r.id);
                const metaValor = fila?.meta?.meta ?? 0;
                const evangelizadosRed = Number(fila?.tasa?.evangelizados ?? 0);
                const tieneMeta = metaValor > 0;
                const progresoPct = tieneMeta ? Math.min(100, Math.round((evangelizadosRed / metaValor) * 100)) : 0;
                const cumplida = tieneMeta && evangelizadosRed >= metaValor;
                return (
                  <button
                    type="button"
                    key={r.id}
                    className="flex flex-col items-center gap-2 rounded-xl p-1 transition-colors hover:bg-muted/40"
                    title={tieneMeta ? `${r.nombre}: ${evangelizadosRed} de ${metaValor} (${progresoPct}%)` : `${r.nombre}: sin meta asignada`}
                    onClick={() => setRedParaMeta({ casa_de_paz_id: r.id, etiqueta: r.nombre, meta: fila?.meta?.meta ?? null, origen: fila?.meta ? 'ASIGNADA_RED' : null })}
                  >
                    <span className="text-sm font-bold tabular-nums text-foreground">
                      {tieneMeta ? `${evangelizadosRed}/${metaValor}` : '—'}
                    </span>
                    <div className="flex h-28 w-full items-end overflow-hidden rounded-lg bg-muted/50">
                      <div
                        className="w-full rounded-t-md transition-[height]"
                        style={{ height: tieneMeta ? `${Math.max(progresoPct, evangelizadosRed > 0 ? 6 : 0)}%` : '4%', background: cumplida ? VERDE : AZUL, opacity: tieneMeta ? 1 : 0.3 }}
                      />
                    </div>
                    <span className="w-full truncate text-center text-[11px] font-medium text-muted-foreground">
                      {r.nombre}{tieneMeta && ` · ${progresoPct}%`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <Button variant="outline" size="sm" className="mx-auto gap-1.5" onClick={() => setModalMetasAbierto(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Editar metas
          </Button>
        </div>
      </section>

      {/* ── Calendario + Detalle del día, agregado de toda la iglesia ────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card lg:col-span-2">
          <TarjetaHeader icon={CalendarRange} color={CELESTE} titulo="Calendario" descripcion="Días en los que alguna Casa de Paz registró evangelismo" />
          <div className="p-4">
            {cargandoResumen ? (
              <Skeleton className="h-80 w-full rounded-2xl" />
            ) : (
              <CalendarioEvangelismo anio={anio} mes={mes} evangelizados={evangelizadosTodos} diaSeleccionado={diaSeleccionado} onSeleccionarDia={setDiaSeleccionado} />
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <TarjetaHeader
            icon={HeartHandshake}
            color={AZUL}
            titulo={diaSeleccionado ? fechaLegible(diaSeleccionado) : 'Detalle del día'}
            descripcion={diaSeleccionado ? `${grupoDelDia.length} Casa${grupoDelDia.length === 1 ? '' : 's'} de Paz con actividad` : 'Elegí un día del calendario'}
            accion={
              diaSeleccionado && (
                <Button variant="ghost" size="sm" className="shrink-0 gap-1 text-xs" onClick={() => setDiaSeleccionado(null)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Volver
                </Button>
              )
            }
          />
          <div className="flex flex-col gap-2 p-5">
            {!diaSeleccionado && <p className="text-sm text-muted-foreground">Elegí un día en el calendario para ver el detalle.</p>}
            {diaSeleccionado && grupoDelDia.length === 0 && <p className="text-sm text-muted-foreground">Nadie registrado este día.</p>}
            {diaSeleccionado && grupoDelDia.map((g) => (
              <div key={g.casaDePazId} className="flex flex-col gap-1 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Home className="h-3.5 w-3.5 shrink-0" style={{ color: AZUL }} />
                  {g.etiqueta}
                </p>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {g.cantidad} persona{g.cantidad === 1 ? '' : 's'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Líder: {g.liderId && g.liderNombre ? <PersonaNombreLink personaId={g.liderId}>{g.liderNombre}</PersonaNombreLink> : (g.liderNombre ?? 'Sin líder')}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── Modal "Metas por Red": lista completa + asignar a todas ──────────── */}
      <Dialog open={modalMetasAbierto} onOpenChange={setModalMetasAbierto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Metas por Red</DialogTitle>
            <DialogDescription>Tiene prioridad por sobre las metas que cada Líder de Red les asigne a sus Casas de Paz.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              style={{ borderColor: `color-mix(in oklab, ${MORADO} 40%, transparent)`, color: MORADO }}
              onClick={() => setRedParaMeta({ casa_de_paz_id: ID_TODAS_LAS_REDES, etiqueta: `Todas las Redes (${redes.length})`, meta: null, origen: null })}
            >
              <UsersRound className="h-3.5 w-3.5" />
              Asignar a todas
            </Button>
          </div>
          <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
            {redes.map((r) => (
              <RedMetaFila key={r.id} red={r} onEditar={setRedParaMeta} />
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <AsignarMetaRedDialog
        open={!!redParaMeta}
        onOpenChange={(open) => !open && setRedParaMeta(null)}
        cdp={redParaMeta}
        asignando={redParaMeta?.casa_de_paz_id === ID_TODAS_LAS_REDES ? bulkAsignando : asignarMetaRed.isPending}
        nota="Mientras esté vigente, esta meta se hereda hacia cada Casa de Paz de la Red que no tenga ya su propia meta asignada -- y le gana a la meta que ya le haya asignado su Líder de Red."
        onAsignar={handleAsignar}
      />
    </div>
  );
}
