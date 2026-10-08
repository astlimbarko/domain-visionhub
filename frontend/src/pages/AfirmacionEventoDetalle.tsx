import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Pencil, Users, UserCheck, FileText, FileSpreadsheet } from 'lucide-react';

import { ROUTES } from '@/utils/constants';
import { DashboardHero, KpiMosaico, AZUL, VERDE, AMBAR, TEAL } from '@/components/dashboard/DashboardUI';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { toast } from 'sonner';
import {
  useEventoDetalle,
  useColaboradoresEvento,
  usePersonasBloqueEvento,
  useEditarEventoAfirmacion,
} from '@/hooks/useAfirmacionEventos';
import { useFichaPersonaStore } from '@/store/ficha-persona.store';
import { ACTIVIDADES_EVENTO } from '@/types/afirmacion-eventos.types';
import type { EventoAfirmacion } from '@/types/afirmacion-eventos.types';
import { calcularEdad } from '@/utils/edad';
import { exportarEventoBloquePdf, exportarEventoBloqueXls, iglesiaCorta } from '@/utils/exportarEventoBloque';

// Bloques posibles. "Bautismo + Membresía" agrupa 2 procesos (pedido del owner).
const BLOQUES_DEF = [
  { id: 'ALTAR', label: 'Altar', procesos: ['ALTAR'], color: AZUL },
  { id: 'RSIL', label: 'RSIL', procesos: ['RSIL'], color: AMBAR },
  { id: 'BAUTISMO_MEMBRESIA', label: 'Bautismo + Membresía', procesos: ['BAUTISMO', 'MEMBRESIA_NUEVOS'], color: VERDE },
];
type BloqueDef = (typeof BLOQUES_DEF)[number];

function bloquesDelEvento(actividades: string[] | null): BloqueDef[] {
  if (!actividades || actividades.length === 0) return BLOQUES_DEF; // evento viejo: todos
  return BLOQUES_DEF.filter((b) => b.procesos.some((p) => actividades.includes(p)));
}
function actividadesIdsDeProcesos(procesos: string[] | null): string[] {
  if (!procesos) return [];
  return ACTIVIDADES_EVENTO.filter((a) => a.procesos.some((p) => procesos.includes(p))).map((a) => a.id);
}

// ── Tarjeta-botón de un bloque (con su conteo de personas) ───────────────────
function BloqueCard({ eventoId, bloque, onClick }: { eventoId: string; bloque: BloqueDef; onClick: () => void }) {
  const { data: personas = [], isLoading } = usePersonasBloqueEvento(eventoId, bloque.procesos);
  return (
    <button
      onClick={onClick}
      className="text-left overflow-hidden rounded-2xl border border-border/60 bg-card hover:border-primary/50 transition-colors"
    >
      <TarjetaHeader icon={Calendar} color={bloque.color} titulo={bloque.label} descripcion="Ver personas registradas" />
      <div className="p-4 flex items-end justify-between">
        <div>
          <div className="text-3xl font-bold tabular-nums">{isLoading ? '…' : personas.length}</div>
          <div className="text-[11px] text-muted-foreground">personas en este bloque</div>
        </div>
        <ArrowLeft className="h-5 w-5 rotate-180 text-muted-foreground" />
      </div>
    </button>
  );
}

