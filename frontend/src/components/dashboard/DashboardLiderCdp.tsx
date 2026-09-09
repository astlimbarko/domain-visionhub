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
import { IndiceFidelidadRing } from './IndiceFidelidadRing';
import { RangoFechasPopover, type RangoFechas } from './RangoFechasPopover';
import {
  useDashboardLiderCdp,
  useDashboardSubliderCdp,
  useTendenciaAsistencia,
} from '@/hooks/useDashboard';
import { useTasaEvangelismo } from '@/hooks/useEvangelismo';
import { usePersonasDeCdp } from '@/hooks/usePersonas';
import { useTestimoniosCdp } from '@/hooks/useReporte';
import type { FiltroInicialPersonasCdp } from '@/components/personas/PersonasDeCdpVista';
import { ROUTES } from '@/utils/constants';
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
    let discipulosActivos = 0;
    let creyentes = 0;
    let simpatizantes = 0;
    let bautizados = 0;
    let afirmados = 0;
    let sublideres = 0;
    let conMinisterio = 0;
    let miembrosFormales = 0;
    for (const p of personasCdp) {
      if (p.estado_sigla === 'DA' || p.estado_sigla === 'DI') discipulos++;
      if (p.estado_sigla === 'DA') discipulosActivos++;
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
      pctDiscipuladoActivo: pct(discipulosActivos),
    };
  }, [personasCdp]);

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

          {/* ── KPIs de compromiso (2026-09-08, pedido del owner: como
                 gráfico, no más cards) ──────────────────────────────────── */}
          <section className="mt-5 overflow-hidden rounded-2xl border border-border/60 bg-card">
            <TarjetaHeader
              icon={Layers}
              color={AZUL}
              titulo="Compromiso de tu gente"
              descripcion="% del total que llegó a cada hito -- una barra corta es una oportunidad, no un error"
            />
            <div className="p-5">
              <Suspense fallback={<Skeleton className="h-56 w-full rounded-xl" />}>
                <CompromisoPersonasChart
                  pctBautizados={conteosAccesoRapido.pctBautizados}
                  pctConMinisterio={conteosAccesoRapido.pctConMinisterio}
                  pctMembresiaFormal={conteosAccesoRapido.pctMembresiaFormal}
                  pctDiscipuladoActivo={conteosAccesoRapido.pctDiscipuladoActivo}
                />
              </Suspense>
            </div>
          </section>
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

          {/* ── KPIs de seguimiento pastoral (2026-09-08, pedido del owner:
                 como gráfico, no más cards) ─────────────────────────────── */}
          <section className="mt-5 overflow-hidden rounded-2xl border border-border/60 bg-card">
            <TarjetaHeader icon={HeartHandshake} color={MORADO} titulo="A quiénes seguir de cerca" descripcion="Quiénes necesitan una acción pastoral concreta" />
            <div className="p-5">
              <Suspense fallback={<Skeleton className="h-52 w-full rounded-xl" />}>
                <SeguimientoChart
                  inactivos={alertas.inactivos?.length ?? 0}
                  reconciliados={alertas.reconciliados?.length ?? 0}
                  simpatizantes={conteosAccesoRapido.simpatizantes}
                />
              </Suspense>
            </div>
          </section>
        </TabsContent>
      </Tabs>

      {/* ── Índice de fidelidad ───────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader icon={Heart} color={MORADO} titulo="Índice de fidelidad" descripcion="Semáforo espiritual de los miembros" />
        <div className="p-5">
          <IndiceFidelidadRing verdes={verdes} amarillos={amarillos} rojos={rojos} />
        </div>
      </section>

      {/* ── Evangelismo + Estados SSVA ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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

      {/* ── Tendencia de asistencia ───────────────────────────────────────────── */}
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
  );
}
