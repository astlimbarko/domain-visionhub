import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Baby,
  BadgeCheck,
  BookOpen,
  Calendar,
  CalendarCheck2,
  Droplets,
  Heart,
  HeartHandshake,
  Layers,
  LayoutGrid,
  MessageCircleHeart,
  Ticket,
  UserCheck,
  UserPlus,
  Users,
  UsersRound,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { DescargarPdfButton } from '@/components/shared/DescargarPdfButton';
import { AZUL, AMBAR, MORADO, MARINO, DashboardHero } from './DashboardUI';
import { CardIndicadorPastel } from './CardIndicadorPastel';
// Sin recharts -- no hace falta cargarlo bajo demanda como el resto de los gráficos.
import { CumplimientoReportesChart } from './CumplimientoReportesChart';
import { IndiceFidelidadRing } from './IndiceFidelidadRing';
import { RangoFechasPopover, type RangoFechas } from './RangoFechasPopover';
import {
  useDashboardLiderCdp,
  useDashboardSubliderCdp,
  useTendenciaAsistencia,
} from '@/hooks/useDashboard';
import { useTasaEvangelismo } from '@/hooks/useEvangelismo';
import { usePersonasDeCdp } from '@/hooks/usePersonas';
import { useHistorialReportes, useTestimoniosCdp } from '@/hooks/useReporte';
import type { FiltroInicialPersonasCdp } from '@/components/personas/PersonasDeCdpVista';
import { ROUTES } from '@/utils/constants';
import { aISO, finSemanaISO, inicioSemanaISO } from '@/utils/calendario-fechas';
import {
  cantidadPorDefecto,
  etiquetaCantidad,
  etiquetaPeriodoEnFrase,
  granularidadPara,
  OPCIONES_CANTIDAD,
  PERIODOS_DASHBOARD,
  rangoPeriodoConCantidad,
  type PeriodoDashboard,
} from '@/utils/periodo-dashboard';

// Los gráficos usan recharts (~una de las dependencias más pesadas del bundle).
// Se cargan bajo demanda para que roles que no ven este dashboard (pastor,
// supervisor, líder de red sin CDP propia) nunca descarguen ese código.
const EvangelismoComparativoChart = lazy(() =>
  import('./EvangelismoComparativoChart').then((m) => ({ default: m.EvangelismoComparativoChart }))
);
const EstadosMiembrosChart = lazy(() => import('./EstadosMiembrosChart').then((m) => ({ default: m.EstadosMiembrosChart })));
const TendenciaAsistenciaChart = lazy(() =>
  import('./TendenciaAsistenciaChart').then((m) => ({ default: m.TendenciaAsistenciaChart }))
);
const CompromisoPersonasChart = lazy(() =>
  import('./CompromisoPersonasChart').then((m) => ({ default: m.CompromisoPersonasChart }))
);
const SeguimientoChart = lazy(() => import('./SeguimientoChart').then((m) => ({ default: m.SeguimientoChart })));
const ComposicionSexoChart = lazy(() => import('./ComposicionSexoChart').then((m) => ({ default: m.ComposicionSexoChart })));
const ComposicionEdadChart = lazy(() => import('./ComposicionEdadChart').then((m) => ({ default: m.ComposicionEdadChart })));
const MinisteriosChart = lazy(() => import('./MinisteriosChart').then((m) => ({ default: m.MinisteriosChart })));
const AntiguedadInactividadChart = lazy(() =>
  import('./AntiguedadInactividadChart').then((m) => ({ default: m.AntiguedadInactividadChart }))
);
const TestimoniosTendenciaChart = lazy(() =>
  import('./TestimoniosTendenciaChart').then((m) => ({ default: m.TestimoniosTendenciaChart }))
);

/** Últimas `n` semanas ISO (lunes a domingo), de la más reciente a la más vieja -- mismo cálculo que HistorialReportes.tsx, para el medidor de "Cumplimiento de reportes". */
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

const NOMBRES_MES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const VENTANA_SEMANAS_CUMPLIMIENTO = 8;

