import { useMemo, useState } from 'react';
import { ClipboardCheck, Search, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
import { DonutRing } from '@/components/dashboard/DonutRing';
import { SeccionIconHeader } from '@/components/shared/SeccionIconHeader';
import { useAuthStore } from '@/store/auth.store';
import { useCdps } from '@/hooks/useCasasDePaz';
import { useReportesRedRango } from '@/hooks/useReporte';
import { aISO, finSemanaISO, inicioSemanaISO } from '@/utils/calendario-fechas';

const VENTANA_SEMANAS = 8;
const LOTE = 12;
const VERDE = 'var(--chart-2)';
const AMBAR = 'var(--chart-3)';

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function semanasVentana(hoy: Date, n: number): { inicio: string; fin: string }[] {
  const semanas: { inicio: string; fin: string }[] = [];
  let cursorISO = inicioSemanaISO(aISO(hoy));
  for (let i = 0; i < n; i++) {
    semanas.push({ inicio: cursorISO, fin: finSemanaISO(cursorISO) });
    const anterior = new Date(`${cursorISO}T00:00:00`);
    anterior.setDate(anterior.getDate() - 7);
    cursorISO = aISO(anterior);
  }
  return semanas;
}

function etiquetaSemana(inicioISO: string): string {
  const d = new Date(`${inicioISO}T00:00:00`);
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`;
}

/** DATE 'YYYY-MM-DD' → 'DD/MM' sin corrimiento de zona horaria. */
function fechaCorta(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

type FiltroEstado = 'TODAS' | 'ENTREGO' | 'PENDIENTE';

interface Props {
  redId: string;
}

/**
 * Control de Reportes del Líder de Red (solo lectura). Hero de estado semanal +
 * una matriz compacta Casa de Paz × semana (un solo encabezado de semanas y
 * filas alineadas) que escala a redes con muchas Casas de Paz: buscador, filtro
 * y "Mostrar más". Las Casas de Paz inactivas no aparecen.
 */
export function ControlReportesVista({ redId }: Props) {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const { data: cdpsTodas = [], isLoading: cargandoCdps } = useCdps(iglesiaActivaId, redId);
  const cdps = useMemo(() => cdpsTodas.filter((c) => c.activo), [cdpsTodas]);

  const semanas = useMemo(() => semanasVentana(new Date(), VENTANA_SEMANAS), []);
  const semanaActual = semanas[0]?.inicio;
  const desde = semanas[semanas.length - 1]?.inicio ?? aISO(new Date());
  const hasta = aISO(new Date());

  const cdpIds = useMemo(() => cdps.map((c) => c.id), [cdps]);
  const { data: reportes = [], isLoading: cargandoReportes } = useReportesRedRango(cdpIds, desde, hasta);

  // clave "cdpId:semanaInicio" -> { total, fecha }. Un reporte por CdP y semana.
  const porCdpSemana = useMemo(() => {
    const mapa = new Map<string, { total: number; fecha: string }>();
    for (const r of reportes) mapa.set(`${r.casa_de_paz_id}:${inicioSemanaISO(r.fecha_reunion)}`, { total: r.total_asistentes, fecha: r.fecha_reunion });
    return mapa;
  }, [reportes]);

  const entregoEstaSemana = (cdpId: string) => semanaActual !== undefined && porCdpSemana.has(`${cdpId}:${semanaActual}`);

  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState<FiltroEstado>('TODAS');
  const [lider, setLider] = useState<string>('TODOS');
  const [visibles, setVisibles] = useState(LOTE);

  const lideres = useMemo(() => {
    const set = new Set<string>();
    for (const c of cdps) if (c.lider_nombre) set.add(c.lider_nombre);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [cdps]);

  const cdpsFiltradas = useMemo(() => {
    const q = texto.trim().toLowerCase();
    return cdps.filter((c) => {
      if (q && !c.etiqueta.toLowerCase().includes(q) && !(c.lider_nombre ?? '').toLowerCase().includes(q)) return false;
      if (lider !== 'TODOS' && c.lider_nombre !== lider) return false;
      if (estado === 'ENTREGO' && !entregoEstaSemana(c.id)) return false;
      if (estado === 'PENDIENTE' && entregoEstaSemana(c.id)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cdps, texto, lider, estado, porCdpSemana, semanaActual]);
  const cdpsVisibles = cdpsFiltradas.slice(0, visibles);

  const total = cdps.length;
  const entregaron = cdps.filter((c) => entregoEstaSemana(c.id)).length;
  const pendientes = total - entregaron;
  const pctEntregaron = total > 0 ? Math.round((entregaron / total) * 100) : 0;
  const asistenciaSemana = cdps.reduce((s, c) => s + (porCdpSemana.get(`${c.id}:${semanaActual}`)?.total ?? 0), 0);
  const todoOk = total > 0 && pendientes === 0;

  const cargando = cargandoCdps || cargandoReportes;
  const grid = { gridTemplateColumns: `minmax(150px, 1.4fr) repeat(${VENTANA_SEMANAS}, minmax(46px, 1fr))` };

  return (
    <div className="flex flex-col gap-6">
      {/* ── Hero de estado semanal ────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl px-6 py-7 sm:px-8" style={{ background: 'linear-gradient(135deg, var(--brand-navy) 0%, var(--brand-navy-soft) 100%)' }}>
        <div className="pointer-events-none absolute -top-20 -right-12 h-64 w-64 rounded-full opacity-40 blur-3xl" style={{ background: todoOk ? VERDE : AMBAR }} />
        <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
          <DonutRing porcentaje={pctEntregaron} size={112} strokeWidth={10} color={todoOk ? VERDE : AMBAR} trackColor="rgba(255,255,255,0.16)">
            <div className="flex flex-col items-center leading-none text-white">
              <span className="text-[28px] font-bold tracking-tight">{entregaron}</span>
              <span className="text-xs text-white/50">de {total}</span>
            </div>
          </DonutRing>
          <div className="min-w-0 text-center sm:text-left">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-white/55 uppercase">Entrega semanal · semana del {semanaActual ? etiquetaSemana(semanaActual) : '—'}</p>
            <h2 className="font-heading mt-1.5 text-[26px] leading-tight font-bold tracking-tight text-white">
              {total === 0 ? 'Sin Casas de Paz activas' : todoOk ? 'Toda la Red reportó esta semana' : `${pendientes} Casa${pendientes === 1 ? '' : 's'} de Paz sin reporte`}
            </h2>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[13px] font-medium text-white"><span className="h-2 w-2 rounded-full" style={{ background: VERDE }} /> {entregaron} entregaron</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[13px] font-medium text-white"><span className="h-2 w-2 rounded-full" style={{ background: AMBAR }} /> {pendientes} pendientes</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[13px] font-medium text-white"><Users className="h-3.5 w-3.5 text-white/70" /> {asistenciaSemana} asistentes</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filtros ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input className="h-11 rounded-2xl border-border bg-muted/50 pl-10 text-[14px]" placeholder="Buscar Casa de Paz o líder..." value={texto} onChange={(e) => { setTexto(e.target.value); setVisibles(LOTE); }} />
        </div>
        <Select value={estado} onValueChange={(v) => { setEstado(v as FiltroEstado); setVisibles(LOTE); }}>
          <SelectTrigger className="h-11 w-full rounded-2xl sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODAS">Todas</SelectItem>
            <SelectItem value="ENTREGO">Entregaron</SelectItem>
            <SelectItem value="PENDIENTE">Pendientes</SelectItem>
          </SelectContent>
        </Select>
        {lideres.length > 0 && (
          <Select value={lider} onValueChange={(v) => { setLider(v); setVisibles(LOTE); }}>
            <SelectTrigger className="h-11 w-full rounded-2xl sm:w-52"><SelectValue placeholder="Líder" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos los líderes</SelectItem>
              {lideres.map((l) => (<SelectItem key={l} value={l}>{l}</SelectItem>))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* ── Matriz Casa de Paz × semana (compacta y escalable) ─────────────────── */}
      <Card className="rounded-3xl">
        <CardHeader>
          <SeccionIconHeader icon={ClipboardCheck} color={VERDE} titulo="Entrega por Casa de Paz" descripcion={`Últimas ${VENTANA_SEMANAS} semanas · ${cdpsFiltradas.length} de ${total} Casa(s) de Paz activa(s)`} />
        </CardHeader>
        <CardContent>
          {cargando ? (
            <div className="flex flex-col gap-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-xl" />)}</div>
          ) : total === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Esta Red no tiene Casas de Paz activas.</p>
          ) : cdpsFiltradas.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Ninguna Casa de Paz coincide con los filtros.</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[520px]">
                {/* Encabezado de semanas (una sola vez) */}
                <div className="grid items-end gap-1.5 pb-2" style={grid}>
                  <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Casa de Paz</span>
                  {semanas.map((s, i) => (
                    <div key={s.inicio} className="text-center">
                      <span className={cn('block text-[11px]', i === 0 ? 'font-bold text-foreground' : 'text-muted-foreground')}>{etiquetaSemana(s.inicio)}</span>
                      {i === 0 && <span className="block text-[9px] font-medium text-primary">esta sem.</span>}
                    </div>
                  ))}
                </div>

                {/* Filas */}
                <div className="flex flex-col gap-1.5">
                  {cdpsVisibles.map((c) => (
                    <div key={c.id} className="grid items-center gap-1.5 rounded-xl border border-border/60 bg-card/60 py-1.5 pr-2 pl-3" style={grid}>
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: entregoEstaSemana(c.id) ? VERDE : AMBAR }} title={entregoEstaSemana(c.id) ? 'Entregó esta semana' : 'Pendiente esta semana'} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{c.etiqueta}</p>
                          {c.lider_nombre && <p className="truncate text-[11px] text-muted-foreground">{c.lider_nombre}</p>}
                        </div>
                      </div>
                      {semanas.map((s, i) => {
                        const celda = porCdpSemana.get(`${c.id}:${s.inicio}`);
                        const e = celda !== undefined;
                        return (
                          <div
                            key={s.inicio}
                            className={cn('flex h-9 items-center justify-center rounded-lg text-sm font-bold tabular-nums')}
                            style={
                              e
                                ? { backgroundColor: `color-mix(in oklab, ${VERDE} 16%, transparent)`, color: VERDE, ...(i === 0 ? { boxShadow: `inset 0 0 0 1.5px color-mix(in oklab, ${VERDE} 50%, transparent)` } : {}) }
                                : { backgroundColor: 'var(--muted)', color: 'color-mix(in oklab, var(--muted-foreground) 45%, transparent)' }
                            }
                            title={e ? `${celda!.total} asistentes · reunión ${fechaCorta(celda!.fecha)}` : `Sin reporte (semana del ${etiquetaSemana(s.inicio)})`}
                          >
                            {e ? celda!.total : '·'}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {cdpsFiltradas.length > visibles && (
                  <Button variant="outline" className="mt-3 w-full rounded-xl" onClick={() => setVisibles((v) => v + LOTE)}>
                    Mostrar más ({cdpsFiltradas.length - visibles} restantes)
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
