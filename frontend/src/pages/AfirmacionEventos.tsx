import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Plus } from 'lucide-react';

import { ROUTES } from '@/utils/constants';
import { DashboardHero } from '@/components/dashboard/DashboardUI';
import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { useAuthStore } from '@/store/auth.store';
import { useEventosAfirmacion, useCrearEventoAfirmacion } from '@/hooks/useAfirmacionEventos';
import { ACTIVIDADES_EVENTO } from '@/types/afirmacion-eventos.types';
import type { EventoAfirmacion } from '@/types/afirmacion-eventos.types';

// Etiqueta legible de las actividades que cubre un evento, para la tarjeta.
const PROCESO_LABEL: Record<string, string> = {
  ALTAR: 'Altar',
  RSIL: 'RSIL',
  BAUTISMO: 'Bautismo',
  MEMBRESIA_NUEVOS: 'Membresía',
};
function etiquetaActividades(procesos: string[] | null): string {
  if (!procesos || procesos.length === 0) return 'Todas las actividades';
  const tieneBaut = procesos.includes('BAUTISMO') || procesos.includes('MEMBRESIA_NUEVOS');
  const otros = procesos
    .filter((p) => p !== 'BAUTISMO' && p !== 'MEMBRESIA_NUEVOS')
    .map((p) => PROCESO_LABEL[p] ?? p);
  if (tieneBaut) otros.push('Bautismo + Membresía');
  return otros.join(' · ');
}

function EventoCard({ evento, onClick }: { evento: EventoAfirmacion; onClick: () => void }) {
  const activo = evento.activo;
  const badgeColor = activo ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground';

  return (
    <button
      onClick={onClick}
      className="text-left overflow-hidden rounded-2xl border border-border/60 bg-card hover:border-primary/50 transition-colors"
    >
      <TarjetaHeader icon={Calendar} color={evento.color} titulo={evento.titulo} descripcion={etiquetaActividades(evento.afirmacion_actividades)} />
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {evento.fecha_inicio}
            {evento.fecha_fin && evento.fecha_fin !== evento.fecha_inicio ? ` → ${evento.fecha_fin}` : ''}
          </span>
          {evento.es_recurrente && <Badge variant="outline" className="text-xs">Recurrente</Badge>}
          {activo && <Badge className={badgeColor}>Activo</Badge>}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-muted/40 p-2 text-center">
            <div className="text-sm font-semibold tabular-nums">{evento.total_personas}</div>
            <div className="text-[11px] text-muted-foreground">Total</div>
          </div>
          <div className="rounded-xl bg-muted/40 p-2 text-center">
            <div className="text-sm font-semibold tabular-nums">{evento.total_bautismo}</div>
            <div className="text-[11px] text-muted-foreground">Bautismos</div>
          </div>
          <div className="rounded-xl bg-muted/40 p-2 text-center">
            <div className="text-sm font-semibold tabular-nums">{evento.total_membresia}</div>
            <div className="text-[11px] text-muted-foreground">Membresías</div>
          </div>
        </div>
      </div>
    </button>
  );
}

const HOY = () => new Date().toISOString().slice(0, 10);

