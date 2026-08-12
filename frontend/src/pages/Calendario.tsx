import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Cake, CalendarClock, CalendarDays, ChevronLeft, ChevronRight, Globe2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { DescargarPdfButton } from '@/components/shared/DescargarPdfButton';
import { AZUL, MARINO, MORADO, VERDE } from '@/components/dashboard/DashboardUI';
import { ConfirmarQuitarDialog } from '@/components/shared/ConfirmarQuitarDialog';
import { useAuthStore } from '@/store/auth.store';
import { useContextoActivo } from '@/hooks/useContextoActivo';
import {
  useCrearEvento,
  useCumpleanosMes,
  useEliminarEvento,
  useEventosMes,
  useIglesiasHijas,
  useMisCasasDePaz,
  useProximos,
  useTiposEvento,
} from '@/hooks/useCalendario';
import { CalendarioGrid } from '@/components/calendario/CalendarioGrid';
import { CalendarioRed } from '@/components/calendario/CalendarioRed';
import { CalendarioMultiIglesia } from '@/components/calendario/CalendarioMultiIglesia';
import { EventoFormDialog } from '@/components/calendario/EventoFormDialog';
import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';
import { aISO, fechaLegible, nombreMes } from '@/utils/calendario-fechas';
import { iconoTipoEvento } from '@/utils/tipo-evento-icono';

// Requisito 5.1/5.2: la Mega Fiesta solo la puede crear el Líder de Red o un rol superior.
// Se cuelga de una red (no de una Casa de Paz) y esta página siempre trabaja en contexto de CdP,
// así que a un líder/sublíder de CdP ni se le ofrece como opción al crear un evento.
const ROLES_PUEDEN_MEGA_FIESTA = new Set(['LIDER_RED', 'SUPERVISOR', 'PASTOR', 'SUPER_ADMIN']);

