import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, CalendarDays, ChevronLeft, ChevronRight, Globe2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { MARINO, MORADO, VERDE } from '@/components/dashboard/DashboardUI';
import { ConfirmarQuitarDialog } from '@/components/shared/ConfirmarQuitarDialog';
import { useAuthStore } from '@/store/auth.store';
import {
  useCrearEventoRed,
  useEliminarEventoRed,
  useEventosRed,
  useProximosRed,
  useTiposEvento,
} from '@/hooks/useCalendario';
import { CalendarioGrid } from '@/components/calendario/CalendarioGrid';
import { EventoFormDialog } from '@/components/calendario/EventoFormDialog';
import { aISO, fechaLegible, nombreMes } from '@/utils/calendario-fechas';
import { iconoTipoEvento } from '@/utils/tipo-evento-icono';

interface Props {
  redId: string;
}

/**
 * Calendario a nivel Red: mismo layout que Calendario.tsx (CdP) pero sin
 * selector de CdP ni cumpleaños (la Red no tiene miembros propios). Todo
 * evento que el Líder de Red crea acá queda "de la Red" (red_id) y ya
 * aparece automáticamente en el calendario de cada una de sus CdP -- ver
 * `fn_eventos_cdp` (13_calendario.sql) y `pol_evento_insert` (16_rls.sql),
 * que ya soportaban esto antes de que hubiera una pantalla para usarlo.
 */
export function CalendarioRed({ redId }: Props) {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;

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
  const { data: eventos = [], isLoading: cargandoEventos, isFetching: actualizandoEventos } = useEventosRed(redId, desde, hasta, filtroTipoId);
  const { data: proximos = [] } = useProximosRed(redId);
  const crearEvento = useCrearEventoRed(redId);
  const eliminarEvento = useEliminarEventoRed(redId);

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

  // A diferencia del calendario de CdP, acá no hay que filtrar CUMPLEANOS/MEGA_FIESTA
  // por rol: cualquier tipo creable sirve para un evento "de toda la Red".
  const tiposCreables = tipos.filter((t) => t.codigo !== 'CUMPLEANOS');

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button onClick={() => setDialogoAbierto(true)} className="gap-2 rounded-xl shadow-sm shadow-primary/20 active:scale-[0.98]">
          <Plus className="h-4 w-4" />
          Nuevo evento de Red
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
          <TarjetaHeader icon={CalendarDays} color={MARINO} titulo="Calendario de la Red" descripcion={`Eventos de ${nombreMes(anio, mes)} visibles en todas tus Casas de Paz`} />
          <div className="p-4">
            {cargandoEventos ? (
              <Skeleton className="h-96 w-full rounded-2xl" />
            ) : (
              <CalendarioGrid
                anio={anio}
                mes={mes}
                eventos={eventos}
                cumpleanos={[]}
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
                color={MORADO}
                titulo={fechaLegible(diaSeleccionado)}
                descripcion={eventosDelDiaSeleccionado.length > 0 ? `${eventosDelDiaSeleccionado.length} para hoy` : 'Sin eventos'}
              />
              <div className="flex flex-col gap-2.5 p-4">
                {eventosDelDiaSeleccionado.length === 0 && <p className="text-sm text-muted-foreground">Sin eventos.</p>}
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
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            <Globe2 className="h-2.5 w-2.5" />
                            De la Red
                          </span>
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
              </div>
            </section>
          )}

          <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <TarjetaHeader icon={CalendarClock} color={VERDE} titulo="Próximos" descripcion="Eventos de Red de los próximos días" />
            <div className="flex flex-col gap-1.5 p-4">
              {proximos.length === 0 && <p className="text-sm text-muted-foreground">Nada próximo.</p>}
              {proximos.map((p, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded-xl px-1.5 py-1 text-sm transition-colors hover:bg-muted/50">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `color-mix(in oklab, ${VERDE} 15%, transparent)` }}>
                      <CalendarClock className="h-4 w-4" style={{ color: VERDE }} />
                    </span>
                    <span className="truncate font-medium">{p.titulo}</span>
                  </span>
                  <span className="shrink-0 rounded-lg bg-primary/8 px-2 py-0.5 text-xs font-medium text-primary">
                    {p.dias_faltantes === 0 ? 'hoy' : `en ${p.dias_faltantes}d`}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <EventoFormDialog
        open={dialogoAbierto}
        onOpenChange={setDialogoAbierto}
        tipos={tiposCreables}
        fechaInicial={diaSeleccionado ?? aISO(hoy)}
        onCrear={(valores) =>
          crearEvento.mutateAsync({
            red_id: redId,
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
