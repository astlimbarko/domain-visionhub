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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { useAuthStore } from '@/store/auth.store';
import { useTiposEvento, useEventosAfirmacion, useCrearEventoAfirmacion } from '@/hooks/useAfirmacionEventos';
import type { EventoAfirmacion } from '@/types/afirmacion-eventos.types';

function EventoCard({ evento, onClick }: { evento: EventoAfirmacion; onClick: () => void }) {
  const activo = evento.activo;
  const badgeColor = activo ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground';
  
  return (
    <button
      onClick={onClick}
      className="text-left overflow-hidden rounded-2xl border border-border/60 bg-card hover:border-primary/50 transition-colors"
    >
      <TarjetaHeader icon={Calendar} color={evento.color} titulo={evento.titulo} descripcion={evento.tipo_nombre} />
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {evento.fecha_inicio}
            {evento.fecha_fin ? ` → ${evento.fecha_fin}` : ''}
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

export function AfirmacionEventos() {
  const navigate = useNavigate();
  const iglesiaId = useAuthStore((s) => s.iglesiaActivaId);
  const { data: tipos = [] } = useTiposEvento();
  const { data: eventos = [], isLoading } = useEventosAfirmacion(iglesiaId);
  const crearEvento = useCrearEventoAfirmacion(iglesiaId);
  
  const [modalAbierto, setModalAbierto] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [tipoEventoId, setTipoEventoId] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [descripcion, setDescripcion] = useState('');
  
  const activos = eventos.filter((e) => e.activo);
  const pasados = eventos.filter((e) => !e.activo);
  
  const guardar = async () => {
    if (!titulo || !tipoEventoId || !fechaInicio) return;
    const fin = fechaFin.trim() === '' ? null : fechaFin;
    const id = await crearEvento.mutateAsync({
      titulo,
      tipoEventoId,
      fechaInicio,
      fechaFin: fin,
      descripcion: descripcion.trim() === '' ? null : descripcion,
    });
    setModalAbierto(false);
    navigate(`${ROUTES.AFIRMACION_EVENTOS}/${id}`);
  };
  
  return (
    <div className="flex flex-col gap-6">
      <DashboardHero
        icon={Calendar}
        eyebrow="Dpto. Afirmación"
        title="Eventos de Afirmación"
        subtitle="Agrupar registros por evento para ver el alcance de cada actividad"
        actions={
          <Button onClick={() => setModalAbierto(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Crear evento
          </Button>
        }
      />
      
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
      
      <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crear evento</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="titulo">Título</Label>
              <Input id="titulo" className={CAMPO_ESTILO} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tipo">Tipo de evento</Label>
              <Select value={tipoEventoId} onValueChange={setTipoEventoId}>
                <SelectTrigger className={CAMPO_ESTILO}>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {tipos.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="desc">Descripción</Label>
              <Textarea id="desc" className={CAMPO_ESTILO} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setModalAbierto(false)} disabled={crearEvento.isPending}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={guardar}
              disabled={crearEvento.isPending || !titulo.trim() || !tipoEventoId || !fechaInicio}
            >
              {crearEvento.isPending ? 'Creando…' : 'Crear evento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}