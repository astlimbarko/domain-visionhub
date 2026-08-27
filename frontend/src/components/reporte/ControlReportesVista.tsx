import type { ReactNode } from 'react';
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ClipboardCheck, Pencil, Search, Users } from 'lucide-react';
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
import { DescargarPdfButton } from '@/components/shared/DescargarPdfButton';
import { VERDE, AMBAR } from '@/components/dashboard/DashboardUI';
import { PersonaNombreLink } from '@/components/personas/PersonaNombreLink';
import { useAuthStore } from '@/store/auth.store';
import { useCdps } from '@/hooks/useCasasDePaz';
import { useDiasPlazoReporte, useReportesRedRango } from '@/hooks/useReporte';
import { dentroDeVentanaEdicionReporte } from '@/services/reporte.service';
import { rutaReporteEditar } from '@/utils/constants';
import { aISO, finSemanaISO, inicioSemanaISO, nombreMes } from '@/utils/calendario-fechas';
import type { CdpResumen } from '@/types/casas-de-paz.types';

const LOTE = 12;
const ROJO = 'var(--destructive)';

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

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

/** Semanas (lunes a domingo) que tocan el mes dado -- se usa solo para acotar
 * el rango de fechas a pedirle al backend y como respaldo de las CdP que
 * todavía no fijaron `dia_reunion` en su Perfil. */
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

/**
 * Fechas exactas del mes en las que le toca reportar a una Casa de Paz --
 * pedido del owner, 2026-08-02: no todas las CdP se reúnen el mismo día, así
 * que las columnas de la grilla no pueden ser una sola semana calendario
 * compartida (confundía, mostraba p.ej. "27 jul" aunque esa CdP se reúna los
 * viernes). Se usa el `dia_reunion` que cada CdP ya fija en su Perfil
 * (48_reunion_cdp.sql, 0=domingo…6=sábado). Si todavía no lo fijó, se cae a
 * los lunes de cada semana que toque el mes (mejor esfuerzo, antes era lo
 * único que había).
 */
function fechasReunionDelMes(anio: number, mes: number, diaReunion: number | null): string[] {
  if (diaReunion == null) return semanasDelMes(anio, mes).map((s) => s.inicio);
  const fechas: string[] = [];
  const ultimoDiaMes = new Date(anio, mes + 1, 0).getDate();
  for (let dia = 1; dia <= ultimoDiaMes; dia++) {
    const f = new Date(anio, mes, dia);
    if (f.getDay() === diaReunion) fechas.push(aISO(f));
  }
  return fechas;
}

