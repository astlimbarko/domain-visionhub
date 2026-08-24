import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, GitMerge, Home, Search, UserRound, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { AZUL, VERDE, AMBAR, MORADO, gradienteHeroColor, degradadoIdentidadColor } from '@/components/dashboard/DashboardUI';
import { Timeline, type TimelineItem } from '@/components/shared/Timeline';
import { FichaPersonaSheet } from '@/components/personas/FichaPersonaSheet';
import { usePersonasDeRed } from '@/hooks/usePersonas';
import { useRedes } from '@/hooks/useCasasDePaz';
import { useContextoActivo } from '@/hooks/useContextoActivo';
import type { PersonaDeRed } from '@/types/persona.types';

const GRIS = '#8e8e93';
const INDIGO = '#5856d6';

/** Cuántas personas se muestran antes de "Mostrar más" (escala a redes grandes). */
const LOTE = 12;

/** Color estable por estado, para el avatar y el acento de cada persona. */
const COLOR_POR_ESTADO: Record<string, string> = { CRE: VERDE, NC: AZUL, SIM: AMBAR, REC: MORADO };
const PALETA_FALLBACK = [AZUL, VERDE, AMBAR, MORADO];
function colorEstado(sigla: string | null): string {
  if (!sigla) return GRIS;
  if (COLOR_POR_ESTADO[sigla]) return COLOR_POR_ESTADO[sigla];
  let h = 0;
  for (const ch of sigla) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETA_FALLBACK[h % PALETA_FALLBACK.length];
}

function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?';
}

