import { useEffect, useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Cake, CalendarClock, CalendarDays, ChevronLeft, ChevronRight, MapPin, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { MARINO, MORADO, VERDE } from '@/components/dashboard/DashboardUI';
import { ConfirmarQuitarDialog } from '@/components/shared/ConfirmarQuitarDialog';
import {
  useCrearEventoIglesia,
  useEliminarEventoIglesia,
  useProximosIglesia,
  useTiposEvento,
} from '@/hooks/useCalendario';
import { obtenerEventosIglesia } from '@/services/calendario.service';
import { CalendarioGrid } from '@/components/calendario/CalendarioGrid';
import { EventoFormDialog } from '@/components/calendario/EventoFormDialog';
import { aISO, fechaLegible, nombreMes } from '@/utils/calendario-fechas';
import { iconoTipoEvento } from '@/utils/tipo-evento-icono';
import type { Evento, IglesiaHija } from '@/types/calendario.types';

const COLORES_SEDE = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

interface Sede {
  id: string;
  nombre: string;
  color: string;
}

interface EventoConSede extends Evento {
  sede_id: string;
  sede_nombre: string;
  sede_color: string;
}

interface Props {
  iglesiaPrincipalId: string;
  nombreIglesiaPrincipal: string;
  iglesiasHijas: IglesiaHija[];
  /** KAN-40: el Pastor usa esta misma vista pero sin permiso de crear/eliminar eventos -- oculta esos controles en vez de dejar que el backend los rechace. */
  soloLectura?: boolean;
}

/**
 * Calendario General multi-sede (KAN-39/KAN-40): consolida en una sola
 * grilla los eventos de la iglesia principal + sus hijas/satélite directas
 * -- antes había que elegir una sede a la vez con un <Select>. El filtro de
 * sede es multi-selección (todas por default), cada evento del panel del
 * día indica de qué sede es, y no depende de cambios estructurales: nuevas
 * sedes (nuevas iglesia_padre_id) aparecen solas vía fn_mis_iglesias_hijas.
 */
export function CalendarioMultiIglesia({ iglesiaPrincipalId, nombreIglesiaPrincipal, iglesiasHijas, soloLectura = false }: Props) {
  const sedes: Sede[] = useMemo(
    () => [
      { id: iglesiaPrincipalId, nombre: nombreIglesiaPrincipal, color: COLORES_SEDE[0] },
      ...iglesiasHijas.map((h, i) => ({ id: h.id, nombre: h.nombre, color: COLORES_SEDE[(i + 1) % COLORES_SEDE.length] })),
    ],
    [iglesiaPrincipalId, nombreIglesiaPrincipal, iglesiasHijas]
  );
  const idsSedes = sedes.map((s) => s.id).join(',');

  // Por default, todas las sedes autorizadas quedan seleccionadas -- si
  // aparece una sede nueva (se agregó una iglesia hija), se re-incluye a
  // "todas" en vez de quedar afuera silenciosamente.
  const [sedesElegidas, setSedesElegidas] = useState<Set<string>>(() => new Set(sedes.map((s) => s.id)));
  useEffect(() => {
    setSedesElegidas(new Set(idsSedes.split(',').filter(Boolean)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsSedes]);

  function toggleSede(id: string) {
    setSedesElegidas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // KAN-38: "Seleccionar todo" para el filtro de sedes -- todas por default,
  // pero si el Pastor/Supervisor destildó alguna, este toggle la vuelve a
  // incluir a todas de una vez (o las saca a todas, dejando el calendario
  // vacío hasta que elija de nuevo).
  const todasLasSedesElegidas = sedesElegidas.size === sedes.length;
  function toggleTodasLasSedes() {
    setSedesElegidas(todasLasSedesElegidas ? new Set() : new Set(sedes.map((s) => s.id)));
  }

  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth());
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [filtroTipoId, setFiltroTipoId] = useState<string | undefined>(undefined);
  const [eventoAEliminar, setEventoAEliminar] = useState<{ id: string; titulo: string } | null>(null);

  const desde = aISO(new Date(anio, mes, 1));
  const hasta = aISO(new Date(anio, mes + 1, 0));

  const { data: tipos = [] } = useTiposEvento(iglesiaPrincipalId);
  const tiposCreables = tipos.filter((t) => t.codigo !== 'CUMPLEANOS');

  const resultados = useQueries({
    queries: sedes.map((s) => ({
      queryKey: ['calendario', 'eventos-iglesia', s.id, desde, hasta, filtroTipoId],
      queryFn: () => obtenerEventosIglesia(s.id, desde, hasta, filtroTipoId),
      enabled: sedesElegidas.has(s.id),
    })),
  });
  const cargandoEventos = resultados.some((r) => r.isLoading);

  const eventos: EventoConSede[] = useMemo(() => {
    const out: EventoConSede[] = [];
    sedes.forEach((s, i) => {
      if (!sedesElegidas.has(s.id)) return;
      const data = resultados[i]?.data ?? [];
      for (const e of data) out.push({ ...e, sede_id: s.id, sede_nombre: s.nombre, sede_color: s.color });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sedes, sedesElegidas, ...resultados.map((r) => r.data)]);

  // "Próximos" se arma con la iglesia principal -- es el criterio que ya usa
  // fn_proximos_iglesia (ventana corta de días, un solo ámbito a la vez).
  const { data: proximos = [] } = useProximosIglesia(iglesiaPrincipalId);
  const crearEvento = useCrearEventoIglesia(iglesiaPrincipalId);
  const eliminarEvento = useEliminarEventoIglesia(iglesiaPrincipalId);

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
        toast.error(mensaje.includes('row-level security') || mensaje.includes('permission denied') ? 'No tenés permiso para eliminar este evento' : 'No se pudo eliminar el evento');
        setEventoAEliminar(null);
      },
    });
  }

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        {sedes.length > 1 && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 px-3 py-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> Sedes:
            </span>
            <label className="flex cursor-pointer items-center gap-1.5 text-sm font-medium">
              <Checkbox
                checked={todasLasSedesElegidas ? true : sedesElegidas.size > 0 ? 'indeterminate' : false}
                onCheckedChange={toggleTodasLasSedes}
              />
              Todas ({sedesElegidas.size}/{sedes.length})
            </label>
            <span className="h-4 w-px bg-border" aria-hidden />
            {sedes.map((s) => (
              <label key={s.id} className="flex cursor-pointer items-center gap-1.5 text-sm">
                <Checkbox checked={sedesElegidas.has(s.id)} onCheckedChange={() => toggleSede(s.id)} />
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                {s.nombre}
              </label>
            ))}
          </div>
        )}
        {!soloLectura && (
          <Button onClick={() => setDialogoAbierto(true)} className="gap-2 rounded-xl shadow-sm shadow-primary/20 active:scale-[0.98]">
            <Plus className="h-4 w-4" />
            Nuevo evento de Iglesia
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-2 sm:pl-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={irMesAnterior} aria-label="Mes anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="flex w-36 items-center justify-center gap-1.5 text-center text-sm font-semibold tracking-tight capitalize">
            {nombreMes(anio, mes)}
            {cargandoEventos && <Spinner className="h-3 w-3 text-muted-foreground" />}
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
          <TarjetaHeader icon={CalendarDays} color={MARINO} titulo="Calendario General" descripcion={`Eventos de ${nombreMes(anio, mes)} de las sedes seleccionadas`} />
          <div className="p-4">
            {cargandoEventos ? (
              <Skeleton className="h-96 w-full rounded-2xl" />
            ) : (
              <CalendarioGrid anio={anio} mes={mes} eventos={eventos} cumpleanos={[]} diaSeleccionado={diaSeleccionado} onSeleccionarDia={setDiaSeleccionado} />
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
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `color-mix(in oklab, ${e.color} 15%, transparent)` }}>
                        <Icono className="h-5 w-5" style={{ color: e.color }} />
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="flex flex-wrap items-center gap-1.5 font-medium">
                          {e.titulo}
                          {/* Simultáneos de sedes distintas se diferencian con este chip -- mismo día, misma grilla. */}
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                            style={{ backgroundColor: `color-mix(in oklab, ${e.sede_color} 18%, transparent)`, color: e.sede_color }}
                          >
                            <MapPin className="h-2.5 w-2.5" />
                            {e.sede_nombre}
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
                      {!soloLectura && e.sede_id === iglesiaPrincipalId && (
                        <button
                          type="button"
                          aria-label="Eliminar evento"
                          onClick={() => setEventoAEliminar({ id: e.id, titulo: e.titulo })}
                          className="shrink-0 rounded-lg p-1.5 text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <TarjetaHeader icon={CalendarClock} color={VERDE} titulo="Próximos" descripcion={`Eventos de ${nombreIglesiaPrincipal} de los próximos días`} />
            <div className="flex flex-col gap-1.5 p-4">
              {proximos.length === 0 && <p className="text-sm text-muted-foreground">Nada próximo.</p>}
              {proximos.map((p, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded-xl px-1.5 py-1 text-sm transition-colors hover:bg-muted/50">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `color-mix(in oklab, ${VERDE} 15%, transparent)` }}>
                      {p.clase === 'CUMPLEANOS' ? <Cake className="h-4 w-4" style={{ color: VERDE }} /> : <CalendarClock className="h-4 w-4" style={{ color: VERDE }} />}
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
            iglesia_id: iglesiaPrincipalId,
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