/** DATE 'YYYY-MM-DD' → 'DD/MM' sin corrimiento de zona horaria. */
function fechaCorta(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

/** Días de calendario entre una fecha de referencia y otro momento (puede dar 0 si es el mismo día). */
function diasDeDemora(fechaReferenciaISO: string, otroMomento: string): number {
  const referencia = new Date(`${fechaReferenciaISO}T00:00:00`);
  const otro = new Date(otroMomento);
  const otroSoloFecha = new Date(otro.getFullYear(), otro.getMonth(), otro.getDate());
  return Math.round((otroSoloFecha.getTime() - referencia.getTime()) / 86400000);
}

type FiltroEstado = 'TODAS' | 'VERDE' | 'NARANJA' | 'ROJO';

interface Props {
  redId: string;
  /** Selector de Red (Líder de Red / Supervisor eligiendo cuál mirar), si corresponde -- se
   * muestra en la misma barra que la navegación de mes en vez de en una fila aparte. */
  accionExtra?: ReactNode;
}

/**
 * Control de Reportes del Líder de Red (solo lectura). Vista mensual: dentro
 * de cada mes se entrega un reporte por semana, en el día que cada Casa de
 * Paz haya fijado como su día de reunión (Perfil de CdP) -- las columnas ya
 * no son una semana calendario compartida por todas, sino la fecha exacta
 * que le toca reportar a esa CdP puntual. Cada casilla tiene uno de 3
 * estados -- verde (a tiempo), naranja (con retraso) o rojo (no presentó,
 * solo si ya pasó el plazo de gracia desde esa fecha).
 */
export function ControlReportesVista({ redId, accionExtra }: Props) {
  const navigate = useNavigate();
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const { data: cdpsTodas = [], isLoading: cargandoCdps } = useCdps(iglesiaActivaId, redId);
  const cdps = useMemo(() => cdpsTodas.filter((c) => c.activo), [cdpsTodas]);
  // KAN-31: plazo configurable por iglesia -- solo se usa acá para decidir
  // ROJO/PENDIENTE (semanas sin reporte todavía). El VERDE/NARANJA de un
  // reporte ya cargado viene calculado desde el servidor (estado_carga).
  const { data: diasPlazoReporte = 2 } = useDiasPlazoReporte(iglesiaActivaId);

  const contenedorRef = useRef<HTMLDivElement>(null);

  const hoyDate = new Date();
  const [anio, setAnio] = useState(hoyDate.getFullYear());
  const [mes, setMes] = useState(hoyDate.getMonth());
  const ahoraISO = hoyDate.toISOString();

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

  // Rango a pedirle al backend: las semanas calendario que tocan el mes son
  // un superconjunto seguro de cualquier fecha de reunión real, sea cual sea
  // el día que cada CdP haya fijado.
  const semanas = useMemo(() => semanasDelMes(anio, mes), [anio, mes]);
  const desde = semanas[0]?.inicio ?? aISO(new Date(anio, mes, 1));
  const hasta = semanas[semanas.length - 1]?.fin ?? aISO(new Date(anio, mes + 1, 0));

  const cdpIds = useMemo(() => cdps.map((c) => c.id), [cdps]);
  const { data: reportes = [], isLoading: cargandoReportes } = useReportesRedRango(cdpIds, desde, hasta);

  // clave "cdpId:semanaInicio" -> reporte de esa semana. Un reporte por CdP y semana.
  const porCdpSemana = useMemo(() => {
    const mapa = new Map<string, { reporteId: string; total: number; fecha: string; estadoCarga: 'VERDE' | 'NARANJA' }>();
    for (const r of reportes) {
      mapa.set(`${r.casa_de_paz_id}:${inicioSemanaISO(r.fecha_reunion)}`, {
        reporteId: r.reporte_id,
        total: r.total_asistentes,
        fecha: r.fecha_reunion,
        estadoCarga: r.estado_carga,
      });
    }
    return mapa;
  }, [reportes]);

  function estadoCeldaFecha(cdpId: string, fechaEsperadaISO: string): EstadoCelda {
    const celda = porCdpSemana.get(`${cdpId}:${inicioSemanaISO(fechaEsperadaISO)}`);
    if (celda) {
      // Calculado server-side (v_reporte_totales.estado_carga), no se
      // recalcula en el cliente -- ver 108_control_reportes_plazo_configurable.sql.
      return celda.estadoCarga;
    }
    return diasDeDemora(fechaEsperadaISO, ahoraISO) > diasPlazoReporte ? 'ROJO' : 'PENDIENTE';
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

  // Estado del mes para cada CdP: el peor de sus fechas de reunión ya
  // vencidas (rojo > naranja > verde), calculadas según su propio día fijo.
  function estadoDelMes(cdp: CdpResumen): EstadoCelda {
    let peor: EstadoCelda = 'VERDE';
    for (const f of fechasReunionDelMes(anio, mes, cdp.dia_reunion)) {
      const e = estadoCeldaFecha(cdp.id, f);
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
      if (estado !== 'TODAS' && estadoDelMes(c) !== estado) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cdps, texto, lider, estado, porCdpSemana, anio, mes]);
  const cdpsVisibles = cdpsFiltradas.slice(0, visibles);

  // Cantidad de columnas de la grilla: la CdP con más fechas de reunión ese
  // mes (4 o 5, según cómo caiga su día fijo) manda -- se calcula sobre
  // todas las CdP activas, no solo las filtradas, para que la grilla no
  // cambie de ancho al tipear en el buscador.
  const maxColumnas = useMemo(
    () => Math.max(1, ...cdps.map((c) => fechasReunionDelMes(anio, mes, c.dia_reunion).length)),
    [cdps, anio, mes]
  );

  // Resumen del mes: cuenta cada fecha de reunión ya vencida de cada CdP
  // (ignora las PENDIENTE, que todavía no tienen resultado).
  const total = cdps.length;
  let verdes = 0, naranjas = 0, rojos = 0, asistenciaMes = 0;
  for (const c of cdps) {
    for (const f of fechasReunionDelMes(anio, mes, c.dia_reunion)) {
      const e = estadoCeldaFecha(c.id, f);
      if (e === 'VERDE') verdes++;
      else if (e === 'NARANJA') naranjas++;
      else if (e === 'ROJO') rojos++;
      const celda = porCdpSemana.get(`${c.id}:${inicioSemanaISO(f)}`);
      if (celda) asistenciaMes += celda.total;
    }
  }
  const vencidas = verdes + naranjas + rojos;
  const pctCumplimiento = vencidas > 0 ? Math.round(((verdes + naranjas) / vencidas) * 100) : 0;
  const todoOk = vencidas > 0 && rojos === 0 && naranjas === 0;
  const colorHero = rojos > 0 ? ROJO : naranjas > 0 ? AMBAR : VERDE;

  const cargando = cargandoCdps || cargandoReportes;
  const grid = { gridTemplateColumns: `minmax(150px, 1.4fr) repeat(${maxColumnas}, minmax(52px, 1fr))` };

  // KAN-271: hay al menos un reporte del mes que todavía está dentro de la
  // ventana de 7 días -- se usa para mostrar la ayuda de "se puede editar"
  // solo cuando de verdad hay algo editable a la vista.
  const hayReporteEditable = useMemo(
    () => reportes.some((r) => dentroDeVentanaEdicionReporte(r.fecha_reunion)),
    [reportes]
  );

  const tituloEstado =
    total === 0 ? 'Sin Casas de Paz activas' : vencidas === 0 ? 'Todavía no vence ningún reporte este mes' : todoOk ? 'Todo el mes al día' : `${rojos + naranjas} reporte${rojos + naranjas === 1 ? '' : 's'} con problema este mes`;

  return (
    <div ref={contenedorRef} className="flex flex-col gap-4">
      {/* ── Navegación de mes + selector de Red, en una sola barra ─────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/60 bg-muted/20 p-2 pl-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-tight capitalize">{nombreMes(anio, mes)}</span>
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={irMesAnterior} aria-label="Mes anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={irMesSiguiente} aria-label="Mes siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {accionExtra}
          <DescargarPdfButton contenedorRef={contenedorRef} nombreArchivo="control-reportes" />
        </div>
      </div>

      {/* ── Todo lo demás vive en una sola card: KPIs, filtros y la matriz ──────── */}
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader icon={ClipboardCheck} color={colorHero} titulo={tituloEstado} descripcion={`Entrega por Casa de Paz · ${cdpsFiltradas.length} de ${total} activa(s)`} />
        <div className="flex flex-col gap-4 p-4">
          {/* Resumen compacto del mes: mismo banner navy + donut + chips de antes, angosto */}
          <div className="relative overflow-hidden rounded-2xl px-4 py-3" style={{ background: 'linear-gradient(135deg, var(--brand-navy) 0%, var(--brand-navy-soft) 100%)' }}>
            <div className="pointer-events-none absolute -top-10 -right-8 h-32 w-32 rounded-full opacity-30 blur-2xl" style={{ background: colorHero }} />
            <div className="relative flex flex-wrap items-center gap-3">
              <DonutRing porcentaje={pctCumplimiento} size={56} strokeWidth={6} color={colorHero} trackColor="rgba(255,255,255,0.16)">
                <span className="text-[12px] font-bold text-white">{pctCumplimiento}%</span>
              </DonutRing>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-medium text-white"><span className="h-1.5 w-1.5 rounded-full" style={{ background: VERDE }} /> {verdes} a tiempo</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-medium text-white"><span className="h-1.5 w-1.5 rounded-full" style={{ background: AMBAR }} /> {naranjas} con retraso</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-medium text-white"><span className="h-1.5 w-1.5 rounded-full" style={{ background: ROJO }} /> {rojos} sin presentar</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-medium text-white"><Users className="h-3 w-3 text-white/70" /> {asistenciaMes} asistentes</span>
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
              <Input className="h-10 rounded-xl border-border bg-muted/50 pl-10 text-[14px]" placeholder="Buscar Casa de Paz o líder..." value={texto} onChange={(e) => { setTexto(e.target.value); setVisibles(LOTE); }} />
            </div>
            <Select value={estado} onValueChange={(v) => { setEstado(v as FiltroEstado); setVisibles(LOTE); }}>
              <SelectTrigger className="h-10 w-full rounded-xl sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todas</SelectItem>
                <SelectItem value="VERDE">Al día</SelectItem>
                <SelectItem value="NARANJA">Con retraso</SelectItem>
                <SelectItem value="ROJO">Sin presentar</SelectItem>
              </SelectContent>
            </Select>
            {lideres.length > 0 && (
              <Select value={lider} onValueChange={(v) => { setLider(v); setVisibles(LOTE); }}>
                <SelectTrigger className="h-10 w-full rounded-xl sm:w-48"><SelectValue placeholder="Líder" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos los líderes</SelectItem>
                  {lideres.map((l) => (<SelectItem key={l} value={l}>{l}</SelectItem>))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* KAN-271: aviso de que las casillas con reporte se pueden editar
              (Líder/Supervisor de Red), para que la acción se note -- solo
              aparece si hay al menos un reporte dentro de la ventana de 7 días. */}
          {!cargando && hayReporteEditable && (
            <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-[12px] text-muted-foreground">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Pencil className="h-3 w-3" />
              </span>
              Tocá una casilla marcada con el lápiz para editar ese reporte (hasta 7 días después de la reunión).
            </div>
          )}

          {cargando ? (
            <div className="flex flex-col gap-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-xl" />)}</div>
          ) : total === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Esta Red no tiene Casas de Paz activas.</p>
          ) : cdpsFiltradas.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Ninguna Casa de Paz coincide con los filtros.</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[560px]">
                {/* Encabezado: ordinal de semana, no una fecha compartida -- cada CdP
                    reporta en su propio día (ver fecha chiquita arriba del número en
                    cada casilla), así que una sola fecha por columna sería incorrecta
                    para la mayoría de las filas. */}
                <div className="grid items-end gap-1.5 pb-2" style={grid}>
                  <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Casa de Paz</span>
                  {Array.from({ length: maxColumnas }, (_, i) => (
                    <span key={i} className="text-center text-[11px] text-muted-foreground">Semana {i + 1}</span>
                  ))}
                </div>

                {/* Filas */}
                <div className="flex flex-col gap-1.5">
                  {cdpsVisibles.map((c) => {
                    const fechas = fechasReunionDelMes(anio, mes, c.dia_reunion);
                    const estadoMes = estadoDelMes(c);
                    const puntoMes = coloresPorEstado(estadoMes);
                    return (
                      <div key={c.id} className="grid items-center gap-1.5 rounded-xl border border-border/60 bg-card/60 py-1.5 pr-2 pl-3" style={grid}>
                        <div className="min-w-0 flex items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: puntoMes.fg }} title={`Estado del mes: ${estadoMes.toLowerCase()}`} />
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                              <span className="truncate">{c.etiqueta}</span>
                              {c.dia_reunion != null ? (
                                <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase">
                                  {DIAS_CORTOS[c.dia_reunion]}
                                </span>
                              ) : (
                                <span
                                  className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                                  style={{ backgroundColor: `color-mix(in oklab, ${AMBAR} 16%, transparent)`, color: AMBAR }}
                                  title="Fijá el día de reunión en el Perfil de esta Casa de Paz para ver sus fechas reales"
                                >
                                  Sin día fijo
                                </span>
                              )}
                            </p>
                            {c.lider_nombre && c.lider_id && (
                              <p className="truncate text-[11px] text-muted-foreground">
                                <PersonaNombreLink personaId={c.lider_id}>{c.lider_nombre}</PersonaNombreLink>
                              </p>
                            )}
                          </div>
                        </div>
                        {Array.from({ length: maxColumnas }, (_, i) => {
                          const fechaEsperada = fechas[i];
                          if (!fechaEsperada) {
                            return <div key={i} className="flex h-11 items-center justify-center text-xs text-muted-foreground/30">—</div>;
                          }
                          const celda = porCdpSemana.get(`${c.id}:${inicioSemanaISO(fechaEsperada)}`);
                          const est = estadoCeldaFecha(c.id, fechaEsperada);
                          const { bg, fg } = coloresPorEstado(est);
                          // KAN-271: se puede editar directo desde acá -- solo
                          // dentro de la ventana de 7 días (el permiso real lo
                          // valida el backend igual, esto solo decide si la
                          // celda se muestra como clickeable).
                          const editable = !!celda && dentroDeVentanaEdicionReporte(celda.fecha);
                          const tituloCelda =
                            est === 'PENDIENTE'
                              ? `Todavía no vence (reunión del ${fechaCorta(fechaEsperada)})`
                              : celda
                                ? `${celda.total} asistentes · reunión ${fechaCorta(celda.fecha)}${est === 'NARANJA' ? ' · presentado con retraso' : ' · a tiempo'}${editable ? ' · click para editar' : ''}`
                                : `No presentó (reunión del ${fechaCorta(fechaEsperada)})`;
                          return (
                            <button
                              key={i}
                              type="button"
                              disabled={!editable}
                              onClick={editable ? () => navigate(rutaReporteEditar(celda.reporteId)) : undefined}
                              className={`relative flex h-11 flex-col items-center justify-center gap-0.5 rounded-lg border-none text-sm font-bold tabular-nums ${editable ? 'cursor-pointer ring-1 ring-inset ring-current/25 transition hover:ring-current/60 hover:brightness-95' : 'cursor-default'}`}
                              style={{ backgroundColor: bg, color: fg }}
                              title={tituloCelda}
                            >
                              {editable && (
                                <span
                                  className="absolute top-0.5 right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-[4px]"
                                  style={{ backgroundColor: 'color-mix(in oklab, currentColor 18%, transparent)' }}
                                  aria-label="Editable"
                                >
                                  <Pencil className="h-2.5 w-2.5" />
                                </span>
                              )}
                              <span className="text-[9px] leading-none font-medium opacity-75">{fechaCorta(fechaEsperada)}</span>
                              <span className="leading-none">{celda ? celda.total : est === 'ROJO' ? '✕' : '·'}</span>
                            </button>
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