// Paleta extendida solo para este dashboard (2026-09-08, pedido del owner:
// 13 cards de indicadores, ninguna repetida). La paleta compartida de
// DashboardUI.tsx solo define 6 colores -- no alcanzan para 13 sin repetir.
// Primera versión mezclaba con blanco/gris (color-mix hacia white/--chart-5)
// para estirar la paleta, pero eso destiñe el color (queda pastel/lavado) --
// el owner pidió "más vivos". Se reemplaza por colores del sistema Apple
// (mismo espíritu que el resto de la paleta: AZUL/VERDE/AMBAR/MORADO ya son
// system-blue/green/orange/purple), plenamente saturados, sin mezclar con
// blanco/negro/gris. Local a este archivo, no se toca la paleta compartida
// (afectaría a los otros 3 dashboards).
const GRIS = 'var(--chart-5)';
const ROJO = '#ff3b30';
const AMARILLO = '#ffd60a';
const MENTA = '#00c7be';
const CIAN = '#32ade6';
const INDIGO = '#5856d6';
const ROSA = '#ff2d55';

// Colores exactos pedidos por el owner (2026-09-08, spec de diseño) para las
// 4 cards originales de "Indicadores" -- las otras 9 (pestañas Personas/
// Seguimiento) reusan la paleta de arriba (ROJO/AMARILLO/MENTA/etc.), todas
// con el mismo componente `CardIndicadorPastel` (pedido explícito: el look
// claro se aplica a las 13 cards, no solo a estas 4).
const AZUL_INDICADOR = '#1769E0';
const NARANJA_INDICADOR = '#F47B20';
const MORADO_INDICADOR = '#6D35D9';
const VERDE_INDICADOR = '#18A66A';

interface Props {
  casaDePazId: string;
  esSublider?: boolean;
}

function fmt(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' });
}

/** Dato de variación para `CardIndicadorPastel`, que dibuja la variación en su propia línea separada de la descripción. */
function variacionIndicador(pct: number | null | undefined): { texto: string; tendencia: 'positiva' | 'negativa' | 'neutral' } | null {
  if (pct === null || pct === undefined) return null;
  return {
    texto: `${Math.abs(pct)}% vs. anterior`,
    tendencia: pct > 0 ? 'positiva' : pct < 0 ? 'negativa' : 'neutral',
  };
}

