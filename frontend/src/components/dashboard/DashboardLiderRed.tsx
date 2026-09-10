import { useMemo, useRef, useState, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  BookOpen,
  ClipboardCheck,
  Crown,
  Droplets,
  Flame,
  GraduationCap,
  Handshake,
  Home,
  LayoutGrid,
  Network,
  Sparkles,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  UsersRound,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { DescargarPdfButton } from '@/components/shared/DescargarPdfButton';
import { AZUL, VERDE, AMBAR, MORADO, MARINO, TEAL, DEGRADADO_IDENTIDAD, DashboardHero, degradadoIdentidadColor } from './DashboardUI';
import { CardIndicadorPastel } from './CardIndicadorPastel';
import { RangoFechasPopover, type RangoFechas } from './RangoFechasPopover';
import { BloqueFinanciero, agruparFinanzasPorCdp } from '@/components/finanzas/BloqueFinanciero';
import { useAuthStore } from '@/store/auth.store';
import { useDashboardLiderRed, useIngresosRedPeriodo } from '@/hooks/useDashboard';
import { useEvangelismoRed } from '@/hooks/useEvangelismo';
import { usePersonasDeRed } from '@/hooks/usePersonas';
import type { FiltroInicialPersonasRed } from '@/components/personas/PersonasDeRedVista';
import { ROUTES } from '@/utils/constants';
import { PERIODOS_DASHBOARD, rangoPeriodoActual, type PeriodoDashboard } from '@/utils/periodo-dashboard';

/**
 * DATE 'YYYY-MM-DD' → 'DD/MM/YYYY' sin zona horaria. `new Date('2026-07-13')`
 * se interpreta como UTC medianoche y en UTC-4 retrocede un día (mostraba
 * 12/7 por un reporte del 13/7); partir el string evita ese corrimiento.
 */
function fechaLocal(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Sello propio de una Casa de Paz: casa con corazón (SVG a medida, sin depender de una fuente de íconos). */
function SelloCasaDePaz({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4 11 12 4.5 20 11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v8.5h12V10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 17.2c-1.5-1-2.7-2-2.7-3.3a1.45 1.45 0 0 1 2.7-.66 1.45 1.45 0 0 1 2.7.66c0 1.3-1.2 2.3-2.7 3.3Z" fill="currentColor" />
    </svg>
  );
}

interface Props {
  redId: string;
  /** Supervisor de la Red en Acción -- mismo dashboard que el Líder de Red
   * (apoyo, no un rol acotado), solo cambia el rótulo del subtítulo. */
  esSublider?: boolean;
  onSeleccionarCdp?: (cdpId: string) => void;
}

export function DashboardLiderRed({ redId, esSublider = false, onSeleccionarCdp }: Props) {
  const nombreLider = useAuthStore((s) => s.nombreCompleto);
  const { data, isLoading } = useDashboardLiderRed(redId);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const [periodo, setPeriodo] = useState<PeriodoDashboard>('MES');
  const [rango, setRango] = useState<RangoFechas | null>(null);
  // Solo el Líder de Red ve esto (vive únicamente en este componente, nunca
  // se reusa desde DashboardLiderCdp) -- al presionar "Ver finanzas" en una
  // CdP se despliega su [Ofrenda][Diezmo][Total] debajo de las cards.
  const [cdpFinanzas, setCdpFinanzas] = useState<string | null>(null);
  const { desde, hasta } = rango ?? rangoPeriodoActual(periodo);
  const etiquetaPeriodo = rango ? 'el rango elegido' : (PERIODOS_DASHBOARD.find((p) => p.value === periodo)?.etiqueta ?? 'este mes');
  const { data: ingresosPeriodo } = useIngresosRedPeriodo(redId, desde, hasta);

  // Accesos rápidos (2026-09-09, con base en REPORTE 2026 VISION.xlsx, hoja
  // "DATOS FINALES 2026"): 13 conteos de censo/cargos/milagros, calculados
  // en un solo pase sobre el roster de la Red -- mismo patrón que
  // conteosAccesoRapido en DashboardLiderCdp.tsx, reusando fn_personas_de_red
  // ya extendida (migración 20260909010000) en vez de una RPC por conteo.
  const { data: personasRed = [] } = usePersonasDeRed(redId);
  // "Evangelizados de 1+1" es del módulo Evangelismo (no del roster de
  // personas), y sí depende del período elegido -- a diferencia del resto
  // del censo, que es un estado actual, no algo que "pase" en un rango.
  const { data: evangelizadosRedPeriodo = [] } = useEvangelismoRed(redId, desde, hasta);
  const evangelizadosUnoAUno = evangelizadosRedPeriodo.filter((e) => e.tipo_evangelismo_codigo === 'UNO_A_UNO').length;
  const conteosAccesoRapido = useMemo(() => {
    let efesios = 0;
    let ministros = 0;
    let ancianos = 0;
    let diaconos = 0;
    let subMentores = 0;
    let mentores = 0;
    let lideresCdp = 0;
    let sublideres = 0;
    let lideresMinisterio = 0;
    let discipulos = 0;
    let bautizados = 0;
    let milagros = 0;
    for (const p of personasRed) {
      if (p.tiene_efesio) efesios++;
      if (p.cargo_ministro) ministros++;
      if (p.cargo_anciano) ancianos++;
      if (p.cargo_diacono) diaconos++;
      if (p.cargo_sub_mentor) subMentores++;
      if (p.cargo_mentor) mentores++;
      if (p.es_lider_cdp) lideresCdp++;
      if (p.es_sublider_cdp) sublideres++;
      if (p.ministerios.some((m) => m.es_lider)) lideresMinisterio++;
      if (p.rango_miembro === 'DISCIPULO') discipulos++;
      if (p.bautizado) bautizados++;
      if (p.milagros.length > 0) milagros++;
    }
    return { efesios, ministros, ancianos, diaconos, subMentores, mentores, lideresCdp, sublideres, lideresMinisterio, discipulos, bautizados, milagros };
  }, [personasRed]);

  function irAPersonas(filtroInicial?: FiltroInicialPersonasRed) {
    navigate(ROUTES.PERSONAS, filtroInicial ? { state: { filtroInicial } } : undefined);
  }

  // Asistencia/Reportes/Ingresos no tienen una página propia que soporte el
  // alcance de Red (Historial de Reportes/Asistencia y Finanzas solo
  // manejan CdP o Supervisor -- un Líder de Red ahí vería un placeholder
  // roto de "sin CdP asignada"). En vez de mandar a una página rota, estas
  // 3 cards bajan a la sección de esta misma pantalla que ya tiene ese dato
  // por CdP (2026-09-09).
  const casasRef = useRef<HTMLDivElement>(null);
  const contabilidadRef = useRef<HTMLDivElement>(null);
  function irASeccion(ref: RefObject<HTMLDivElement | null>) {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-28 w-full rounded-3xl" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const { red, kpi, casas_de_paz, cdp_sin_reporte_semana } = data;
  const ingresos = ingresosPeriodo ?? data.ingresos ?? [];
  // Color elegido para la Red en el Constructor (KAN-249) -- blanco es el
  // valor "sin elegir" (mismo criterio que layout.ts/PanelRedEstructura),
  // en ese caso se mantiene el degradado navy institucional de siempre.
  const colorRed = red.color && red.color.toUpperCase() !== '#FFFFFF' ? red.color : null;

  const ingresosPorMoneda = new Map<string, number>();
  for (const i of ingresos) ingresosPorMoneda.set(i.moneda_simbolo, (ingresosPorMoneda.get(i.moneda_simbolo) ?? 0) + Number(i.total));
  const ingresosEntradas = Array.from(ingresosPorMoneda.entries());

  const casas = [...(casas_de_paz ?? [])].sort((a, b) => (b.ultima_asistencia ?? -1) - (a.ultima_asistencia ?? -1));
  const sinReporte = cdp_sin_reporte_semana ?? [];

  // Contabilidad global de la Red -- [Ofrenda][Diezmo][Total], pedido exacto
  // del owner (2026-08-02). Se arma tanto el total global como uno por CdP
  // (para el desglose que se despliega al presionar "Ver finanzas" en una
  // CdP, debajo de las cards) a partir del mismo recorrido de `ingresos`
  // (`agruparFinanzasPorCdp`, compartido con FinanzasSupervisorVista).
  const { global: finanzasGlobal, porCdp: finanzasPorCdp } = agruparFinanzasPorCdp(ingresos, casas.map((c) => c.etiqueta));
  const finanzasCdpAbierta = cdpFinanzas ? finanzasPorCdp.get(cdpFinanzas) : undefined;

  // Indicadores derivados de los datos reales de la Red.
  const asistenciaTotal = casas.reduce((s, c) => s + (c.ultima_asistencia ?? 0), 0);
  const reportadas = Math.max(0, kpi.cdp_activas - sinReporte.length);

  return (
    <div ref={contenedorRef} className="flex flex-col gap-6">
      <DashboardHero
        icon={Network}
        eyebrow="Red"
        title={red.nombre}
        subtitle={nombreLider ? `${esSublider ? 'Supervisor de la Red en Acción' : 'Líder'}: ${nombreLider}` : undefined}
        color={colorRed ?? undefined}
      />

      {/* ── Barra de período ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Mostrando datos de {etiquetaPeriodo}.</p>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoDashboard)}>
            <SelectTrigger size="sm" className="w-32 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIODOS_DASHBOARD.map((p) => (<SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>))}
            </SelectContent>
          </Select>
          <RangoFechasPopover value={rango} onChange={setRango} />
          <DescargarPdfButton contenedorRef={contenedorRef} nombreArchivo={`dashboard-red-${red.nombre}`} />
        </div>
      </div>

      {/* ── Pestañas (2026-09-09, pedido del owner: acceso directo tipo Dashboard
             de CdP, sin solapar la vista con demasiadas secciones apiladas) ──── */}
      <Tabs defaultValue="indicadores">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="indicadores" className="gap-1.5">
            <LayoutGrid /> Indicadores
          </TabsTrigger>
          <TabsTrigger value="liderazgo" className="gap-1.5">
            <UsersRound /> Liderazgo
          </TabsTrigger>
          <TabsTrigger value="censo" className="gap-1.5">
            <Crown /> Censo espiritual
          </TabsTrigger>
          <TabsTrigger value="crecimiento" className="gap-1.5">
            <Flame /> Crecimiento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="indicadores">
      {/* ── Indicadores: mismo lenguaje pastel que el resto del dashboard
             (2026-09-09, antes eran KpiMosaico de color pleno -- convivían 2
             estilos distintos en la misma pantalla). ──────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <CardIndicadorPastel
          icon={Home} label="Casas de Paz activas" color={AZUL} valor={kpi.cdp_activas}
          descripcion="Vigentes en la Red" onClick={() => navigate(ROUTES.CASAS_DE_PAZ)}
        />
        <CardIndicadorPastel
          icon={Users} label="Miembros totales" color={MORADO} valor={kpi.miembros_totales}
          descripcion="En toda la Red" onClick={() => irAPersonas()}
        />
        <CardIndicadorPastel
          icon={Activity} label="Asistencia promedio" color={VERDE} valor={kpi.asistencia_promedio ?? '—'}
          descripcion="Por reunión" onClick={() => irASeccion(casasRef)}
        />
        <CardIndicadorPastel
          icon={UserCheck} label="Asistencia total" color={MARINO} valor={asistenciaTotal || '—'}
          descripcion="Última reunión de cada CdP" onClick={() => irASeccion(casasRef)}
        />
        <CardIndicadorPastel
          icon={ClipboardCheck} label="Reportes al día" color={AMBAR} valor={`${reportadas}/${kpi.cdp_activas}`}
          descripcion="Esta semana" onClick={() => irASeccion(casasRef)}
        />
        <CardIndicadorPastel
          icon={Wallet} label="Ingresos" color={TEAL}
          valor={
            ingresosEntradas.length === 0
              ? '—'
              : ingresosEntradas.length === 1
                ? `${ingresosEntradas[0][0]} ${ingresosEntradas[0][1].toFixed(2)}`
                : (
                  <div className="flex flex-col gap-0.5 text-[18px]">
                    {ingresosEntradas.map(([simbolo, total]) => (
                      <span key={simbolo} className="leading-tight">{simbolo} {total.toFixed(2)}</span>
                    ))}
                  </div>
                )
          }
          descripcion={`De ${etiquetaPeriodo}`}
          onClick={casas.length > 0 ? () => irASeccion(contabilidadRef) : undefined}
        />
      </div>

      {/* ── Aviso: sin reporte esta semana ───────────────────────────────────────── */}
      {sinReporte.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <TarjetaHeader
            icon={AlertTriangle}
            color={AMBAR}
            titulo="Sin reporte esta semana"
            descripcion={`${sinReporte.length} Casa${sinReporte.length === 1 ? '' : 's'} de Paz todavía no cargó su reporte.`}
          />
          <div className="flex flex-wrap gap-2 p-5">
            {sinReporte.map((c) => (
              <span key={c.id} className="max-w-full rounded-full px-3 py-1 text-[12px] font-semibold break-words text-white" style={{ backgroundColor: AMBAR }}>
                {c.etiqueta}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ── Casas de Paz: navegación a cada dashboard + finanzas por CdP ───────── */}
      <section ref={casasRef} className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader icon={Home} color={AZUL} titulo="Casas de Paz" descripcion="Entrá para ver el dashboard de cada casa, o mirá sus finanzas acá mismo" />
        <div className="flex flex-col gap-4 p-5">
          {casas.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Esta Red todavía no tiene Casas de Paz.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {casas.map((c) => (
                <div key={c.casa_de_paz_id} className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    disabled={!onSeleccionarCdp}
                    onClick={() => onSeleccionarCdp?.(c.casa_de_paz_id)}
                    className="group flex items-center gap-3 rounded-xl border border-border px-4 py-3.5 text-left transition-all enabled:hover:-translate-y-0.5 enabled:hover:border-primary/40 enabled:hover:shadow-md"
                  >
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
                      style={{
                        background: colorRed ? degradadoIdentidadColor(colorRed) : DEGRADADO_IDENTIDAD,
                        boxShadow: '0 8px 16px -8px rgba(0, 0, 0, 0.35)',
                      }}
                    >
                      <SelloCasaDePaz className="h-6 w-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                      {/* Bug real (2026-08-23): nombre de líder cortado con
                          "..." en celulares angostos -- se envuelve completo. */}
                      <p className="text-sm leading-snug font-semibold break-words text-foreground">{c.etiqueta}</p>
                      <p className="text-[11px] break-words text-muted-foreground">
                        {c.ultima_asistencia != null ? `${c.ultima_asistencia} asistentes` : 'Sin reporte'}
                        {c.ultima_fecha ? ` · ${fechaLocal(c.ultima_fecha)}` : ''}
                      </p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-primary" />
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn('h-7 w-fit gap-1.5 self-start rounded-lg px-2 text-[12px]', cdpFinanzas === c.etiqueta && 'bg-muted text-foreground')}
                    onClick={() => setCdpFinanzas((prev) => (prev === c.etiqueta ? null : c.etiqueta))}
                  >
                    <Wallet className="h-3.5 w-3.5" style={{ color: VERDE }} />
                    Ver finanzas
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Finanzas de la CdP elegida -- debajo de las cards, pedido exacto del owner. */}
          {finanzasCdpAbierta && (
            <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/20 p-4">
              <p className="text-[13px] font-semibold text-foreground">{cdpFinanzas} · {etiquetaPeriodo}</p>
              <BloqueFinanciero resumen={finanzasCdpAbierta} />
            </div>
          )}
        </div>
      </section>

      {/* ── Contabilidad total de la Red: [Ofrenda][Diezmo][Total] global ──────── */}
      {casas.length > 0 && (
        <section ref={contabilidadRef} className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <TarjetaHeader icon={Wallet} color={VERDE} titulo="Contabilidad de la Red" descripcion={`Ofrendas y diezmos de todas las Casas de Paz, ${etiquetaPeriodo}`} />
          <div className="p-5">
            <BloqueFinanciero resumen={finanzasGlobal} />
          </div>
        </section>
      )}
        </TabsContent>

        {/* ── Liderazgo: cargos reales (no autodeclarados) ─────────────────── */}
        <TabsContent value="liderazgo">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <CardIndicadorPastel
          icon={Home} label="Líderes de Casa de Paz" color={AZUL} valor={conteosAccesoRapido.lideresCdp}
          descripcion="Cargo vigente" onClick={() => irAPersonas({ tipo: 'LIDER_CDP' })}
        />
        <CardIndicadorPastel
          icon={UsersRound} label="Sub líderes" color={MARINO} valor={conteosAccesoRapido.sublideres}
          descripcion="Cargo vigente" onClick={() => irAPersonas({ tipo: 'SUBLIDER_CDP' })}
        />
        <CardIndicadorPastel
          icon={BadgeCheck} label="Líderes de ministerios" color={MORADO} valor={conteosAccesoRapido.lideresMinisterio}
          descripcion="Ujieres, comunicación, alabanza, etc." onClick={() => irAPersonas({ tipo: 'LIDER_MINISTERIO' })}
        />
      </div>
        </TabsContent>

        {/* ── Censo espiritual: cargos autodeclarados en el formulario de membresía ── */}
        <TabsContent value="censo">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <CardIndicadorPastel
          icon={Crown} label="EFESIOS" color={MORADO} valor={conteosAccesoRapido.efesios}
          descripcion="Con tipo Efesio declarado" onClick={() => irAPersonas({ tipo: 'EFESIO' })}
        />
        <CardIndicadorPastel
          icon={UserCog} label="Ministros" color={AZUL} valor={conteosAccesoRapido.ministros}
          descripcion="Cargo autodeclarado" onClick={() => irAPersonas({ tipo: 'MINISTRO' })}
        />
        <CardIndicadorPastel
          icon={GraduationCap} label="Ancianos" color={MARINO} valor={conteosAccesoRapido.ancianos}
          descripcion="Cargo autodeclarado" onClick={() => irAPersonas({ tipo: 'ANCIANO' })}
        />
        <CardIndicadorPastel
          icon={Handshake} label="Diáconos" color={TEAL} valor={conteosAccesoRapido.diaconos}
          descripcion="Cargo autodeclarado" onClick={() => irAPersonas({ tipo: 'DIACONO' })}
        />
        <CardIndicadorPastel
          icon={Sparkles} label="Sub mentores" color={AMBAR} valor={conteosAccesoRapido.subMentores}
          descripcion="Cargo autodeclarado" onClick={() => irAPersonas({ tipo: 'SUB_MENTOR' })}
        />
        <CardIndicadorPastel
          icon={Sparkles} label="Mentores" color={VERDE} valor={conteosAccesoRapido.mentores}
          descripcion="Cargo autodeclarado" onClick={() => irAPersonas({ tipo: 'MENTOR' })}
        />
      </div>
        </TabsContent>

        {/* ── Crecimiento: rango de membresía, bautismo, milagros, evangelismo ── */}
        <TabsContent value="crecimiento">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CardIndicadorPastel
          icon={BookOpen} label="Discípulos" color={VERDE} valor={conteosAccesoRapido.discipulos}
          descripcion="Rango de membresía" onClick={() => irAPersonas({ tipo: 'RANGO_MIEMBRO', valor: 'DISCIPULO' })}
        />
        <CardIndicadorPastel
          icon={Droplets} label="Bautizados" color={TEAL} valor={conteosAccesoRapido.bautizados}
          descripcion="Bautizados en agua" onClick={() => irAPersonas({ tipo: 'BAUTIZADO' })}
        />
        <CardIndicadorPastel
          icon={Flame} label="Milagros registrados" color={AMBAR} valor={conteosAccesoRapido.milagros}
          descripcion="Personas con al menos 1 milagro" onClick={() => irAPersonas({ tipo: 'MILAGRO' })}
        />
        <CardIndicadorPastel
          icon={UserPlus} label="Evangelizados de 1+1" color={MORADO} valor={evangelizadosUnoAUno}
          descripcion={`En ${etiquetaPeriodo}`} onClick={() => navigate(ROUTES.EVANGELISMO)}
        />
      </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