// ── Vista de personas de un bloque (tabla + export + lápiz) ──────────────────
function BloquePersonas({
  eventoId,
  bloque,
  evento,
  onVolver,
}: {
  eventoId: string;
  bloque: BloqueDef;
  evento: EventoAfirmacion;
  onVolver: () => void;
}) {
  const { data: personas = [], isLoading } = usePersonasBloqueEvento(eventoId, bloque.procesos);
  const abrirFicha = useFichaPersonaStore((s) => s.abrir);
  const opcExport = { evento: evento.titulo, fechaEvento: evento.fecha_inicio, bloque: bloque.label };

  const abreviar = (n: string | null) => {
    if (!n) return '—';
    const p = n.trim().split(/\s+/);
    return p.length === 1 ? p[0] : `${p[0]} ${p[1][0]}.`;
  };
  const fechaHora = (c: string) => {
    const d = new Date(c);
    return `${d.toLocaleDateString('es-BO')} ${d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}`;
  };
  // Resumen "de dónde es quién": personas por iglesia (madre + satélites).
  const porIglesia = Object.entries(
    personas.reduce<Record<string, number>>((acc, p) => {
      const k = iglesiaCorta(p.iglesia_origen);
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  return (
    <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
      <TarjetaHeader
        icon={Calendar}
        color={bloque.color}
        titulo={bloque.label}
        descripcion={`${personas.length} personas registradas en este evento`}
        accion={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" disabled={personas.length === 0} onClick={() => exportarEventoBloquePdf(personas, opcExport)}>
              <FileText className="h-4 w-4" /> PDF
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" disabled={personas.length === 0} onClick={() => exportarEventoBloqueXls(personas, opcExport)}>
              <FileSpreadsheet className="h-4 w-4" /> XLS
            </Button>
            <Button size="sm" variant="ghost" className="gap-1.5" onClick={onVolver}>
              <ArrowLeft className="h-4 w-4" /> Volver
            </Button>
          </div>
        }
      />
      <div className="p-5">
        {isLoading ? (
          <Skeleton className="h-64 w-full rounded-2xl" />
        ) : personas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin registros en este evento.</p>
        ) : (
          <div className="overflow-x-auto">
            {/* Resumen de dónde es quién (madre + satélites) */}
            {porIglesia.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">Por iglesia:</span>
                {porIglesia.map(([igl, n]) => (
                  <span key={igl} className="rounded-full bg-muted px-2.5 py-1 font-medium">
                    {igl}: <span className="tabular-nums">{n}</span>
                  </span>
                ))}
              </div>
            )}
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  {['#', 'Fecha y hora', 'Nombre completo', 'Edad', 'Teléfono', 'Invitó', 'Red', 'Líder de CdP', 'Iglesia', ''].map((h, idx) => (
                    <th key={h || `col-${idx}`} className="px-3 py-2 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {personas.map((p, i) => (
                  <tr key={p.registro_id} className="border-t border-border/40 hover:bg-muted/30">
                    <td className="px-3 py-1.5 text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="px-3 py-1.5 tabular-nums whitespace-nowrap">{fechaHora(p.fecha_creacion)}</td>
                    <td className="px-3 py-1.5 font-medium">{p.nombre_completo}</td>
                    <td className="px-3 py-1.5 tabular-nums">{p.fecha_nacimiento ? calcularEdad(p.fecha_nacimiento) : '—'}</td>
                    <td className="px-3 py-1.5 tabular-nums whitespace-nowrap">{p.telefono ?? '—'}</td>
                    <td className="px-3 py-1.5">{abreviar(p.invitado_por)}</td>
                    <td className="px-3 py-1.5">{p.red_nombre ?? '—'}</td>
                    <td className="px-3 py-1.5">{abreviar(p.lider_cdp)}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{iglesiaCorta(p.iglesia_origen)}</td>
                    <td className="px-3 py-1.5 text-right">
                      <Button size="icon-sm" variant="ghost" title="Editar persona" onClick={() => abrirFicha(p.persona_id, { permitirEdicionExtra: true })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Modal de editar evento ───────────────────────────────────────────────────
function EditarEventoModal({
  evento,
  abierto,
  onOpenChange,
}: {
  evento: EventoAfirmacion;
  abierto: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const editar = useEditarEventoAfirmacion(evento.id);
  const unSoloDiaInicial = !evento.fecha_fin || evento.fecha_fin === evento.fecha_inicio;
  const [titulo, setTitulo] = useState(evento.titulo);
  const [esUnSoloDia, setEsUnSoloDia] = useState(unSoloDiaInicial);
  const [fechaInicio, setFechaInicio] = useState(evento.fecha_inicio);
  const [fechaFin, setFechaFin] = useState(evento.fecha_fin ?? '');
  const [actividades, setActividades] = useState<string[]>(actividadesIdsDeProcesos(evento.afirmacion_actividades));

  const toggle = (id: string) => setActividades((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const puede = titulo.trim() !== '' && fechaInicio !== '' && actividades.length > 0;

  const guardar = async () => {
    if (!puede) return;
    const procesos = Array.from(new Set(actividades.flatMap((id) => ACTIVIDADES_EVENTO.find((a) => a.id === id)?.procesos ?? [])));
    const fin = esUnSoloDia ? fechaInicio : fechaFin.trim() === '' ? null : fechaFin;
    try {
      await editar.mutateAsync({ titulo, fechaInicio, fechaFin: fin, descripcion: null, actividades: procesos });
      toast.success('Evento actualizado.');
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar.');
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar evento</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e_titulo">Nombre del evento</Label>
            <Input id="e_titulo" className={CAMPO_ESTILO} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={esUnSoloDia} onCheckedChange={(v) => setEsUnSoloDia(v === true)} />
            <span>Es un solo día</span>
          </label>
          {esUnSoloDia ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="e_inicio">Fecha</Label>
              <Input id="e_inicio" type="date" className={CAMPO_ESTILO} value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="e_inicio">Fecha inicio</Label>
                <Input id="e_inicio" type="date" className={CAMPO_ESTILO} value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="e_fin">Fecha fin</Label>
                <Input id="e_fin" type="date" className={CAMPO_ESTILO} value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label>Actividades del evento</Label>
            {ACTIVIDADES_EVENTO.map((a) => (
              <label key={a.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={actividades.includes(a.id)} onCheckedChange={() => toggle(a.id)} />
                <span>{a.label}</span>
              </label>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={editar.isPending}>Cancelar</Button>
          <Button type="button" onClick={guardar} disabled={editar.isPending || !puede}>
            {editar.isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AfirmacionEventoDetalle() {
  const { eventoId } = useParams();
  const navigate = useNavigate();
  const { data: evento, isLoading } = useEventoDetalle(eventoId || null);
  const { data: colaboradores = [] } = useColaboradoresEvento(eventoId || null);
  const [bloqueActivo, setBloqueActivo] = useState<BloqueDef | null>(null);
  const [editarAbierto, setEditarAbierto] = useState(false);

  const bloques = evento ? bloquesDelEvento(evento.afirmacion_actividades) : [];

  return (
    <div className="flex flex-col gap-6">
      <DashboardHero
        icon={Calendar}
        eyebrow="Evento de Afirmación"
        title={evento?.titulo || 'Detalle del evento'}
        subtitle={evento ? `${evento.fecha_inicio}${evento.fecha_fin && evento.fecha_fin !== evento.fecha_inicio ? ` → ${evento.fecha_fin}` : ''}` : ''}
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate(ROUTES.AFIRMACION_EVENTOS)}
              className="gap-2 bg-white text-[#0b2a4a] shadow-sm hover:bg-white/90 border-transparent"
            >
              <ArrowLeft className="h-4 w-4" /> Volver a eventos
            </Button>
            {evento && (
              <Button onClick={() => setEditarAbierto(true)} className="gap-2 bg-white/15 text-white shadow-sm hover:bg-white/25 border border-white/30">
                <Pencil className="h-4 w-4" /> Editar
              </Button>
            )}
          </div>
        }
      />

      {/* Estadísticas rápidas y grandes: personas + colaboradores */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {isLoading ? (
          <>
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
          </>
        ) : (
          <>
            <KpiMosaico label="Personas registradas" icon={Users} color={AZUL} sub="En este evento">
              {evento?.total_personas ?? 0}
            </KpiMosaico>
            <KpiMosaico label="Colaboradores" icon={UserCheck} color={TEAL} sub="Cargaron gente">
              {colaboradores.length}
            </KpiMosaico>
          </>
        )}
      </div>

      {/* Si hay un bloque activo, mostrar su lista de personas; si no, el resumen */}
      {bloqueActivo && evento ? (
        <BloquePersonas eventoId={evento.id} bloque={bloqueActivo} evento={evento} onVolver={() => setBloqueActivo(null)} />
      ) : (
        <>
          {/* Colaboradores (nombre + red) */}
          <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <TarjetaHeader icon={UserCheck} color={TEAL} titulo="Colaboradores" descripcion="Quiénes registraron gente en este evento" />
            <div className="p-5">
              {colaboradores.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía nadie cargó gente en este evento.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {colaboradores.map((c) => (
                    <div key={c.persona_id} className="flex items-center justify-between rounded-xl border border-border/50 px-3 py-2 text-sm">
                      <span className="font-medium">{c.nombre_completo}</span>
                      <span className="flex items-center gap-3 text-muted-foreground text-xs">
                        <span>{c.red_nombre ?? 'Sin red'}</span>
                        <span className="tabular-nums">{c.cantidad} registros</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Tarjetas-botón por bloque */}
          <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <TarjetaHeader icon={Calendar} color={AZUL} titulo="Actividades del evento" descripcion="Tocá una para ver y exportar sus personas" />
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {isLoading ? (
                <>
                  <Skeleton className="h-32 w-full rounded-2xl" />
                  <Skeleton className="h-32 w-full rounded-2xl" />
                </>
              ) : (
                evento &&
                bloques.map((b) => <BloqueCard key={b.id} eventoId={evento.id} bloque={b} onClick={() => setBloqueActivo(b)} />)
              )}
            </div>
          </section>
        </>
      )}

      {evento && <EditarEventoModal evento={evento} abierto={editarAbierto} onOpenChange={setEditarAbierto} />}
    </div>
  );
}
