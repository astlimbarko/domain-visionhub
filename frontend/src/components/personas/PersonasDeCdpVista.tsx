import { useMemo, useState } from 'react';
import { Phone, Search, UserRound, Users } from 'lucide-react';
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
import { AZUL, VERDE, AMBAR, MORADO } from '@/components/dashboard/DashboardUI';
import { FichaPersonaSheet } from '@/components/personas/FichaPersonaSheet';
import { usePersonasDeCdp } from '@/hooks/usePersonas';
import type { PersonaDeCdp } from '@/types/persona.types';

const GRIS = '#8e8e93';
const INDIGO = '#5856d6';

/** Cuántas personas se muestran antes de "Mostrar más". */
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

type Orden = 'NOMBRE' | 'RECIENTE' | 'ANTIGUO';

const OPCIONES_ORDEN: { value: Orden; label: string }[] = [
  { value: 'NOMBRE', label: 'Nombre (A-Z)' },
  { value: 'RECIENTE', label: 'Ingreso más reciente' },
  { value: 'ANTIGUO', label: 'Ingreso más antiguo' },
];

interface Props {
  casaDePazId: string;
}

/**
 * Roster de solo lectura de los miembros vigentes de la Casa de Paz (Líder de
 * CdP). Mismo patrón que PersonasDeRedVista, sin filtro de CdP (ya es una
 * sola) ni procedencia (no aporta cuando es obvio de qué CdP se trata). El
 * detalle abre el mismo FichaPersonaSheet que el resto de "Personas".
 */
export function PersonasDeCdpVista({ casaDePazId }: Props) {
  const { data: personas = [], isLoading } = usePersonasDeCdp(casaDePazId);

  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState('TODOS');
  const [orden, setOrden] = useState<Orden>('NOMBRE');
  const [visibles, setVisibles] = useState(LOTE);
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

  const filtradas = useMemo(() => {
    const q = texto.trim().toLowerCase();
    const resultado = personas.filter((p: PersonaDeCdp) => {
      if (q && !p.nombre_completo.toLowerCase().includes(q) && !(p.ci ?? '').toLowerCase().includes(q)) return false;
      if (estado !== 'TODOS' && p.estado_sigla !== estado) return false;
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
  }, [personas, texto, estado, orden]);
  const visiblesLista = filtradas.slice(0, visibles);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Hero: composición de la Casa de Paz ───────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl px-6 py-6 sm:px-8" style={{ background: 'linear-gradient(135deg, var(--brand-navy) 0%, var(--brand-navy-soft) 100%)' }}>
        <div className="pointer-events-none absolute -top-16 -right-12 h-52 w-52 rounded-full opacity-30 blur-3xl" style={{ background: INDIGO }} />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl" style={{ background: `linear-gradient(135deg, ${INDIGO}, color-mix(in oklab, ${INDIGO} 70%, #000))`, boxShadow: '0 10px 22px -8px rgba(0, 0, 0, 0.35)' }}>
              <Users className="h-7 w-7 text-white" strokeWidth={2.1} />
            </span>
            <div>
              <p className="text-[11px] font-semibold tracking-[0.16em] text-white/55 uppercase">Personas de mi Casa de Paz</p>
              <h2 className="font-heading text-[28px] leading-none font-bold tracking-tight text-white">{personas.length}</h2>
              <p className="mt-1.5 text-[13px] text-white/70">miembro{personas.length === 1 ? '' : 's'} vigente{personas.length === 1 ? '' : 's'}</p>
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
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium text-white transition-colors ${clickable ? 'cursor-pointer hover:bg-white/20' : 'cursor-default'} ${activo ? 'bg-white/25' : 'bg-white/10'}`}
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
          <Input className="h-11 rounded-2xl border-border bg-muted/50 pl-10 text-[14px]" placeholder="Buscar por nombre o CI..." value={texto} onChange={(e) => { setTexto(e.target.value); setVisibles(LOTE); }} />
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
        <Select value={orden} onValueChange={(v) => setOrden(v as Orden)}>
          <SelectTrigger className="h-11 w-full rounded-2xl sm:w-48"><SelectValue placeholder="Ordenar" /></SelectTrigger>
          <SelectContent>
            {OPCIONES_ORDEN.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Listado ────────────────────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader icon={Users} color={INDIGO} titulo="Miembros de la Casa de Paz" descripcion={`${filtradas.length} de ${personas.length} persona(s)`} />
        <div className="flex flex-col gap-2 p-5">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)
          ) : personas.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <UserRound className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-[13px] text-muted-foreground">Tu Casa de Paz todavía no tiene miembros.</p>
            </div>
          ) : filtradas.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nadie coincide con los filtros.</p>
          ) : (
            <>
              {visiblesLista.map((p) => {
                const color = colorEstado(p.estado_sigla);
                return (
                  <button
                    key={p.persona_id}
                    type="button"
                    className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-border/60 py-2 pr-2 pl-3.5 text-left shadow-[0_1px_5px_-2px_rgba(0,0,0,0.05)] transition-all hover:border-primary/30 hover:shadow-[0_6px_16px_-8px_rgba(0,0,0,0.18)]"
                    style={{ background: `color-mix(in oklab, ${color} 4%, var(--card))` }}
                    onClick={() => setSeleccionadaId(p.persona_id)}
                  >
                    <span className="absolute top-0 left-0 h-full w-1" style={{ background: color }} />
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
                        {!p.es_miembro_formal && (
                          <Badge variant="outline" className="shrink-0 rounded-full text-[10px] font-normal text-muted-foreground" title="Todavía no tiene membresía formal (requiere bautismo)">
                            Sin membresía
                          </Badge>
                        )}
                      </p>
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        {p.edad !== null && <span className="shrink-0">{p.edad} años</span>}
                        {p.edad !== null && <span className="text-muted-foreground/40">·</span>}
                        <span className="shrink-0">Ingreso {fechaCorta(p.fecha_ingreso)}</span>
                        {p.telefono_principal && <span className="hidden text-muted-foreground/40 sm:inline">·</span>}
                        {p.telefono_principal && (
                          <span className="hidden shrink-0 items-center gap-1 sm:inline-flex">
                            <Phone className="h-3 w-3" /> {p.telefono_principal}
                          </span>
                        )}
                      </p>
                    </div>
                    {p.ci && <Badge variant="secondary" className="hidden shrink-0 rounded-full text-[10px] sm:inline-flex">CI {p.ci}</Badge>}
                  </button>
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