export function DashboardLiderCdp({ casaDePazId, esSublider = false }: Props) {
  const liderQuery = useDashboardLiderCdp(esSublider ? undefined : casaDePazId);
  const subliderQuery = useDashboardSubliderCdp(esSublider ? casaDePazId : undefined);
  const { data, isLoading } = esSublider ? subliderQuery : liderQuery;
  const contenedorRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  function irAPersonas(filtroInicial?: FiltroInicialPersonasCdp) {
    navigate(ROUTES.PERSONAS, filtroInicial ? { state: { filtroInicial } } : undefined);
  }

  const [periodo, setPeriodo] = useState<PeriodoDashboard>('MES');
  const [cantidad, setCantidad] = useState<number>(() => cantidadPorDefecto('MES'));
  const [rango, setRango] = useState<RangoFechas | null>(null);
  // KPIs y gráfico de tendencia comparten el mismo rango -- antes las tarjetas
  // KPI usaban solo el período actual (rangoPeriodoActual) ignorando `cantidad`,
  // así que elegir "Últimos 3 meses" solo movía el gráfico de abajo y los
  // números de arriba seguían mostrando nada más que el mes en curso (pedido
  // del owner, 2026-09-02: que todo el dashboard se mueva junto).
  const { desde, hasta } = rango ?? rangoPeriodoConCantidad(periodo, cantidad);
  const granularidad = granularidadPara(periodo);
  const etiquetaPeriodo = rango ? 'el rango elegido' : etiquetaPeriodoEnFrase(periodo, cantidad);
  const opcionesCantidad = OPCIONES_CANTIDAD[periodo];

  // Las opciones de cantidad dependen del período elegido (ej. Año solo tiene "1"),
  // así que al cambiar de período hay que reencuadrar la cantidad a un valor válido.
  useEffect(() => {
    setCantidad(cantidadPorDefecto(periodo));
  }, [periodo]);

  const { data: tasaEvangelismo } = useTasaEvangelismo(casaDePazId, desde, hasta);
  const { data: tendenciaAsistencia = [] } = useTendenciaAsistencia(casaDePazId, granularidad, cantidad, rango ?? undefined);

  // Fuente de datos de los botones de acceso rápido (2026-09-08): el roster
  // completo de "Personas" ya trae estado/bautizado/rango_miembro/cargo/
  // ministerios en un solo lugar (fn_personas_de_cdp) -- se reusa acá en vez
  // de duplicar esos campos en fn_dashboard_lider_cdp.
  const { data: personasCdp = [] } = usePersonasDeCdp(casaDePazId);
  const { data: testimonios = [] } = useTestimoniosCdp(casaDePazId, desde, hasta);

  // Un solo pase sobre miembros en vez de 4 .filter().length sueltos --
  // antes de tocar el early return de abajo, para no violar Rules of Hooks.
  const contadoresMiembros = useMemo(() => {
    const miembros = data?.miembros ?? [];
    let ninos = 0;
    let verdes = 0;
    let amarillos = 0;
    let rojos = 0;
    for (const m of miembros) {
      if (m.es_menor) ninos++;
      if (m.semaforo === 'VERDE') verdes++;
      else if (m.semaforo === 'AMARILLO') amarillos++;
      else if (m.semaforo === 'ROJO') rojos++;
    }
    return { ninos, verdes, amarillos, rojos };
  }, [data?.miembros]);

  const conteosAccesoRapido = useMemo(() => {
    let discipulos = 0;
    let creyentes = 0;
    let simpatizantes = 0;
    let bautizados = 0;
    let afirmados = 0;
    let sublideres = 0;
    let conMinisterio = 0;
    let miembrosFormales = 0;
    for (const p of personasCdp) {
      if (p.estado_sigla === 'DA' || p.estado_sigla === 'DI') discipulos++;
      if (p.estado_sigla === 'CRE') creyentes++;
      if (p.estado_sigla === 'SIM') simpatizantes++;
      if (p.bautizado) bautizados++;
      if (p.rango_miembro === 'AFIRMADO') afirmados++;
      if (p.es_sublider) sublideres++;
      if (p.ministerios.length > 0) conMinisterio++;
      if (p.es_miembro_formal) miembrosFormales++;
    }
    const total = personasCdp.length;
    const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
    return {
      discipulos,
      creyentes,
      simpatizantes,
      bautizados,
      afirmados,
      sublideres,
      conMinisterio,
      pctBautizados: pct(bautizados),
      pctConMinisterio: pct(conMinisterio),
      pctMembresiaFormal: pct(miembrosFormales),
      pctAfirmados: pct(afirmados),
    };
  }, [personasCdp]);

  // ── Datos de los 4 gráficos nuevos de "Personas" (2026-09-08, pedido del
  //    owner: mínimo 4 gráficos nuevos por pestaña, sin repetir estadísticas
  //    entre sí ni con lo que ya muestra Indicadores) ──────────────────────
  const composicionSexo = useMemo(() => {
    let hombres = 0;
    let mujeres = 0;
    for (const p of personasCdp) {
      if (p.sexo === 'M') hombres++;
      else if (p.sexo === 'F') mujeres++;
    }
    return { hombres, mujeres };
  }, [personasCdp]);

  const composicionEdad = useMemo(() => {
    const buckets = [
      { etiqueta: '0-11', min: 0, max: 11, cantidad: 0 },
      { etiqueta: '12-17', min: 12, max: 17, cantidad: 0 },
      { etiqueta: '18-30', min: 18, max: 30, cantidad: 0 },
      { etiqueta: '31-59', min: 31, max: 59, cantidad: 0 },
      { etiqueta: '60+', min: 60, max: Infinity, cantidad: 0 },
    ];
    for (const p of personasCdp) {
      if (p.edad === null) continue;
      const b = buckets.find((bucket) => p.edad! >= bucket.min && p.edad! <= bucket.max);
      if (b) b.cantidad++;
    }
    return buckets.map(({ etiqueta, cantidad }) => ({ etiqueta, cantidad }));
  }, [personasCdp]);

  const ministeriosTop = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const p of personasCdp) {
      for (const m of p.ministerios) mapa.set(m.nombre, (mapa.get(m.nombre) ?? 0) + 1);
    }
    const ordenados = Array.from(mapa.entries())
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);
    const TOP = 6;
    if (ordenados.length <= TOP) return ordenados;
    const resto = ordenados.slice(TOP).reduce((acc, m) => acc + m.cantidad, 0);
    return [...ordenados.slice(0, TOP), { nombre: 'Otros', cantidad: resto }];
  }, [personasCdp]);

  // ── Datos de los 4 gráficos nuevos de "Seguimiento" ─────────────────────
  const antiguedadInactividad = useMemo(() => {
    const buckets = [
      { etiqueta: 'Sin registro', min: -1, max: -1, cantidad: 0 },
      { etiqueta: '1-4 sem', min: 1, max: 4, cantidad: 0 },
      { etiqueta: '5-8 sem', min: 5, max: 8, cantidad: 0 },
      { etiqueta: '9-12 sem', min: 9, max: 12, cantidad: 0 },
      { etiqueta: '13+ sem', min: 13, max: Infinity, cantidad: 0 },
    ];
    for (const m of data?.miembros ?? []) {
      if (m.semaforo !== 'ROJO') continue;
      const semanas = m.semanas_sin_venir;
      const b = semanas === null ? buckets[0] : buckets.find((bucket) => semanas >= bucket.min && semanas <= bucket.max);
      if (b) b.cantidad++;
    }
    return buckets.map(({ etiqueta, cantidad }) => ({ etiqueta, cantidad }));
  }, [data?.miembros]);

  const hoyTendencias = useMemo(() => new Date(), []);
  const desdeSeisMeses = aISO(new Date(hoyTendencias.getFullYear(), hoyTendencias.getMonth() - 5, 1));
  const hoyISOTendencias = aISO(hoyTendencias);
  const { data: testimoniosSeisMeses = [] } = useTestimoniosCdp(casaDePazId, desdeSeisMeses, hoyISOTendencias);

  const testimoniosPorMes = useMemo(() => {
    const mapa = new Map<string, number>();
    const cursor = new Date(hoyTendencias.getFullYear(), hoyTendencias.getMonth() - 5, 1);
    for (let i = 0; i < 6; i++) {
      mapa.set(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`, 0);
      cursor.setMonth(cursor.getMonth() + 1);
    }
    for (const t of testimoniosSeisMeses) {
      const clave = t.fecha_reunion.slice(0, 7);
      if (mapa.has(clave)) mapa.set(clave, (mapa.get(clave) ?? 0) + 1);
    }
    return Array.from(mapa.entries()).map(([clave, cantidad]) => ({
      mes: NOMBRES_MES_CORTOS[Number(clave.slice(5, 7)) - 1],
      cantidad,
    }));
  }, [testimoniosSeisMeses, hoyTendencias]);

  const pctsSeguimiento = useMemo(() => {
    const inactivos = data?.alertas.inactivos?.length ?? 0;
    const reconciliados = data?.alertas.reconciliados?.length ?? 0;
    const simpatizantes = conteosAccesoRapido.simpatizantes;
    const totalMiembrosLocal = data?.miembros?.length ?? 0;
    const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
    return {
      pctInactivos: pct(inactivos, totalMiembrosLocal),
      pctReconciliados: pct(reconciliados, totalMiembrosLocal),
      pctSimpatizantes: pct(simpatizantes, personasCdp.length),
    };
  }, [data?.alertas, data?.miembros, conteosAccesoRapido.simpatizantes, personasCdp.length]);

  const semanasCumplimiento = useMemo(() => semanasVentana(hoyTendencias, VENTANA_SEMANAS_CUMPLIMIENTO), [hoyTendencias]);
  const desdeVentanaCumplimiento = semanasCumplimiento[semanasCumplimiento.length - 1].inicio;
  const hastaVentanaCumplimiento = semanasCumplimiento[0].fin;
  const { data: fechasReportadasVentana = [] } = useHistorialReportes(casaDePazId, desdeVentanaCumplimiento, hastaVentanaCumplimiento);

  const { cumplimientoReportes, rachaReportes, detalleSemanasReportes } = useMemo(() => {
    const semanasConReporte = new Set(fechasReportadasVentana.map((f) => inicioSemanaISO(f)));
    const semanasCerradas = semanasCumplimiento.filter((s) => s.fin < hoyISOTendencias);
    const cumplimientoCalc =
      semanasCerradas.length > 0
        ? Math.round((semanasCerradas.filter((s) => semanasConReporte.has(s.inicio)).length / semanasCerradas.length) * 100)
        : null;
    let rachaCalc = 0;
    for (const s of semanasCerradas) {
      if (semanasConReporte.has(s.inicio)) rachaCalc++;
      else break;
    }
    // De la más vieja a la más reciente, para la grilla de racha semanal (semanasCumplimiento viene al revés).
    const detalleCalc = [...semanasCumplimiento]
      .reverse()
      .map((s) => ({ cerrada: s.fin < hoyISOTendencias, reportado: semanasConReporte.has(s.inicio) }));
    return { cumplimientoReportes: cumplimientoCalc, rachaReportes: rachaCalc, detalleSemanasReportes: detalleCalc };
  }, [fechasReportadasVentana, semanasCumplimiento, hoyISOTendencias]);

  // Bug real reportado por el owner (2026-09-08): "primero muestra azul y
  // luego cambia al color que corresponde a la red". Causa: los hooks usan
  // `placeholderData: keepPreviousData` (useDashboard.ts) -- al cambiar de
  // Casa de Paz, React Query puede devolver instantáneamente los datos de la
  // CdP ANTERIOR mientras llega la respuesta real (para no tirar toda la
  // vista a un skeleton en ese cambio). `isLoading` ya da `false` en ese
  // momento porque técnicamente "hay datos" -- el chequeo de abajo no lo
  // detectaba, así que se pintaba el banner con el color (o la ausencia de
  // color, navy por defecto) de la CdP vieja hasta que llegaba la respuesta
  // real y cambiaba de golpe. Se agrega el chequeo de que `data` sea
  // realmente de la CdP pedida (`casa_de_paz.id === casaDePazId`) -- si no
  // coincide, se sigue mostrando el esqueleto en vez del color equivocado.
  if (isLoading || !data || data.casa_de_paz.id !== casaDePazId) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-28 w-full rounded-3xl" />
        <Skeleton className="h-14 w-full rounded-[20px]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[164px] w-full rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const { casa_de_paz, kpi, miembros, alertas } = data;

  const totalMiembros = miembros?.length ?? 0;
  const { ninos, verdes, amarillos, rojos } = contadoresMiembros;

  return (
    <div ref={contenedorRef} className="flex flex-col gap-6" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #F5F8FC 100%)' }}>
      {/* ── Banner del dashboard: vuelto al original (pedido explícito del
             owner, 2026-09-08 -- no había que tocarlo) ──────────────────── */}
      <DashboardHero
        icon={Users}
        eyebrow="Casa de Paz"
        title={casa_de_paz.nombre ?? 'Tu Casa de Paz'}
        color={casa_de_paz.red_color && casa_de_paz.red_color.toUpperCase() !== '#FFFFFF' ? casa_de_paz.red_color : undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoDashboard)}>
              <SelectTrigger size="sm" className="w-28 border-white/25 bg-white/10 text-sm text-white [&_svg]:text-white/70"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIODOS_DASHBOARD.map((p) => (<SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={String(cantidad)} onValueChange={(v) => setCantidad(Number(v))} disabled={!!rango}>
              <SelectTrigger size="sm" className="w-40 border-white/25 bg-white/10 text-sm text-white [&_svg]:text-white/70"><SelectValue /></SelectTrigger>
              <SelectContent>
                {opcionesCantidad.map((c) => (<SelectItem key={c} value={String(c)}>{etiquetaCantidad(periodo, c)}</SelectItem>))}
              </SelectContent>
            </Select>
            <RangoFechasPopover value={rango} onChange={setRango} />
            <DescargarPdfButton
              contenedorRef={contenedorRef}
              nombreArchivo={`dashboard-cdp-${casa_de_paz.nombre ?? 'casa-de-paz'}`}
              variant="ghost"
              className="h-9 shrink-0 gap-1.5 rounded-xl border border-white/25 bg-white/10 px-3 text-white backdrop-blur-sm hover:bg-white/20 hover:text-white"
            />
          </div>
        }
      />

      {/* ── Indicadores -- todas las cards son botones de acceso rápido,
             agrupadas en pestañas para más orden (pedido del owner) ───────── */}
      <Tabs defaultValue="indicadores">
        {/* grid grid-cols-3 (no flex-wrap) para que las 3 pestañas entren
            siempre en una sola fila, también en celulares angostos --
            pedido explícito del owner (2026-09-08). */}
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-[20px] border-[#eef1f6] bg-white p-1.5 shadow-[0_4px_16px_rgba(15,23,42,0.04)] sm:gap-2 sm:p-2">
          <TabsTrigger
            value="indicadores"
            className="min-w-0 justify-center gap-1 rounded-2xl px-1.5 py-2 text-[12px] text-[#6b7688] sm:gap-2 sm:px-4 sm:py-2.5 sm:text-[13.5px] data-[state=active]:border-b-2 data-[state=active]:border-[#1769E0] data-[state=active]:bg-[#1769E0]/[0.08] data-[state=active]:text-[#1769E0] data-[state=active]:shadow-none [&_svg]:size-3.5 [&_svg]:opacity-100 sm:[&_svg]:size-4"
          >
            <LayoutGrid /> <span className="truncate">Indicadores</span>
          </TabsTrigger>
          <TabsTrigger
            value="personas"
            className="min-w-0 justify-center gap-1 rounded-2xl px-1.5 py-2 text-[12px] text-[#6b7688] sm:gap-2 sm:px-4 sm:py-2.5 sm:text-[13.5px] data-[state=active]:border-b-2 data-[state=active]:border-[#1769E0] data-[state=active]:bg-[#1769E0]/[0.08] data-[state=active]:text-[#1769E0] data-[state=active]:shadow-none [&_svg]:size-3.5 [&_svg]:opacity-100 sm:[&_svg]:size-4"
          >
            <Users /> <span className="truncate">Personas</span>
          </TabsTrigger>
          <TabsTrigger
            value="seguimiento"
            className="min-w-0 justify-center gap-1 rounded-2xl px-1.5 py-2 text-[12px] text-[#6b7688] sm:gap-2 sm:px-4 sm:py-2.5 sm:text-[13.5px] data-[state=active]:border-b-2 data-[state=active]:border-[#1769E0] data-[state=active]:bg-[#1769E0]/[0.08] data-[state=active]:text-[#1769E0] data-[state=active]:shadow-none [&_svg]:size-3.5 [&_svg]:opacity-100 sm:[&_svg]:size-4"
          >
            <MessageCircleHeart /> <span className="truncate">Seguimiento</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="indicadores">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <CardIndicadorPastel
              label="Miembros"
              icon={Users}
              color={AZUL_INDICADOR}
              valor={kpi.miembros_activos.valor ?? totalMiembros}
              descripcion="Miembros activos"
              variacion={variacionIndicador(kpi.miembros_activos.variacion_pct)}
              onClick={() => irAPersonas()}
            />
            <CardIndicadorPastel
              label="Niños"
              icon={Baby}
              color={NARANJA_INDICADOR}
              valor={ninos}
              descripcion="Menores de 12 años"
              variacion={totalMiembros > 0 ? { texto: `${Math.round((ninos / totalMiembros) * 100)}% de ${totalMiembros} miembros`, tendencia: 'neutral' } : null}
              onClick={() => irAPersonas({ tipo: 'MENOR' })}
            />
            <CardIndicadorPastel
              label="Evangelizados"
              icon={UserPlus}
              color={MORADO_INDICADOR}
              valor={tasaEvangelismo?.evangelizados ?? 0}
              descripcion={`En ${etiquetaPeriodo}`}
              variacion={tasaEvangelismo?.meta != null ? { texto: `Meta: ${tasaEvangelismo.meta}`, tendencia: 'neutral' } : null}
              onClick={() => navigate(ROUTES.EVANGELISMO)}
            />
            <CardIndicadorPastel
              label="Última reunión"
              icon={CalendarCheck2}
              color={VERDE_INDICADOR}
              valor={kpi.asistencia_ultima.valor ?? '—'}
              descripcion={kpi.asistencia_ultima.fecha ? `Asistencia del ${fmt(kpi.asistencia_ultima.fecha)}` : 'Última reunión'}
              variacion={variacionIndicador(kpi.asistencia_ultima.variacion_pct)}
              onClick={() => navigate(ROUTES.HISTORIAL_REPORTES)}
            />
          </div>

          {/* ── Gráficos exclusivos de Indicadores (2026-09-08, pedido del
                 owner: los que ya existían quedan solo acá, Personas y
                 Seguimiento tienen los suyos propios, sin repetir) ───────── */}
          <div className="mt-5 flex flex-col gap-5">
            <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <TarjetaHeader icon={Heart} color={MORADO} titulo="Índice de fidelidad" descripcion="Semáforo espiritual de los miembros" />
              <div className="p-5">
                <IndiceFidelidadRing verdes={verdes} amarillos={amarillos} rojos={rojos} />
              </div>
            </section>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
                <TarjetaHeader icon={UserPlus} color={AMBAR} titulo="Evangelismo" descripcion={`Evangelizados de ${etiquetaPeriodo}`} />
                <div className="p-5">
                  <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
                    <EvangelismoComparativoChart evangelizados={tasaEvangelismo?.evangelizados ?? 0} meta={tasaEvangelismo?.meta ?? null} />
                  </Suspense>
                </div>
              </section>

              <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
                <TarjetaHeader icon={BookOpen} color={AZUL} titulo="Estados SSVA" descripcion="Distribución espiritual de miembros" />
                <div className="p-5">
                  {totalMiembros > 0 ? (
                    <Suspense fallback={<Skeleton className="h-44 w-full rounded-xl" />}>
                      <EstadosMiembrosChart miembros={miembros ?? []} />
                    </Suspense>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sin miembros todavía.</p>
                  )}
                </div>
              </section>
            </div>

            <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <TarjetaHeader
                icon={Calendar}
                color={MARINO}
                titulo="Tendencia de asistencia"
                descripcion={`${etiquetaCantidad(periodo, cantidad)}, agrupado por ${granularidad}`}
              />
              <div className="p-5">
                <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
                  <TendenciaAsistenciaChart datos={tendenciaAsistencia} granularidad={granularidad} />
                </Suspense>
              </div>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="personas">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <CardIndicadorPastel
              label="Discípulos"
              icon={BookOpen}
              color={AZUL}
              valor={conteosAccesoRapido.discipulos}
              descripcion="DA + DI"
              onClick={() => irAPersonas({ tipo: 'ESTADO', siglas: ['DA', 'DI'] })}
            />
            <CardIndicadorPastel
              label="Creyentes"
              icon={UserCheck}
              color={MENTA}
              valor={conteosAccesoRapido.creyentes}
              descripcion="Estado CRE"
              onClick={() => irAPersonas({ tipo: 'ESTADO', siglas: ['CRE'] })}
            />
            <CardIndicadorPastel
              label="Simpatizantes"
              icon={HeartHandshake}
              color={AMARILLO}
              valor={conteosAccesoRapido.simpatizantes}
              descripcion="Estado SIM"
              onClick={() => irAPersonas({ tipo: 'ESTADO', siglas: ['SIM'] })}
            />
            <CardIndicadorPastel
              label="Bautizados"
              icon={Droplets}
              color={CIAN}
              valor={conteosAccesoRapido.bautizados}
              descripcion="Bautizados en agua"
              onClick={() => irAPersonas({ tipo: 'BAUTIZADO' })}
            />
            <CardIndicadorPastel
              label="Afirmados"
              icon={BadgeCheck}
              color={INDIGO}
              valor={conteosAccesoRapido.afirmados}
              descripcion="Autodeclarado"
              onClick={() => irAPersonas({ tipo: 'RANGO_MIEMBRO', valor: 'AFIRMADO' })}
            />
            <CardIndicadorPastel
              label="Sublíderes"
              icon={UsersRound}
              color={MARINO}
              valor={conteosAccesoRapido.sublideres}
              descripcion="Cargo vigente"
              onClick={() => irAPersonas({ tipo: 'SUBLIDER' })}
            />
            <CardIndicadorPastel
              label="Ministerios por personas"
              icon={Layers}
              color={ROJO}
              valor={conteosAccesoRapido.conMinisterio}
              descripcion="Con ministerio"
              onClick={() => irAPersonas()}
            />
          </div>

          {/* ── 4 gráficos nuevos y exclusivos de Personas (2026-09-08,
                 pedido del owner) -- ninguno repite lo que ya muestra
                 Indicadores (Estados SSVA/Índice de fidelidad) ──────────── */}
          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <TarjetaHeader
                icon={Layers}
                color={MORADO}
                titulo="Compromiso de tu gente"
                descripcion="% del total que llegó a cada hito -- una barra corta es una oportunidad, no un error"
              />
              <div className="p-5">
                <Suspense fallback={<Skeleton className="h-56 w-full rounded-xl" />}>
                  <CompromisoPersonasChart
                    pctBautizados={conteosAccesoRapido.pctBautizados}
                    pctConMinisterio={conteosAccesoRapido.pctConMinisterio}
                    pctMembresiaFormal={conteosAccesoRapido.pctMembresiaFormal}
                    pctAfirmados={conteosAccesoRapido.pctAfirmados}
                  />
                </Suspense>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <TarjetaHeader icon={UsersRound} color={AZUL} titulo="Composición por sexo" descripcion="Hombres y mujeres de tu Casa de Paz" />
              <div className="p-5">
                <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
                  <ComposicionSexoChart hombres={composicionSexo.hombres} mujeres={composicionSexo.mujeres} />
                </Suspense>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <TarjetaHeader icon={Baby} color={AMBAR} titulo="Composición por edad" descripcion="Rangos etarios de tu gente" />
              <div className="p-5">
                <Suspense fallback={<Skeleton className="h-56 w-full rounded-xl" />}>
                  <ComposicionEdadChart rangos={composicionEdad} />
                </Suspense>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <TarjetaHeader icon={Layers} color={VERDE_INDICADOR} titulo="Ministerios con más gente" descripcion="Qué ministerios concentran más personas" />
              <div className="p-5">
                <Suspense fallback={<Skeleton className="h-56 w-full rounded-xl" />}>
                  <MinisteriosChart ministerios={ministeriosTop} />
                </Suspense>
              </div>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="seguimiento">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <CardIndicadorPastel
              label="Testimonio"
              icon={MessageCircleHeart}
              color={ROSA}
              valor={testimonios.length}
              descripcion={`En ${etiquetaPeriodo}`}
              onClick={() => navigate(ROUTES.TESTIMONIOS_CDP)}
            />
            <CardIndicadorPastel label="Boletas Entregadas" icon={Ticket} color={GRIS} valor="—" descripcion="Próximamente" />
          </div>

          {/* ── 4 gráficos nuevos y exclusivos de Seguimiento (2026-09-08,
                 pedido del owner) -- ninguno repite Personas ni Indicadores ── */}
          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <TarjetaHeader icon={HeartHandshake} color={MORADO} titulo="A quiénes seguir de cerca" descripcion="Quiénes necesitan una acción pastoral concreta" />
              <div className="p-5">
                <Suspense fallback={<Skeleton className="h-52 w-full rounded-xl" />}>
                  <SeguimientoChart
                    inactivos={alertas.inactivos?.length ?? 0}
                    reconciliados={alertas.reconciliados?.length ?? 0}
                    simpatizantes={conteosAccesoRapido.simpatizantes}
                    pctInactivos={pctsSeguimiento.pctInactivos}
                    pctReconciliados={pctsSeguimiento.pctReconciliados}
                    pctSimpatizantes={pctsSeguimiento.pctSimpatizantes}
                  />
                </Suspense>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <TarjetaHeader icon={UserCheck} color={MORADO} titulo="Antigüedad de la inactividad" descripcion="Hace cuánto que los inactivos no vienen" />
              <div className="p-5">
                <Suspense fallback={<Skeleton className="h-52 w-full rounded-xl" />}>
                  <AntiguedadInactividadChart rangos={antiguedadInactividad} />
                </Suspense>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <TarjetaHeader icon={MessageCircleHeart} color={ROSA} titulo="Testimonios por mes" descripcion="Tendencia de los últimos 6 meses" />
              <div className="p-5">
                <Suspense fallback={<Skeleton className="h-52 w-full rounded-xl" />}>
                  <TestimoniosTendenciaChart datos={testimoniosPorMes} />
                </Suspense>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <TarjetaHeader icon={Calendar} color={MORADO} titulo="Cumplimiento de reportes" descripcion={`Últimas ${VENTANA_SEMANAS_CUMPLIMIENTO} semanas`} />
              <div className="p-5">
                <CumplimientoReportesChart
                  cumplimiento={cumplimientoReportes}
                  racha={rachaReportes}
                  ventanaSemanas={VENTANA_SEMANAS_CUMPLIMIENTO}
                  detalleSemanas={detalleSemanasReportes}
                />
              </div>
            </section>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
