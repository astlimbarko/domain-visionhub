import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Cake, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/store/auth.store';
import {
  useCrearEvento,
  useCumpleanosMes,
  useEventosMes,
  useMisCasasDePaz,
  useProximos,
  useTiposEvento,
} from '@/hooks/useCalendario';
import { CalendarioGrid } from '@/components/calendario/CalendarioGrid';
import { EventoFormDialog } from '@/components/calendario/EventoFormDialog';
import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';
import { aISO, nombreMes } from '@/utils/calendario-fechas';

export function Calendario() {
  const personaId = useAuthStore((s) => s.personaId);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;

  const { data: misCasas, isLoading: cargandoCasas } = useMisCasasDePaz(personaId);
  const [casaDePazId, setCasaDePazId] = useState<string>();
  const cdpActiva = casaDePazId ?? misCasas?.[0]?.casa_de_paz_id;

  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth());
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);

  const desde = aISO(new Date(anio, mes, 1));
  const hasta = aISO(new Date(anio, mes + 1, 0));

  const { data: tipos = [] } = useTiposEvento(iglesiaActivaId);
  const { data: eventos = [], isLoading: cargandoEventos } = useEventosMes(cdpActiva, desde, hasta);
  const { data: cumpleanos = [] } = useCumpleanosMes(cdpActiva, desde, hasta);
  const { data: proximos = [] } = useProximos(cdpActiva);
  const crearEvento = useCrearEvento(cdpActiva);

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

  if (cargandoCasas) return <Skeleton className="h-96 w-full rounded-2xl" />;

  if (!misCasas || misCasas.length === 0) {
    return (
      <ProximamentePlaceholder
        titulo="Calendario"
        descripcion="Todavía no tenés una Casa de Paz asignada como líder o sublíder, así que no hay un calendario que mostrar."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {misCasas.length > 1 && (
            <Select value={cdpActiva} onValueChange={setCasaDePazId}>
              <SelectTrigger className="w-56 rounded-xl border-border/60 bg-muted/40 text-sm">
                <SelectValue placeholder="Casa de Paz" />
              </SelectTrigger>
              <SelectContent>
                {misCasas.map((c) => (
                  <SelectItem key={c.casa_de_paz_id} value={c.casa_de_paz_id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={irMesAnterior} aria-label="Mes anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="w-36 text-center text-sm font-semibold tracking-tight">{nombreMes(anio, mes)}</span>
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={irMesSiguiente} aria-label="Mes siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button onClick={() => setDialogoAbierto(true)} className="gap-2 rounded-xl shadow-sm shadow-primary/20 active:scale-[0.98]">
          <Plus className="h-4 w-4" />
          Nuevo evento
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
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

        <div className="flex flex-col gap-4">
          {diaSeleccionado && (
            <div className="glass-card-elevated rounded-2xl p-5">
              <h3 className="mb-3 text-sm font-semibold">{diaSeleccionado}</h3>
              <div className="flex flex-col gap-2">
                {eventosDelDiaSeleccionado.length === 0 && cumpleanosDelDiaSeleccionado.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sin eventos ni cumpleaños.</p>
                )}
                {eventosDelDiaSeleccionado.map((e) => (
                  <div key={e.id} className="flex items-center gap-2 text-sm">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
                    <span className="font-medium">{e.titulo}</span>
                    <span className="text-muted-foreground">({e.tipo_nombre})</span>
                  </div>
                ))}
                {cumpleanosDelDiaSeleccionado.map((c) => (
                  <div key={c.persona_id} className="flex items-center gap-2 text-sm">
                    <Cake className="h-4 w-4 shrink-0 text-chart-4" />
                    <span>
                      {c.nombre} cumple {c.edad_cumple} años
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="glass-card-elevated rounded-2xl p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <CalendarClock className="h-4 w-4 text-primary" />
              Próximos
            </h3>
            <div className="flex flex-col gap-2">
              {proximos.length === 0 && <p className="text-sm text-muted-foreground">Nada próximo.</p>}
              {proximos.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span>{p.titulo}</span>
                  <span className="rounded-lg bg-primary/8 px-2 py-0.5 text-xs font-medium text-primary">
                    {p.dias_faltantes === 0 ? 'hoy' : `en ${p.dias_faltantes}d`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {cdpActiva && (
        <EventoFormDialog
          open={dialogoAbierto}
          onOpenChange={setDialogoAbierto}
          tipos={tipos}
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
    </div>
  );
}