export function Calendario() {
  const personaId = useAuthStore((s) => s.personaId);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const iglesias = useAuthStore((s) => s.iglesias);
  const nombreIglesiaActiva = iglesias.find((i) => i.id === iglesiaActivaId)?.nombre ?? 'Mi iglesia';
  const { contextoActivo } = useContextoActivo();
  const rolUI = contextoActivo?.rolUI ?? null;

  const { data: misCasas, isLoading: cargandoCasas } = useMisCasasDePaz(personaId);
  // El Supervisor puede administrar el calendario de su iglesia, o el de una
  // hija/satélite directa (Padre -> Hija, ver 101_calendario_padre_satelite.sql).
  // El Pastor (KAN-40) también ve esa lista de sedes, pero solo para consultar.
  const { data: iglesiasHijas = [] } = useIglesiasHijas(rolUI === 'SUPERVISOR' || rolUI === 'PASTOR' ? iglesiaActivaId : undefined);
  const cdpActiva = contextoActivo?.alcance === 'CDP' ? contextoActivo.cdpId : undefined;
  const contenedorRef = useRef<HTMLDivElement>(null);

  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth());
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [filtroTipoId, setFiltroTipoId] = useState<string | undefined>(undefined);
  const [eventoAEliminar, setEventoAEliminar] = useState<{ id: string; titulo: string } | null>(null);

  const desde = aISO(new Date(anio, mes, 1));
  const hasta = aISO(new Date(anio, mes + 1, 0));

  const { data: tipos = [] } = useTiposEvento(iglesiaActivaId);
  const { data: eventos = [], isLoading: cargandoEventos, isFetching: actualizandoEventos } = useEventosMes(cdpActiva, desde, hasta, filtroTipoId);
  const { data: cumpleanos = [] } = useCumpleanosMes(cdpActiva, desde, hasta);
  const { data: proximos = [] } = useProximos(cdpActiva);
  const crearEvento = useCrearEvento(cdpActiva);
  const eliminarEvento = useEliminarEvento(cdpActiva);

  function manejarEliminarEvento() {
    if (!eventoAEliminar) return;
    eliminarEvento.mutate(eventoAEliminar.id, {
      onSuccess: () => {
        toast.success('Evento eliminado');
        setEventoAEliminar(null);
      },
      onError: (e) => {
        const error = e as { message?: string } | null;
        const mensaje = typeof error?.message === 'string' ? error.message : '';
        if (mensaje.includes('row-level security') || mensaje.includes('permission denied')) {
          toast.error('No tenés permiso para eliminar este evento');
        } else {
          toast.error('No se pudo eliminar el evento');
        }
        setEventoAEliminar(null);
      },
    });
  }

  // Requisito 1.1: catálogo sembrado con 8 tipos, incluyendo Cumpleaños — pero
  // ese es generado (Requisito 4.2), nunca creable como Evento, así que no se
  // ofrece en el formulario aunque exista como fila en tipo_evento.
  const tiposCreables = tipos.filter((t) => {
    if (t.codigo === 'CUMPLEANOS') return false;
    if (t.codigo === 'MEGA_FIESTA') return rolUI !== null && ROLES_PUEDEN_MEGA_FIESTA.has(rolUI);
    return true;
  });

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

  const eventosDelDiaSeleccionado = useMemo(() => {
    if (!diaSeleccionado) return [];
    return eventos.filter((e) => {
      const fin = e.fecha_fin ?? e.fecha_inicio;
      return diaSeleccionado >= e.fecha_inicio && diaSeleccionado <= fin;
    });
  }, [eventos, diaSeleccionado]);

  const cumpleanosDelDiaSeleccionado = useMemo(() => {
    if (!diaSeleccionado) return [];
    return cumpleanos.filter((c) => c.fecha_cumpleanos === diaSeleccionado);
  }, [cumpleanos, diaSeleccionado]);

  // Un Líder de Red puro no es Líder/Sublíder de ninguna CdP propia (misCasas
  // vacío), así que antes de esa rama caía siempre en el placeholder de abajo
  // pese a tener "Calendario" en su menú. Acá entra a su propio calendario de
  // Red -- eventos que fija se ven en todas las CdP de su Red (fn_eventos_cdp
  // ya los mezclaba; ver CalendarioRed).
  if (rolUI === 'LIDER_RED') {
    const redId = contextoActivo?.alcance === 'RED' ? contextoActivo.redId : undefined;
    if (!redId) {
      return (
        <ProximamentePlaceholder
          titulo="Calendario"
          descripcion="Todavía no tenés una Red asignada como líder, así que no hay un calendario que mostrar."
        />
      );
    }
    return <CalendarioRed redId={redId} />;
  }

  // El Supervisor no lidera/sublidera ninguna Casa de Paz propia -- antes
  // caía siempre en el placeholder de abajo pese a tener "Calendario" en su
  // menú. Ve el calendario consolidado de su iglesia + hijas/satélite (KAN-39,
  // CalendarioMultiIglesia): eventos que fija se ven en todas las Redes y CdP
  // de esa iglesia (fn_eventos_cdp/fn_eventos_red ya los mezclan; ver
  // 100_calendario_ambito_iglesia.sql / 101_calendario_padre_satelite.sql).
  if (rolUI === 'SUPERVISOR') {
    if (!iglesiaActivaId) return <Skeleton className="h-96 w-full rounded-2xl" />;
    // KAN-39: filtro de sede multi-selección + vista consolidada (antes,
    // <Select> de una sede a la vez) -- ver CalendarioMultiIglesia.
    return (
      <CalendarioMultiIglesia
        iglesiaPrincipalId={iglesiaActivaId}
        nombreIglesiaPrincipal={nombreIglesiaActiva}
        iglesiasHijas={iglesiasHijas}
      />
    );
  }

  // El Pastor (KAN-40) ve el mismo calendario consolidado que el Supervisor
  // (su iglesia + sedes hijas/satélite), pero en modo solo lectura -- el
  // backend no le da permiso de crear/editar/eliminar eventos (paridad
  // Pastor-Supervisor, 2026-08-09, pero de solo consulta para el calendario).
  if (rolUI === 'PASTOR') {
    if (!iglesiaActivaId) return <Skeleton className="h-96 w-full rounded-2xl" />;
    return (
      <CalendarioMultiIglesia
        iglesiaPrincipalId={iglesiaActivaId}
        nombreIglesiaPrincipal={nombreIglesiaActiva}
        iglesiasHijas={iglesiasHijas}
        soloLectura
      />
    );
  }

  if (cargandoCasas) return <Skeleton className="h-96 w-full rounded-2xl" />;

  if (!cdpActiva || !misCasas?.some((c) => c.casa_de_paz_id === cdpActiva)) {
    return (
      <ProximamentePlaceholder
        titulo="Calendario"
        descripcion="Todavía no tenés una Casa de Paz asignada como líder o sublíder, así que no hay un calendario que mostrar."
      />
    );
  }

  return (
    <div ref={contenedorRef} className="flex flex-col gap-6">
      <div className="flex justify-end gap-2">
        <DescargarPdfButton contenedorRef={contenedorRef} nombreArchivo="calendario" />
        <Button onClick={() => setDialogoAbierto(true)} className="gap-2 rounded-xl shadow-sm shadow-primary/20 active:scale-[0.98]">
          <Plus className="h-4 w-4" />
          Nuevo evento
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-2 sm:pl-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={irMesAnterior} aria-label="Mes anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="flex w-36 items-center justify-center gap-1.5 text-center text-sm font-semibold tracking-tight capitalize">
            {nombreMes(anio, mes)}
            {actualizandoEventos && !cargandoEventos && <Spinner className="h-3 w-3 text-muted-foreground" />}
          </span>
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={irMesSiguiente} aria-label="Mes siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Requisito 3.4: filtrar por tipo de evento. Los chips también sirven de leyenda de colores. */}
        {tipos.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltroTipoId(undefined)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all active:scale-[0.97] ${
                filtroTipoId === undefined
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/25'
                  : 'border-border/70 bg-background text-muted-foreground hover:border-border hover:text-foreground'
              }`}
            >
              Todos
            </button>
            {tipos.map((t) => {
              const Icono = iconoTipoEvento(t.codigo);
              const activo = filtroTipoId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFiltroTipoId(activo ? undefined : t.id)}
                  className={`flex items-center gap-2 rounded-full border py-1 pr-3.5 pl-1 text-xs font-semibold transition-all active:scale-[0.97] ${
                    activo ? 'text-foreground shadow-sm' : 'border-border/70 bg-background text-muted-foreground hover:border-border hover:text-foreground'
                  }`}
                  style={activo ? { borderColor: t.color, backgroundColor: `color-mix(in oklab, ${t.color} 14%, transparent)` } : undefined}
                >
                  <span
                    className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `color-mix(in oklab, ${t.color} ${activo ? 30 : 16}%, transparent)` }}
                  >
                    <Icono className="h-3.5 w-3.5" style={{ color: t.color }} />
                  </span>
                  {t.nombre}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card lg:col-span-2">
          <TarjetaHeader icon={CalendarDays} color={MARINO} titulo="Calendario" descripcion={`Eventos de ${nombreMes(anio, mes)}`} />
          <div className="p-4">
            {cargandoEventos ? (
              <Skeleton className="h-96 w-full rounded-2xl" />
            ) : (
              <CalendarioGrid
                anio={anio}
                mes={mes}
                eventos={eventos}
                cumpleanos={cumpleanos}
                diaSeleccionado={diaSeleccionado}
                onSeleccionarDia={setDiaSeleccionado}
              />
            )}
          </div>
        </section>

        <div className="flex flex-col gap-4">
          {diaSeleccionado && (
            <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <TarjetaHeader
                icon={CalendarDays}
                color={AZUL}
                titulo={fechaLegible(diaSeleccionado)}
                descripcion={
                  eventosDelDiaSeleccionado.length + cumpleanosDelDiaSeleccionado.length > 0
                    ? `${eventosDelDiaSeleccionado.length + cumpleanosDelDiaSeleccionado.length} para hoy`
                    : 'Sin eventos ni cumpleaños'
                }
              />
              <div className="flex flex-col gap-2.5 p-4">
                {eventosDelDiaSeleccionado.length === 0 && cumpleanosDelDiaSeleccionado.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sin eventos ni cumpleaños.</p>
                )}
                {eventosDelDiaSeleccionado.map((e) => {
                  const Icono = iconoTipoEvento(e.tipo_codigo);
                  return (
                    <div key={e.id} className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/60 p-2.5 text-sm">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                        style={{ backgroundColor: `color-mix(in oklab, ${e.color} 15%, transparent)` }}
                      >
                        <Icono className="h-5 w-5" style={{ color: e.color }} />
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="flex flex-wrap items-center gap-1.5 font-medium">
                          {e.titulo}
                          {e.ambito === 'RED' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              <Globe2 className="h-2.5 w-2.5" />
                              De la Red
                            </span>
                          )}
                        </p>
                        <p className="text-xs font-medium" style={{ color: e.color }}>
                          {e.tipo_nombre}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {e.hora_inicio && `${e.hora_inicio.slice(0, 5)}${e.hora_fin ? ` – ${e.hora_fin.slice(0, 5)}` : ''}`}
                          {e.es_multi_dia && (e.hora_inicio ? ' · varios días' : 'Varios días')}
                        </p>
                        {e.descripcion && <p className="mt-0.5 text-xs text-muted-foreground">{e.descripcion}</p>}
                      </div>
                      <button
                        type="button"
                        aria-label="Eliminar evento"
                        onClick={() => setEventoAEliminar({ id: e.id, titulo: e.titulo })}
                        className="shrink-0 rounded-lg p-1.5 text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
                {cumpleanosDelDiaSeleccionado.map((c) => (
                  <div key={c.persona_id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 p-2.5 text-sm">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `color-mix(in oklab, ${MORADO} 15%, transparent)` }}>
                      <Cake className="h-5 w-5" style={{ color: MORADO }} />
                    </div>
                    <span className="font-medium">
                      {c.nombre} <span className="font-normal text-muted-foreground">cumple {c.edad_cumple} años</span>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <TarjetaHeader icon={CalendarClock} color={VERDE} titulo="Próximos" descripcion="Eventos y cumpleaños de los próximos días" />
            <div className="flex flex-col gap-1.5 p-4">
              {proximos.length === 0 && <p className="text-sm text-muted-foreground">Nada próximo.</p>}
              {proximos.map((p, i) => {
                const esCumple = p.clase === 'CUMPLEANOS';
                const Icono = esCumple ? Cake : CalendarClock;
                const color = esCumple ? MORADO : VERDE;
                return (
                  <div key={i} className="flex items-center justify-between gap-2 rounded-xl px-1.5 py-1 text-sm transition-colors hover:bg-muted/50">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `color-mix(in oklab, ${color} 15%, transparent)` }}
                      >
                        <Icono className="h-4 w-4" style={{ color }} />
                      </span>
                      <span className="truncate font-medium">{p.titulo}</span>
                    </span>
                    <span className="shrink-0 rounded-lg bg-primary/8 px-2 py-0.5 text-xs font-medium text-primary">
                      {p.dias_faltantes === 0 ? 'hoy' : `en ${p.dias_faltantes}d`}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {cdpActiva && (
        <EventoFormDialog
          open={dialogoAbierto}
          onOpenChange={setDialogoAbierto}
          tipos={tiposCreables}
          fechaInicial={diaSeleccionado ?? aISO(hoy)}
          onCrear={(valores) =>
            crearEvento.mutateAsync({
              casa_de_paz_id: cdpActiva,
              iglesia_id: iglesiaActivaId as string,
              tipo_evento_id: valores.tipo_evento_id,
              titulo: valores.titulo,
              descripcion: valores.descripcion || undefined,
              fecha_inicio: valores.fecha_inicio,
              fecha_fin: valores.fecha_fin || undefined,
              hora_inicio: valores.hora_inicio || undefined,
              hora_fin: valores.hora_fin || undefined,
            })
          }
        />
      )}

      <ConfirmarQuitarDialog
        open={!!eventoAEliminar}
        onOpenChange={(open) => !open && setEventoAEliminar(null)}
        titulo="Eliminar evento"
        descripcion={eventoAEliminar ? `¿Seguro que querés eliminar "${eventoAEliminar.titulo}"? Esta acción no se puede deshacer.` : undefined}
        procesando={eliminarEvento.isPending}
        onConfirmar={manejarEliminarEvento}
        textoConfirmar="Sí, eliminar"
        textoProcesando="Eliminando..."
      />
    </div>
  );
}