/** DATE 'YYYY-MM-DD' → 'DD/MM/YYYY' sin corrimiento de zona horaria. */
function fechaCorta(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function trailProcedencia(p: PersonaDeRed): TimelineItem[] {
  return p.procedencia.map((item, i) => ({
    id: `${p.persona_id}-${i}`,
    dotColor: item.vigente ? VERDE : item.por_fusion ? AMBAR : GRIS,
    titulo: (
      <span className="flex flex-wrap items-center gap-1.5">
        {item.etiqueta}
        {item.vigente && <Badge variant="secondary" className="rounded-full text-[10px]">Actual</Badge>}
        {item.por_fusion && (
          <Badge variant="outline" className="gap-1 rounded-full border-amber-500 text-[10px] text-amber-600">
            <GitMerge className="h-2.5 w-2.5" /> Fusión
          </Badge>
        )}
      </span>
    ),
    fecha: item.fecha_fin ? `${fechaCorta(item.fecha_inicio)} – ${fechaCorta(item.fecha_fin)}` : `desde ${fechaCorta(item.fecha_inicio)}`,
    descripcion: item.motivo ?? undefined,
  }));
}

type Orden = 'NOMBRE' | 'RECIENTE' | 'ANTIGUO';

const OPCIONES_ORDEN: { value: Orden; label: string }[] = [
  { value: 'NOMBRE', label: 'Nombre (A-Z)' },
  { value: 'RECIENTE', label: 'Ingreso más reciente' },
  { value: 'ANTIGUO', label: 'Ingreso más antiguo' },
];

interface Props {
  redId: string;
}

/**
 * Roster de solo lectura de las personas de la Red (Líder de Red). Arriba, un
 * hero con la composición por estado de un vistazo; abajo, cada persona con el
 * color de su estado (avatar + acento) y su procedencia. Escala a redes grandes
 * con buscador, filtros y "Mostrar más". El detalle abre el FichaPersonaSheet.
 */
export function PersonasDeRedVista({ redId }: Props) {
  const { data: personas = [], isLoading } = usePersonasDeRed(redId);
  const { contextoActivo } = useContextoActivo();
  const iglesiaId = contextoActivo && 'iglesiaId' in contextoActivo ? contextoActivo.iglesiaId : undefined;
  const { data: redes = [] } = useRedes(iglesiaId);
  const colorRedInfo = redes.find((r) => r.id === redId)?.color;
  // KAN-251: color elegido para la Red en el Constructor -- blanco es el
  // valor "sin elegir" (mismo criterio que layout.ts/PanelRedEstructura).
  const colorRed = colorRedInfo && colorRedInfo.toUpperCase() !== '#FFFFFF' ? colorRedInfo : null;

  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState('TODOS');
  const [cdp, setCdp] = useState('TODAS');
  const [orden, setOrden] = useState<Orden>('NOMBRE');
  const [visibles, setVisibles] = useState(LOTE);
  const [expandidoId, setExpandidoId] = useState<string>();
  const [seleccionadaId, setSeleccionadaId] = useState<string>();

  function alternarEstado(sigla: string) {
    setEstado((actual) => (actual === sigla ? 'TODOS' : sigla));
    setVisibles(LOTE);
  }

  const estados = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of personas) if (p.estado_sigla) m.set(p.estado_sigla, p.estado_nombre ?? p.estado_sigla);
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [personas]);

  const conteoPorEstado = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of personas) if (p.estado_sigla) m.set(p.estado_sigla, (m.get(p.estado_sigla) ?? 0) + 1);
    return m;
  }, [personas]);

  const casas = useMemo(() => {
    const s = new Set<string>();
    for (const p of personas) s.add(p.casa_de_paz_etiqueta);
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [personas]);

  // Composición por estado, para el hero.
  const composicion = useMemo(() => {
    const m = new Map<string, { nombre: string; count: number }>();
    for (const p of personas) {
      const k = p.estado_sigla ?? '—';
      const prev = m.get(k) ?? { nombre: p.estado_nombre ?? k, count: 0 };
      m.set(k, { nombre: prev.nombre, count: prev.count + 1 });
    }
    return Array.from(m.entries())
      .map(([sigla, v]) => ({ sigla, nombre: v.nombre, count: v.count, color: colorEstado(sigla === '—' ? null : sigla) }))
      .sort((a, b) => b.count - a.count);
  }, [personas]);

  const totalFusion = personas.filter((p) => p.proviene_de_fusion).length;

  const filtradas = useMemo(() => {
    const q = texto.trim().toLowerCase();
    const resultado = personas.filter((p) => {
      if (q && !p.nombre_completo.toLowerCase().includes(q) && !p.casa_de_paz_etiqueta.toLowerCase().includes(q) && !(p.lider_nombre ?? '').toLowerCase().includes(q)) return false;
      if (estado !== 'TODOS' && p.estado_sigla !== estado) return false;
      if (cdp !== 'TODAS' && p.casa_de_paz_etiqueta !== cdp) return false;
      return true;
    });
    const ordenadas = [...resultado];
    if (orden === 'NOMBRE') {
      ordenadas.sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));
    } else {
      // Sin fecha de ingreso, la persona queda al final sin importar la dirección elegida.
      ordenadas.sort((a, b) => {
        if (!a.fecha_ingreso && !b.fecha_ingreso) return 0;
        if (!a.fecha_ingreso) return 1;
        if (!b.fecha_ingreso) return -1;
        return orden === 'RECIENTE' ? b.fecha_ingreso.localeCompare(a.fecha_ingreso) : a.fecha_ingreso.localeCompare(b.fecha_ingreso);
      });
    }
    return ordenadas;
  }, [personas, texto, estado, cdp, orden]);
  const visiblesLista = filtradas.slice(0, visibles);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Hero: composición de la Red ────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl px-6 py-6 sm:px-8" style={{ background: colorRed ? gradienteHeroColor(colorRed) : 'linear-gradient(135deg, var(--brand-navy) 0%, var(--brand-navy-soft) 100%)' }}>
        <div className="pointer-events-none absolute -top-16 -right-12 h-52 w-52 rounded-full opacity-30 blur-3xl" style={{ background: colorRed ?? INDIGO }} />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl" style={{ background: colorRed ? degradadoIdentidadColor(colorRed) : `linear-gradient(135deg, ${INDIGO}, color-mix(in oklab, ${INDIGO} 70%, #000))`, boxShadow: '0 10px 22px -8px rgba(0, 0, 0, 0.35)' }}>
              <Users className="h-7 w-7 text-white" strokeWidth={2.1} />
            </span>
            <div>
              <p className="text-[11px] font-semibold tracking-[0.16em] text-white/55 uppercase">Personas de la Red</p>
              <h2 className="font-heading text-[28px] leading-none font-bold tracking-tight text-white">{personas.length}</h2>
              <p className="mt-1.5 text-[13px] text-white/70">
                {casas.length} Casa{casas.length === 1 ? '' : 's'} de Paz
                {totalFusion > 0 && <> · <span className="text-amber-300">{totalFusion} por fusión</span></>}
              </p>
            </div>
          </div>
          {composicion.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {composicion.map((c) => {
                const activo = estado === c.sigla;
                const clickable = c.sigla !== '—';
                return (
                  <button
                    key={c.sigla}
                    type="button"
                    disabled={!clickable}
                    aria-pressed={activo}
                    onClick={() => clickable && alternarEstado(c.sigla)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium text-white transition-colors',
                      clickable ? 'cursor-pointer hover:bg-white/20' : 'cursor-default',
                      activo ? 'bg-white/25' : 'bg-white/10'
                    )}
                    style={activo ? { boxShadow: `0 0 0 1.5px color-mix(in oklab, ${c.color} 70%, white)` } : undefined}
                    title={clickable ? `Filtrar por ${c.nombre}` : c.nombre}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: c.color }} /> {c.count} {c.sigla}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Filtros ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full flex-1 sm:min-w-[220px]">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input className="h-11 rounded-2xl border-border bg-muted/50 pl-10 text-[14px]" placeholder="Buscar persona, Casa de Paz o líder..." value={texto} onChange={(e) => { setTexto(e.target.value); setVisibles(LOTE); }} />
        </div>
        {estados.length > 0 && (
          <Select value={estado} onValueChange={(v) => { setEstado(v); setVisibles(LOTE); }}>
            <SelectTrigger className="h-11 w-full rounded-2xl sm:w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos los estados</SelectItem>
              {estados.map(([sigla, nombre]) => (
                <SelectItem key={sigla} value={sigla}>
                  {nombre} ({conteoPorEstado.get(sigla) ?? 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {casas.length > 1 && (
          <Select value={cdp} onValueChange={(v) => { setCdp(v); setVisibles(LOTE); }}>
            <SelectTrigger className="h-11 w-full rounded-2xl sm:w-52"><SelectValue placeholder="Casa de Paz" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAS">Todas las Casas de Paz</SelectItem>
              {casas.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
            </SelectContent>
          </Select>
        )}
        <Select value={orden} onValueChange={(v) => setOrden(v as Orden)}>
          <SelectTrigger className="h-11 w-full rounded-2xl sm:w-48"><SelectValue placeholder="Ordenar" /></SelectTrigger>
          <SelectContent>
            {OPCIONES_ORDEN.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Listado ────────────────────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader icon={Users} color={INDIGO} titulo="Miembros de la Red" descripcion={`${filtradas.length} de ${personas.length} persona(s)`} />
        <div className="flex flex-col gap-2 p-5">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)
          ) : personas.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <UserRound className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-[13px] text-muted-foreground">Las Casas de Paz de esta Red todavía no tienen miembros.</p>
            </div>
          ) : filtradas.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nadie coincide con los filtros.</p>
          ) : (
            <>
              {visiblesLista.map((p) => {
                const abierto = expandidoId === p.persona_id;
                const color = colorEstado(p.estado_sigla);
                return (
                  <div
                    key={p.persona_id}
                    className="relative overflow-hidden rounded-xl border border-border/60 shadow-[0_1px_5px_-2px_rgba(0,0,0,0.05)] transition-all hover:border-primary/30 hover:shadow-[0_6px_16px_-8px_rgba(0,0,0,0.18)]"
                    style={{ background: `color-mix(in oklab, ${color} 4%, var(--card))` }}
                  >
                    <span className="absolute top-0 left-0 h-full w-1" style={{ background: color }} />
                    <div className="flex items-center gap-3 py-2 pr-2 pl-3.5">
                      <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setSeleccionadaId(p.persona_id)}>
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                          style={{ backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)`, color, boxShadow: `0 0 0 2px color-mix(in oklab, ${color} 22%, transparent)` }}
                        >
                          {iniciales(p.nombre_completo)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 truncate text-[14px] font-semibold text-foreground">
                            <span className="truncate">{p.nombre_completo}</span>
                            {p.estado_sigla && (
                              <span className="inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `color-mix(in oklab, ${color} 15%, transparent)`, color }} title={p.estado_nombre ?? undefined}>
                                {p.estado_sigla}
                              </span>
                            )}
                            {p.proviene_de_fusion && <GitMerge className="h-3 w-3 shrink-0 text-amber-500" aria-label="Llegó por fusión" />}
                          </p>
                          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <Home className="h-3 w-3 shrink-0" />
                            <span className="truncate">{p.casa_de_paz_etiqueta}</span>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="truncate">{p.lider_nombre ?? 'Sin líder'}</span>
                            {p.edad !== null && <span className="hidden text-muted-foreground/40 sm:inline">·</span>}
                            {p.edad !== null && <span className="hidden shrink-0 sm:inline">{p.edad} años</span>}
                            <span className="hidden text-muted-foreground/40 sm:inline">·</span>
                            <span className="hidden shrink-0 sm:inline">Ingreso {fechaCorta(p.fecha_ingreso)}</span>
                          </p>
                        </div>
                      </button>
                      {p.procedencia.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 shrink-0 gap-1 rounded-lg px-2 text-xs text-muted-foreground"
                          onClick={() => setExpandidoId(abierto ? undefined : p.persona_id)}
                          title="Procedencia (historial de Casas de Paz)"
                        >
                          {p.procedencia.length} CdP
                          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', abierto && 'rotate-180')} />
                        </Button>
                      )}
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/30" aria-hidden />
                    </div>

                    {abierto && (
                      <div className="border-t border-border/50 bg-muted/30 px-4 py-3 pl-[52px]">
                        <p className="mb-2 text-[11px] font-medium text-muted-foreground">Procedencia de {p.nombre_completo}</p>
                        <Timeline items={trailProcedencia(p)} />
                      </div>
                    )}
                  </div>
                );
              })}

              {filtradas.length > visibles && (
                <Button variant="outline" className="mt-1 w-full rounded-xl" onClick={() => setVisibles((v) => v + LOTE)}>
                  Mostrar más ({filtradas.length - visibles} restantes)
                </Button>
              )}
            </>
          )}
        </div>
      </section>

      <FichaPersonaSheet personaId={seleccionadaId} onOpenChange={(open) => !open && setSeleccionadaId(undefined)} />
    </div>
  );
}