export function AfirmacionEventos() {
  const navigate = useNavigate();
  const iglesiaId = useAuthStore((s) => s.iglesiaActivaId);
  const { data: eventos = [], isLoading } = useEventosAfirmacion(iglesiaId);
  const crearEvento = useCrearEventoAfirmacion(iglesiaId);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [esUnSoloDia, setEsUnSoloDia] = useState(true);
  const [fechaInicio, setFechaInicio] = useState(HOY());
  const [fechaFin, setFechaFin] = useState('');
  // ids de ACTIVIDADES_EVENTO marcadas (ALTAR / RSIL / BAUTISMO_MEMBRESIA)
  const [actividades, setActividades] = useState<string[]>([]);

  const activos = eventos.filter((e) => e.activo);
  const pasados = eventos.filter((e) => !e.activo);

  const toggleActividad = (id: string) =>
    setActividades((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const resetForm = () => {
    setTitulo('');
    setDescripcion('');
    setEsUnSoloDia(true);
    setFechaInicio(HOY());
    setFechaFin('');
    setActividades([]);
  };

  const puedeGuardar = titulo.trim() !== '' && fechaInicio !== '' && actividades.length > 0;

  const guardar = async () => {
    if (!puedeGuardar) return;
    // Aplanar las actividades marcadas a proceso_codigo reales (dedup).
    const procesos = Array.from(
      new Set(
        actividades.flatMap((id) => ACTIVIDADES_EVENTO.find((a) => a.id === id)?.procesos ?? [])
      )
    );
    // "Un solo día" → fecha fin = fecha inicio (activo solo ese día). Si no,
    // la fecha fin es la elegida (o null = abierto) para un rango.
    const fin = esUnSoloDia ? fechaInicio : fechaFin.trim() === '' ? null : fechaFin;
    const id = await crearEvento.mutateAsync({
      titulo,
      fechaInicio,
      fechaFin: fin,
      descripcion: descripcion.trim() === '' ? null : descripcion,
      actividades: procesos,
    });
    setModalAbierto(false);
    resetForm();
    navigate(`${ROUTES.AFIRMACION_EVENTOS}/${id}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <DashboardHero
        icon={Calendar}
        eyebrow="Dpto. Afirmación"
        title="Eventos de Afirmación"
        subtitle="Agrupar registros por evento para ver el alcance de cada actividad"
      />

      {/* Qué son los eventos (pedido del owner 2026-10-08): explicar el para qué
          en la propia pantalla, en lenguaje simple. */}
      <div className="rounded-2xl border border-[#0071E3]/20 bg-[#0071E3]/5 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">¿Para qué sirven los eventos?</p>
        <p className="mt-1">
          Un evento es una <span className="font-medium text-foreground">etiqueta</span> para una actividad puntual
          (por ejemplo un “Bautismo Global”). Cuando registrás personas con un evento activo, quedan agrupadas ahí,
          y podés ver <span className="font-medium text-foreground">cuánta gente alcanzó esa actividad</span> por
          separado — sin que se mezcle con el total acumulado de siempre. Así buscás y filtrás mucho más fácil.
        </p>
      </div>

      {/* Botón de acción resaltado, debajo del Hero y alineado a la izquierda
          (pedido del owner 2026-10-08). Color sólido de Afirmación para que
          destaque; el className sobrescribe la variante global del Button. */}
      <div>
        <Button
          onClick={() => setModalAbierto(true)}
          className="gap-2 bg-[#0071E3] text-white shadow-sm hover:bg-[#005ec4] focus-visible:ring-[#0071E3]"
        >
          <Plus className="h-4 w-4" />
          Crear evento
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      ) : eventos.length === 0 ? (
        <ProximamentePlaceholder
          titulo="Todavía no hay eventos"
          descripcion="Creá el primero para empezar a agrupar los registros."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {activos.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <TarjetaHeader icon={Calendar} color="#0071e3" titulo="Eventos activos/recientes" descripcion="En curso o próximos" />
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activos.map((evento) => (
                  <EventoCard key={evento.id} evento={evento} onClick={() => navigate(`${ROUTES.AFIRMACION_EVENTOS}/${evento.id}`)} />
                ))}
              </div>
            </section>
          )}
          {pasados.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <TarjetaHeader icon={Calendar} color="#8e8e93" titulo="Eventos pasados" descripcion="Ya finalizados" />
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pasados.map((evento) => (
                  <EventoCard key={evento.id} evento={evento} onClick={() => navigate(`${ROUTES.AFIRMACION_EVENTOS}/${evento.id}`)} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <Dialog open={modalAbierto} onOpenChange={(o) => { setModalAbierto(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crear evento</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="titulo">Nombre del evento</Label>
              <Input id="titulo" className={CAMPO_ESTILO} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej. Bautismo Global" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="desc">Descripción</Label>
              <Textarea id="desc" className={CAMPO_ESTILO} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Opcional" />
            </div>

            {/* Fecha: un solo día (por defecto) o rango */}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={esUnSoloDia} onCheckedChange={(v) => setEsUnSoloDia(v === true)} />
              <span>Es un solo día</span>
            </label>
            {esUnSoloDia ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inicio">Fecha</Label>
                <Input id="inicio" type="date" className={CAMPO_ESTILO} value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="inicio">Fecha inicio</Label>
                  <Input id="inicio" type="date" className={CAMPO_ESTILO} value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fin">Fecha fin</Label>
                  <Input id="fin" type="date" className={CAMPO_ESTILO} value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
                </div>
              </div>
            )}

            {/* Actividades que incluye el evento (filtran en qué puertas aparece) */}
            <div className="flex flex-col gap-2">
              <Label>Actividades del evento</Label>
              <p className="text-[11px] text-muted-foreground -mt-1">
                El evento solo aparecerá en el selector de las actividades que marques.
              </p>
              {ACTIVIDADES_EVENTO.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={actividades.includes(a.id)} onCheckedChange={() => toggleActividad(a.id)} />
                  <span>{a.label}</span>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => { setModalAbierto(false); resetForm(); }} disabled={crearEvento.isPending}>
              Cancelar
            </Button>
            <Button type="button" onClick={guardar} disabled={crearEvento.isPending || !puedeGuardar}>
              {crearEvento.isPending ? 'Creando…' : 'Crear evento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
