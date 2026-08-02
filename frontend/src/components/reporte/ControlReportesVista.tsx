import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ClipboardCheck, Search, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
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
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { VERDE, AMBAR } from '@/components/dashboard/DashboardUI';
import { useAuthStore } from '@/store/auth.store';
import { useCdps } from '@/hooks/useCasasDePaz';
import { useReportesRedRango } from '@/hooks/useReporte';
import { aISO, finSemanaISO, inicioSemanaISO, nombreMes } from '@/utils/calendario-fechas';

const LOTE = 12;
const ROJO = 'var(--destructive)';

// Días de gracia desde la fecha de la reunión para considerar el reporte "a
// tiempo" -- pedido del owner, 2026-08-02: 3 colores en vez de 2 (verde =
// presentó a tiempo, naranja = presentó con retraso, rojo = no presentó).
// No hay un criterio configurable para esto todavía (a diferencia de
// EDAD_MINIMA_CREYENTE, etc.) -- si el owner pide ajustarlo, se mueve a
// configuracion_definicion en vez de este número fijo.
const DIAS_PLAZO_REPORTE = 2;

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

type EstadoCelda = 'VERDE' | 'NARANJA' | 'ROJO' | 'PENDIENTE';

function coloresPorEstado(estado: EstadoCelda) {
  switch (estado) {
    case 'VERDE':
      return { bg: `color-mix(in oklab, ${VERDE} 16%, transparent)`, fg: VERDE };
    case 'NARANJA':
      return { bg: `color-mix(in oklab, ${AMBAR} 16%, transparent)`, fg: AMBAR };
    case 'ROJO':
      return { bg: `color-mix(in oklab, ${ROJO} 14%, transparent)`, fg: ROJO };
    case 'PENDIENTE':
    default:
      return { bg: 'var(--muted)', fg: 'color-mix(in oklab, var(--muted-foreground) 45%, transparent)' };
  }
}

/** Semanas (lunes a domingo) que tocan el mes dado -- típicamente 4 o 5, según cómo caigan los bordes del mes. */
function semanasDelMes(anio: number, mes: number): { inicio: string; fin: string }[] {
  const primerDia = aISO(new Date(anio, mes, 1));
  const ultimoDia = aISO(new Date(anio, mes + 1, 0));
  const semanas: { inicio: string; fin: string }[] = [];
  let cursor = inicioSemanaISO(primerDia);
  while (cursor <= ultimoDia) {
    semanas.push({ inicio: cursor, fin: finSemanaISO(cursor) });
    const siguiente = new Date(`${cursor}T00:00:00`);
    siguiente.setDate(siguiente.getDate() + 7);
    cursor = aISO(siguiente);
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

/** Días de calendario entre la fecha de la reunión y cuándo se cargó el reporte (puede dar 0 si se cargó el mismo día). */
function diasDeDemora(fechaReunionISO: string, fechaCreacionTS: string): number {
  const reunion = new Date(`${fechaReunionISO}T00:00:00`);
  const creacion = new Date(fechaCreacionTS);
  const creacionSoloFecha = new Date(creacion.getFullYear(), creacion.getMonth(), creacion.getDate());
  return Math.round((creacionSoloFecha.getTime() - reunion.getTime()) / 86400000);
}

type FiltroEstado = 'TODAS' | 'VERDE' | 'NARANJA' | 'ROJO';

interface Props {
  redId: string;
}

/**
 * Control de Reportes del Líder de Red (solo lectura). Vista mensual (antes
 * era una ventana rolling de 8 semanas): dentro de cada mes se entrega un
 * reporte por semana, y cada casilla Casa de Paz × semana tiene uno de 3
 * estados -- verde (a tiempo), naranja (con retraso) o rojo (no presentó,
 * solo si la semana ya terminó). Las semanas todavía en curso o futuras
 * dentro del mes se ven en gris neutro, no rojo, para no marcar como
 * "incumplida" una semana que todavía no terminó.
 */
export function ControlReportesVista({ redId }: Props) {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const { data: cdpsTodas = [], isLoading: cargandoCdps } = useCdps(iglesiaActivaId, redId);
  const cdps = useMemo(() => cdpsTodas.filter((c) => c.activo), [cdpsTodas]);

  const hoyDate = new Date();
  const [anio, setAnio] = useState(hoyDate.getFullYear());
  const [mes, setMes] = useState(hoyDate.getMonth());
  const hoy = aISO(hoyDate);

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

  const semanas = useMemo(() => semanasDelMes(anio, mes), [anio, mes]);
  const desde = semanas[0]?.inicio ?? aISO(new Date(anio, mes, 1));
  const hasta = semanas[semanas.length - 1]?.fin ?? aISO(new Date(anio, mes + 1, 0));

  const cdpIds = useMemo(() => cdps.map((c) => c.id), [cdps]);
  const { data: reportes = [], isLoading: cargandoReportes } = useReportesRedRango(cdpIds, desde, hasta);

  // clave "cdpId:semanaInicio" -> reporte de esa semana. Un reporte por CdP y semana.
  const porCdpSemana = useMemo(() => {
    const mapa = new Map<string, { total: number; fecha: string; fechaCreacion: string }>();
    for (const r of reportes) {
      mapa.set(`${r.casa_de_paz_id}:${inicioSemanaISO(r.fecha_reunion)}`, {
        total: r.total_asistentes,
        fecha: r.fecha_reunion,
        fechaCreacion: r.fecha_creacion,
      });
    }
    return mapa;
  }, [reportes]);

  function estadoCelda(cdpId: string, semana: { inicio: string; fin: string }): EstadoCelda {
    const celda = porCdpSemana.get(`${cdpId}:${semana.inicio}`);
    if (celda) {
      return diasDeDemora(celda.fecha, celda.fechaCreacion) <= DIAS_PLAZO_REPORTE ? 'VERDE' : 'NARANJA';
    }
    return semana.fin < hoy ? 'ROJO' : 'PENDIENTE';
  }

  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState<FiltroEstado>('TODAS');
  const [lider, setLider] = useState<string>('TODOS');
  const [visibles, setVisibles] = useState(LOTE);

  const lideres = useMemo(() => {
    const set = new Set<string>();
    for (const c of cdps) if (c.lider_nombre) set.add(c.lider_nombre);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [cdps]);

  // Estado del mes para cada CdP: el peor de sus semanas ya vencidas (rojo >
  // naranja > verde), para que el filtro y el punto de la fila reflejen todo
  // el mes, no solo la semana actual como antes.
  function estadoDelMes(cdpId: string): EstadoCelda {
    let peor: EstadoCelda = 'VERDE';
    for (const s of semanas) {
      const e = estadoCelda(cdpId, s);
      if (e === 'ROJO') return 'ROJO';
      if (e === 'NARANJA') peor = 'NARANJA';
    }
    return peor;
  }

  const cdpsFiltradas = useMemo(() => {
    const q = texto.trim().toLowerCase();
    return cdps.filter((c) => {
      if (q && !c.etiqueta.toLowerCase().includes(q) && !(c.lider_nombre ?? '').toLowerCase().includes(q)) return false;
      if (lider !== 'TODOS' && c.lider_nombre !== lider) return false;
      if (estado !== 'TODAS' && estadoDelMes(c.id) !== estado) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cdps, texto, lider, estado, porCdpSemana, semanas]);
  const cdpsVisibles = cdpsFiltradas.slice(0, visibles);

  // Resumen del mes: cuenta cada casilla ya vencida (ignora las PENDIENTE,
  // que todavía no tienen resultado) en vez de solo la semana actual.
  const total = cdps.length;
  let verdes = 0, naranjas = 0, rojos = 0, asistenciaMes = 0;
  for (const c of cdps) {
    for (const s of semanas) {
      const e = estadoCelda(c.id, s);
      if (e === 'VERDE') verdes++;
      else if (e === 'NARANJA') naranjas++;
      else if (e === 'ROJO') rojos++;
      const celda = porCdpSemana.get(`${c.id}:${s.inicio}`);
      if (celda) asistenciaMes += celda.total;
    }
  }
  const vencidas = verdes + naranjas + rojos;
  const pctCumplimiento = vencidas > 0 ? Math.round(((verdes + naranjas) / vencidas) * 100) : 0;
  const todoOk = vencidas > 0 && rojos === 0 && naranjas === 0;
  const colorHero = rojos > 0 ? ROJO : naranjas > 0 ? AMBAR : VERDE;

  const cargando = cargandoCdps || cargandoReportes;
  const grid = { gridTemplateColumns: `minmax(150px, 1.4fr) repeat(${semanas.length}, minmax(46px, 1fr))` };

  return (
    <div className="flex flex-col gap-6">
      {/* ── Selector de mes ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-muted/20 p-2 sm:justify-start sm:pl-4">
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={irMesAnterior} aria-label="Mes anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="w-40 text-center text-sm font-semibold tracking-tight capitalize">{nombreMes(anio, mes)}</span>
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={irMesSiguiente} aria-label="Mes siguiente">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Hero de cumplimiento del mes ──────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl px-6 py-7 sm:px-8" style={{ background: 'linear-gradient(135deg, var(--brand-navy) 0%, var(--brand-navy-soft) 100%)' }}>
        <div className="pointer-events-none absolute -top-20 -right-12 h-64 w-64 rounded-full opacity-40 blur-3xl" style={{ background: colorHero }} />
        <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
          <DonutRing porcentaje={pctCumplimiento} size={112} strokeWidth={10} color={colorHero} trackColor="rgba(255,255,255,0.16)">
            <div className="flex flex-col items-center leading-none text-white">
              <span className="text-[28px] font-bold tracking-tight">{pctCumplimiento}%</span>
              <span className="text-xs text-white/50">cumplimiento</span>
            </div>
          </DonutRing>
          <div className="min-w-0 text-center sm:text-left">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-white/55 uppercase">Cumplimiento de reportes · {nombreMes(anio, mes)}</p>
            <h2 className="font-heading mt-1.5 text-[26px] leading-tight font-bold tracking-tight text-white">
              {total === 0 ? 'Sin Casas de Paz activas' : vencidas === 0 ? 'Todavía no vence ningún reporte este mes' : todoOk ? 'Todo el mes al día' : `${rojos + naranjas} reporte${rojos + naranjas === 1 ? '' : 's'} con problema este mes`}
            </h2>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[13px] font-medium text-white"><span className="h-2 w-2 rounded-full" style={{ background: VERDE }} /> {verdes} a tiempo</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[13px] font-medium text-white"><span className="h-2 w-2 rounded-full" style={{ background: AMBAR }} /> {naranjas} con retraso</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[13px] font-medium text-white"><span className="h-2 w-2 rounded-full" style={{ background: ROJO }} /> {rojos} sin presentar</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[13px] font-medium text-white"><Users className="h-3.5 w-3.5 text-white/70" /> {asistenciaMes} asistentes en el mes</span>
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
          <SelectTrigger className="h-11 w-full rounded-2xl sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODAS">Todas</SelectItem>
            <SelectItem value="VERDE">Al día</SelectItem>
            <SelectItem value="NARANJA">Con retraso</SelectItem>
            <SelectItem value="ROJO">Sin presentar</SelectItem>
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
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader icon={ClipboardCheck} color={VERDE} titulo="Entrega por Casa de Paz" descripcion={`${nombreMes(anio, mes)} · ${cdpsFiltradas.length} de ${total} Casa(s) de Paz activa(s)`} />
        <div className="p-4">
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
                  {semanas.map((s) => {
                    const esSemanaActual = s.inicio <= hoy && hoy <= s.fin;
                    return (
                      <div key={s.inicio} className="text-center">
                        <span className={cn('block text-[11px]', esSemanaActual ? 'font-bold text-foreground' : 'text-muted-foreground')}>{etiquetaSemana(s.inicio)}</span>
                        {esSemanaActual && <span className="block text-[9px] font-medium text-primary">esta sem.</span>}
                      </div>
                    );
                  })}
                </div>

                {/* Filas */}
                <div className="flex flex-col gap-1.5">
                  {cdpsVisibles.map((c) => {
                    const estadoMes = estadoDelMes(c.id);
                    const puntoMes = coloresPorEstado(estadoMes);
                    return (
                      <div key={c.id} className="grid items-center gap-1.5 rounded-xl border border-border/60 bg-card/60 py-1.5 pr-2 pl-3" style={grid}>
                        <div className="min-w-0 flex items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: puntoMes.fg }} title={`Estado del mes: ${estadoMes.toLowerCase()}`} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{c.etiqueta}</p>
                            {c.lider_nombre && <p className="truncate text-[11px] text-muted-foreground">{c.lider_nombre}</p>}
                          </div>
                        </div>
                        {semanas.map((s) => {
                          const celda = porCdpSemana.get(`${c.id}:${s.inicio}`);
                          const est = estadoCelda(c.id, s);
                          const { bg, fg } = coloresPorEstado(est);
                          const tituloCelda =
                            est === 'PENDIENTE'
                              ? `Todavía no venció (semana del ${etiquetaSemana(s.inicio)})`
                              : celda
                                ? `${celda.total} asistentes · reunión ${fechaCorta(celda.fecha)}${est === 'NARANJA' ? ' · presentado con retraso' : ' · a tiempo'}`
                                : `No presentó (semana del ${etiquetaSemana(s.inicio)})`;
                          return (
                            <div
                              key={s.inicio}
                              className="flex h-9 items-center justify-center rounded-lg text-sm font-bold tabular-nums"
                              style={{ backgroundColor: bg, color: fg }}
                              title={tituloCelda}
                            >
                              {celda ? celda.total : est === 'ROJO' ? '✕' : '·'}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                {cdpsFiltradas.length > visibles && (
                  <Button variant="outline" className="mt-3 w-full rounded-xl" onClick={() => setVisibles((v) => v + LOTE)}>
                    Mostrar más ({cdpsFiltradas.length - visibles} restantes)
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
