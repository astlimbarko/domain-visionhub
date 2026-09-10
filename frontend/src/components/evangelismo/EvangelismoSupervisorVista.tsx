import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarRange, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Flag, Heart, HeartHandshake, Home, Pencil, Target, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { KpiMosaico } from '@/components/dashboard/DashboardUI';
import { DEPARTAMENTO_META } from '@/utils/departamentos';
import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';
import { AsignarMetaRedDialog } from '@/components/evangelismo/AsignarMetaRedDialog';
import { CalendarioEvangelismo } from '@/components/evangelismo/CalendarioEvangelismo';
import type { PersonaDelDia } from '@/components/evangelismo/ListaPersonasDia';
import { AcordeonRedesCdp, type RedConActividad } from '@/components/evangelismo/AcordeonRedesCdp';
import { AnilloSegmentado, type SegmentoAnillo } from '@/components/evangelismo/AnilloSegmentado';
import { EvangelismoBanner } from '@/components/evangelismo/EvangelismoBanner';
import { EVANGELISMO_COLOR } from '@/utils/evangelismo-colores';
import { ROUTES } from '@/utils/constants';
import { asignarMetaRedEvangelismo, obtenerEvangelismoRed, obtenerMetaRedAsignada, obtenerTasaEvangelismoRed } from '@/services/evangelismo.service';
import { useAuthStore } from '@/store/auth.store';
import { useSoloLectura } from '@/hooks/useSoloLectura';
import { useRedes, useCdpsIglesia } from '@/hooks/useCasasDePaz';
import { useMetaRedAsignada } from '@/hooks/useEvangelismo';
import { aISO, fechaLegible, fechaLegibleCorta, finSemanaISO, inicioSemanaISO, nombreMes, numeroSemanaISO, primerDiaMesRelativo } from '@/utils/calendario-fechas';
import { TendenciaEvangelismo } from '@/components/evangelismo/TendenciaEvangelismo';
import type { RedResumen } from '@/types/casas-de-paz.types';
import type { EvangelizadoRed, MetaCdpRed } from '@/types/evangelismo.types';

const { AZUL, VERDE, MORADO, AMARILLO, CELESTE, NARANJA, ROSA } = EVANGELISMO_COLOR;
// Paleta cíclica para los anillos por Red -- si hay más de 7 Redes, se repiten.
const PALETA_ANILLO = [AZUL, VERDE, MORADO, AMARILLO, CELESTE, NARANJA, ROSA];

/** Sentinel para distinguir "asignar a todas las Redes" de una Red real en el mismo diálogo. */
const ID_TODAS_LAS_REDES = '__TODAS_REDES__';

/** Una fila del modal "Metas por Red" -- cada Red tiene su propio hook de lectura
 * (`useMetaRedAsignada`), así que vive en su propio componente. */
function RedMetaFila({ red, onEditar }: { red: RedResumen; onEditar: (item: MetaCdpRed) => void }) {
  const { data: metaRed, isLoading } = useMetaRedAsignada(red.id);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `color-mix(in oklab, ${AZUL} 14%, transparent)` }}>
          <Heart className="h-4 w-4" style={{ color: AZUL }} />
        </span>
        <p className="truncate text-sm font-bold text-foreground">{red.nombre}</p>
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        {isLoading ? (
          <Skeleton className="h-4 w-24 rounded" />
        ) : metaRed ? (
          <span className="text-sm">
            <span className="font-bold text-foreground">{metaRed.meta}</span>
            <span className="ml-1.5 text-xs text-muted-foreground">vigente hasta {fechaLegible(metaRed.fecha_fin)}</span>
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Sin meta</span>
        )}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => onEditar({ casa_de_paz_id: red.id, etiqueta: red.nombre, meta: metaRed?.meta ?? null, origen: metaRed ? 'ASIGNADA_RED' : null })}
        >
          <Pencil className="h-3.5 w-3.5" />
          {metaRed ? 'Cambiar' : 'Asignar'}
        </Button>
      </div>
    </div>
  );
}

/**
 * Evangelismo del Supervisor: panel único iglesia-wide, rediseñado a pedido
 * exacto del owner (2026-08-06) -- header con acción "Asignar metas", barras
 * de "Metas de la Red" (una por Red, editables en un modal), 4 KPI
 * agregados de toda la iglesia (Total Meta, Evangelizados, Avance, Casas
 * Activas) y un Calendario + Detalle del día agregando la actividad de
 * TODAS las Redes -- ya no hay que elegir una Red para ver algo, todo el
 * panel es de la iglesia entera.
 *
 * "Metas de la Red" son las que el Supervisor le asigna a cada Red
 * (`meta_evangelismo_asignada.red_id`, no la "Meta Global" -- suma de metas
 * por CdP -- que sigue existiendo tal cual dentro de cada `EvangelismoRed.tsx`
 * cuando el Líder de Red o el propio Supervisor entran al detalle de una
 * Casa de Paz puntual). Tienen prioridad por sobre las metas CdP-específicas
 * (fn_meta_efectiva, 104_fix_prioridad_meta_supervisor.sql).
 */
export function EvangelismoSupervisorVista() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const personaId = useAuthStore((s) => s.personaId);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // KAN-339: Super Admin en modo lectura -- oculta la única entrada de
  // escritura de este panel (el modal "Metas por Red" completo, con el
  // "Cambiar/Asignar" de cada Red y "Asignar a todas" adentro). El backend
  // ya la rechaza igual (fn_asignar_meta_red no suma fn_es_super_admin()),
  // esto es solo para no mostrar un botón que va a fallar.
  const soloLectura = useSoloLectura();

  const { data: redesTodas = [], isLoading: cargandoRedes } = useRedes(iglesiaActivaId);
  const redes = useMemo(() => redesTodas.filter((r) => r.activo), [redesTodas]);
  const { data: cdpsTodas = [], isLoading: cargandoCdps } = useCdpsIglesia(iglesiaActivaId);
  const cdps = useMemo(() => cdpsTodas.filter((c) => c.activo), [cdpsTodas]);
  const cdpPorId = useMemo(() => new Map(cdps.map((c) => [c.id, c])), [cdps]);

  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth());
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);
  const [modalMetasAbierto, setModalMetasAbierto] = useState(false);
  const [redParaMeta, setRedParaMeta] = useState<MetaCdpRed | null>(null);
  const [bulkAsignando, setBulkAsignando] = useState(false);

  const desde = aISO(new Date(anio, mes, 1));
  const hasta = aISO(new Date(anio, mes + 1, 0));

  /** Navega a "Personas evangelizadas" con el mes actual del dashboard ya
   * filtrado -- reusa la misma tabla existente, sin inventar una nueva. */
  function irAPersonasEvangelizadas() {
    navigate(ROUTES.EVANGELISMO_PERSONAS, { state: { desde, hasta } });
  }

  // Tendencia (KAN-285): rango amplio de últimos 12 meses, ampliado para
  // siempre cubrir también el mes que se esté navegando arriba (normalmente
  // ya está adentro, salvo que se navegue muy atrás/adelante) -- así el
  // resumen mensual de abajo puede recortar este mismo dato en vez de
  // pedirle a fn_evangelismo_red los mismos registros una segunda vez por
  // Red. Bug real encontrado 2026-09-08 (reporte del owner: demora extra en
  // el panel de Líder de Evangelismo) -- duplicaba hasta N idas y vueltas a
  // la base según la cantidad de Redes activas; mismo patrón que ya se
  // corrigió hoy en fn_alertas_supervisor (20260908010000), acá el fix es
  // en el frontend, no en la base.
  const hoyISO = aISO(hoy);
  const baseTendencia = primerDiaMesRelativo(hoyISO, 11);
  const desdeTendencia = desde < baseTendencia ? desde : baseTendencia;
  const hastaTendencia = hasta > hoyISO ? hasta : hoyISO;
  const tendenciaPorRed = useQueries({
    queries: redes.map((r) => ({
      queryKey: ['evangelismo', 'tendencia-red', r.id, desdeTendencia, hastaTendencia],
      queryFn: () => obtenerEvangelismoRed(r.id, desdeTendencia, hastaTendencia),
      enabled: !!r.id,
    })),
  });
  const cargandoTendencia = tendenciaPorRed.some((q) => q.isLoading);
  const evangelizadosTendencia = useMemo(() => tendenciaPorRed.flatMap((q) => q.data ?? []), [tendenciaPorRed]);
  // Evangelizados del mes en pantalla, por Red -- recortado del mismo dato de
  // Tendencia de arriba (que ya cubre [desde, hasta]) en vez de una llamada
  // aparte a fn_evangelismo_red.
  const evangelizadosDelMesPorRed = useMemo(() => {
    const mapa = new Map<string, EvangelizadoRed[]>();
    redes.forEach((r, i) => {
      const datos = tendenciaPorRed[i]?.data ?? [];
      mapa.set(r.id, datos.filter((e) => e.fecha >= desde && e.fecha <= hasta));
    });
    return mapa;
  }, [redes, tendenciaPorRed, desde, hasta]);

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

  // Un solo resumen por Red (meta vigente + tasa + evangelizados del mes),
  // para armar tanto las barras como los 4 KPI y el calendario agregado --
  // sin esto haría falta un hook por dato y por Red (3 × N consultas en vez
  // de N).
  const resumenPorRed = useQueries({
    queries: redes.map((r) => ({
      queryKey: ['evangelismo', 'supervisor-resumen-red', r.id, desde, hasta],
      queryFn: async () => {
        const [meta, tasa] = await Promise.all([
          obtenerMetaRedAsignada(r.id),
          obtenerTasaEvangelismoRed(r.id, desde, hasta),
        ]);
        return { redId: r.id, meta, tasa };
      },
      enabled: !!r.id,
    })),
  });
  const cargandoResumen = resumenPorRed.some((q) => q.isLoading) || cargandoTendencia;
  const filas = useMemo(
    () =>
      resumenPorRed
        .map((q) => q.data)
        .filter((d): d is NonNullable<typeof d> => !!d)
        .map((d) => ({ ...d, evangelizados: evangelizadosDelMesPorRed.get(d.redId) ?? [] })),
    [resumenPorRed, evangelizadosDelMesPorRed]
  );

  const totalMeta = filas.reduce((s, f) => s + (f.meta?.meta ?? 0), 0);
  const totalEvangelizados = filas.reduce((s, f) => s + Number(f.tasa?.evangelizados ?? 0), 0);
  const avance = totalMeta > 0 ? Math.round((totalEvangelizados / totalMeta) * 1000) / 10 : null;

  const evangelizadosTodos = useMemo<EvangelizadoRed[]>(() => filas.flatMap((f) => f.evangelizados), [filas]);

  // Anillo "Evangelizados por Red" (pedido explícito del owner, 2026-09-06).
  // Excluye "Semilla" -- es un conteo agregado sin nombres reales (KAN-335),
  // no tiene sentido en un anillo pensado para navegar hacia personas concretas.
  const donutRedes = useMemo<SegmentoAnillo[]>(
    () =>
      redes.map((r) => {
        const fila = filas.find((f) => f.redId === r.id);
        const cantidad = (fila?.evangelizados ?? []).filter((e) => e.tipo_evangelismo_codigo !== 'SEMILLA').length;
        return { id: r.id, etiqueta: r.nombre, cantidad };
      }),
    [redes, filas]
  );


// Agrupado Red -> Casa de Paz -> personas -- navegabilidad de punta a punta
  // (KAN-286): clic en una Red la expande, cada persona es un PersonaNombreLink
  // que abre su ficha. Genérico por rango de fechas (predicado) para reusarlo
  // tanto en "Detalle del día" como en "Resumen semanal" (KAN-285) -- solo se
  // listan Redes/CdP que tuvieron actividad en ese rango (nunca la estructura
  // completa de la iglesia), así el tamaño se mantiene chico sin importar
  // cuántas Redes/CdP tenga la iglesia.
  const agruparPorRedYCdp = useCallback((estaEnRango: (fecha: string) => boolean): RedConActividad[] => {
    const porRed = new Map<string, { redNombre: string; cdps: Map<string, { etiqueta: string; liderId: string | null; liderNombre: string | null; personas: PersonaDelDia[] }> }>();
    for (const fila of filas) {
      for (const e of fila.evangelizados) {
        if (!estaEnRango(e.fecha)) continue;
        const redNombre = redes.find((r) => r.id === fila.redId)?.nombre ?? '—';
        let grupoRed = porRed.get(fila.redId);
        if (!grupoRed) { grupoRed = { redNombre, cdps: new Map() }; porRed.set(fila.redId, grupoRed); }
        let grupoCdp = grupoRed.cdps.get(e.casa_de_paz_id);
        if (!grupoCdp) {
          const cdpInfo = cdpPorId.get(e.casa_de_paz_id);
          grupoCdp = { etiqueta: e.casa_de_paz_etiqueta, liderId: cdpInfo?.lider_id ?? null, liderNombre: cdpInfo?.lider_nombre ?? null, personas: [] };
          grupoRed.cdps.set(e.casa_de_paz_id, grupoCdp);
        }
        grupoCdp.personas.push({ id: e.id, personaId: e.persona_id, nombre: e.nombre_completo, tipoNombre: e.tipo_evangelismo_nombre, tipoColor: e.tipo_evangelismo_color });
      }
    }
    return Array.from(porRed.entries())
      .map(([redId, g]) => {
        const cdps = Array.from(g.cdps.entries())
          .map(([cdpId, c]) => ({ cdpId, ...c, total: c.personas.length }))
          .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta));
        return { redId, redNombre: g.redNombre, total: cdps.reduce((s, c) => s + c.total, 0), cdps };
      })
      .sort((a, b) => a.redNombre.localeCompare(b.redNombre));
  }, [filas, cdpPorId, redes]);

  const detalleDelDia = useMemo(
    () => (diaSeleccionado ? agruparPorRedYCdp((fecha) => fecha === diaSeleccionado) : []),
    [diaSeleccionado, agruparPorRedYCdp],
  );

  const [redesExpandidas, setRedesExpandidas] = useState<Set<string>>(new Set());
  function alternarRedExpandida(redId: string) {
    setRedesExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(redId)) next.delete(redId); else next.add(redId);
      return next;
    });
  }
  function seleccionarDia(fecha: string | null) {
    setDiaSeleccionado(fecha);
    setRedesExpandidas(new Set());
  }

  // Resumen semanal (KAN-285): semanas ISO (lunes a domingo) que tocan el mes
  // en pantalla y tuvieron al menos un registro -- no las semanas vacías.
  const semanasDelMes = useMemo(() => {
    const totales = new Map<string, number>();
    for (const e of evangelizadosTodos) {
      const inicio = inicioSemanaISO(e.fecha);
      totales.set(inicio, (totales.get(inicio) ?? 0) + 1);
    }
    return Array.from(totales.entries())
      .map(([inicio, total]) => ({ inicio, fin: finSemanaISO(inicio), total }))
      .sort((a, b) => a.inicio.localeCompare(b.inicio));
  }, [evangelizadosTodos]);

  const [semanaSeleccionada, setSemanaSeleccionada] = useState<string | null>(null);
  const [redesExpandidasSemana, setRedesExpandidasSemana] = useState<Set<string>>(new Set());
  function alternarRedExpandidaSemana(redId: string) {
    setRedesExpandidasSemana((prev) => {
      const next = new Set(prev);
      if (next.has(redId)) next.delete(redId); else next.add(redId);
      return next;
    });
  }
  function seleccionarSemana(inicio: string | null) {
    setSemanaSeleccionada((actual) => (actual === inicio ? null : inicio));
    setRedesExpandidasSemana(new Set());
  }
  const semanaActiva = semanasDelMes.find((s) => s.inicio === semanaSeleccionada) ?? null;
  const detalleSemana = useMemo(
    () => (semanaActiva ? agruparPorRedYCdp((fecha) => fecha >= semanaActiva.inicio && fecha <= semanaActiva.fin) : []),
    [semanaActiva, agruparPorRedYCdp],
  );

  const asignarMetaRed = useMutation({
    mutationFn: (params: { redId: string; meta: number; fechaInicio: string; fechaFin: string }) =>
      asignarMetaRedEvangelismo({
        iglesiaId: iglesiaActivaId as string,
        redId: params.redId,
        asignadorId: personaId as string,
        meta: params.meta,
        fechaInicio: params.fechaInicio,
        fechaFin: params.fechaFin,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evangelismo', 'red-meta-asignada'] });
      queryClient.invalidateQueries({ queryKey: ['evangelismo', 'red-tasa'] });
      queryClient.invalidateQueries({ queryKey: ['evangelismo', 'red-metas'] });
      queryClient.invalidateQueries({ queryKey: ['evangelismo', 'supervisor-resumen-red'] });
    },
  });

  async function handleAsignar(params: { meta: number; fechaInicio: string; fechaFin: string }) {
    if (!redParaMeta || !iglesiaActivaId || !personaId) return;

    if (redParaMeta.casa_de_paz_id === ID_TODAS_LAS_REDES) {
      setBulkAsignando(true);
      try {
        const resultados = await Promise.allSettled(
          redes.map((r) => asignarMetaRed.mutateAsync({ redId: r.id, meta: params.meta, fechaInicio: params.fechaInicio, fechaFin: params.fechaFin }))
        );
        const fallidas = resultados.filter((r) => r.status === 'rejected').length;
        if (fallidas === resultados.length) {
          toast.error('No se pudo asignar la meta a ninguna Red (todas ya tenían una meta que se solapa en esas fechas)');
          throw new Error('BULK_FALLO_TOTAL');
        }
        if (fallidas > 0) {
          toast.error(`Se asignó a ${resultados.length - fallidas} de ${resultados.length} Redes (${fallidas} ya tenían una meta que se solapa en esas fechas)`);
        } else {
          toast.success(`Meta de ${params.meta} asignada a las ${resultados.length} Redes`);
        }
      } finally {
        setBulkAsignando(false);
      }
      return;
    }

    try {
      await asignarMetaRed.mutateAsync({ redId: redParaMeta.casa_de_paz_id, meta: params.meta, fechaInicio: params.fechaInicio, fechaFin: params.fechaFin });
      toast.success(`Meta asignada a ${redParaMeta.etiqueta}`);
    } catch (e) {
      const error = e as { message?: string } | null;
      const mensaje = typeof error?.message === 'string' ? error.message : '';
      if (mensaje.includes('excl_meta_asignada_red_solapada') || mensaje.includes('exclusion')) {
        toast.error('Ya hay una meta asignada para esa Red en un rango que se solapa');
      } else {
        toast.error('No se pudo asignar la meta');
      }
      throw e;
    }
  }

  if (cargandoRedes) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-32 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (redes.length === 0) {
    return (
      <ProximamentePlaceholder
        titulo="Evangelismo"
        descripcion="Todavía no hay Redes activas en esta iglesia, así que no hay evangelismo que mostrar."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ────────────────────────────────────────────────────────────── */}
      {/* rounded-none a propósito, NO rounded-3xl: pedido explícito del owner
          (2026-09-06) -- su mockup usa esquinas 100% rectas, sin ningún
          radio (confirmado explícitamente, no es una aproximación visual).
          Arranque intencional y acotado de un rediseño gradual -- NO
          replicar este radio en otros heroes/dashboards todavía sin que el
          owner lo confirme explícitamente.
          Márgenes negativos (-mx/-mt) a propósito: en el mockup el banner
          toca el navbar arriba y los bordes del área de contenido a los
          costados, sin el padding que trae `<main className="p-5 sm:p-8">`
          en AppShell.tsx (compartido por TODA la app) -- se cancela ese
          padding solo acá, sin tocar el layout global. Extraído a
          `EvangelismoBanner.tsx` (2026-09-06) para reusarlo también en
          "Personas evangelizadas", pedido explícito del owner. */}
      <EvangelismoBanner
        accion={
          <div className="flex shrink-0 gap-2">
            {/* Atajo cruzado con "Personas evangelizadas" (pedido explícito
                del owner, 2026-09-08) -- misma idea del lado allá con
                "Dashboard", para moverse entre las 2 vistas sin volver al
                menú lateral. */}
            <Button onClick={() => irAPersonasEvangelizadas()} variant="outline" className="h-10 shrink-0 gap-2 rounded-xl border-white/25 bg-white/10 px-4 text-white backdrop-blur-sm hover:bg-white/20">
              <UsersRound className="h-4 w-4" />
              Lista de Evangelizados
            </Button>
            {!soloLectura && (
              <Button onClick={() => setModalMetasAbierto(true)} className="h-10 shrink-0 gap-2 rounded-xl border border-white/25 bg-white/10 px-4 text-white backdrop-blur-sm hover:bg-white/20">
                <Flag className="h-4 w-4" />
                Asignar metas
              </Button>
            )}
          </div>
        }
      />

      {/* ── Navegación de mes ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-2 self-center rounded-2xl border border-border/60 bg-muted/20 p-2 sm:self-start sm:pl-4">
        <span className="w-48 text-center text-xl font-bold tracking-tight capitalize">{nombreMes(anio, mes)}</span>
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={irMesAnterior} aria-label="Mes anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={irMesSiguiente} aria-label="Mes siguiente">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* ── 4 KPI agregados de toda la iglesia ───────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Evangelizados primero (pedido explícito del owner, 2026-09-06:
            "Meta no debe ser la primera, la primera debe ser Evangelizados")
            -- clicable, lleva a "Personas evangelizadas" con el mes que se
            está viendo acá ya filtrado. */}
        {/* [&>div]:h-full -- sin esto, el botón (estirado por el grid a la
            altura de "Meta General", que es más alta por su `sub`) no
            traspasaba esa altura al KpiMosaico de adentro, y la tarjeta
            "Evangelizados" quedaba más baja/desigual que sus vecinas. */}
        <button
          type="button"
          onClick={() => irAPersonasEvangelizadas()}
          className="rounded-2xl text-left transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&>div]:h-full"
        >
          <KpiMosaico label="Evangelizados" icon={HeartHandshake} color={VERDE}>{cargandoResumen ? '—' : totalEvangelizados}</KpiMosaico>
        </button>
        {/* "Total Meta" -> "Meta General" + sub "Todas las Redes" (pedido
            explícito del owner, 2026-09-06): esta suma es solo de las metas
            asignadas a nivel Red (no las de cada CdP individual) -- el
            nombre viejo no dejaba claro que es "para todo", no una meta
            puntual de una CdP. */}
        <KpiMosaico label="Meta General" icon={Flag} color={NARANJA} sub="Todas las Redes">{cargandoResumen ? '—' : totalMeta}</KpiMosaico>
        <KpiMosaico label="Avance" icon={Target} color={AMARILLO}>{cargandoResumen || avance == null ? '—' : `${avance}%`}</KpiMosaico>
        <KpiMosaico label="Casas Activas" icon={Home} color={CELESTE}>{cargandoCdps ? '—' : cdps.length}</KpiMosaico>
      </div>

      {/* ── Evangelizados por Red + Metas de la Red, lado a lado en desktop ──
          (pedido explícito del owner, 2026-09-06: "veo que tiene mucho
          espacio" con cada una en su propia fila completa) ────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <TarjetaHeader
            icon={UsersRound}
            color={DEPARTAMENTO_META.EVANGELISMO.color}
            titulo="Evangelizados por Red"
            descripcion="Tocá el anillo o una Red para ver el detalle por Casa de Paz"
            intensidad={16}
          />
          <div className="p-6">
            {cargandoResumen ? (
              <Skeleton className="h-44 w-full rounded-2xl" />
            ) : (
              <AnilloSegmentado
                datos={donutRedes}
                colores={PALETA_ANILLO}
                onSeleccionar={() => navigate(ROUTES.EVANGELISMO_REDES, { state: { desde, hasta } })}
              />
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <TarjetaHeader icon={Flag} color={DEPARTAMENTO_META.EVANGELISMO.color} titulo="Metas de la Red" descripcion="Avance del mes contra la meta que le asignaste a cada Red -- tocá una tarjeta o Editar para cambiarla" intensidad={16} />
          <div className="flex flex-col gap-5 p-6">
            {cargandoResumen ? (
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${redes.length}, minmax(0, 1fr))` }}>
                {redes.map((r) => <Skeleton key={r.id} className="h-24 w-full rounded-xl" />)}
              </div>
            ) : (
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${redes.length}, minmax(0, 1fr))` }}>
                {redes.map((r) => {
                  const fila = filas.find((f) => f.redId === r.id);
                  const metaValor = fila?.meta?.meta ?? 0;
                  const evangelizadosRed = Number(fila?.tasa?.evangelizados ?? 0);
                  const tieneMeta = metaValor > 0;
                  const progresoPct = tieneMeta ? Math.min(100, Math.round((evangelizadosRed / metaValor) * 100)) : 0;
                  const cumplida = tieneMeta && evangelizadosRed >= metaValor;
                  return (
                    <button
                      type="button"
                      key={r.id}
                      className="flex flex-col items-center gap-1 rounded-xl border border-border/60 px-3 py-4 text-center transition-colors hover:bg-muted/40"
                      title={tieneMeta ? `${r.nombre}: ${evangelizadosRed} de ${metaValor} (${progresoPct}%)` : `${r.nombre}: sin meta asignada`}
                      onClick={() => setRedParaMeta({ casa_de_paz_id: r.id, etiqueta: r.nombre, meta: fila?.meta?.meta ?? null, origen: fila?.meta ? 'ASIGNADA_RED' : null })}
                    >
                      <span className="text-2xl font-bold tabular-nums" style={{ color: tieneMeta ? (cumplida ? VERDE : AZUL) : undefined }}>
                        {tieneMeta ? `${evangelizadosRed}/${metaValor}` : '—'}
                      </span>
                      <span className="w-full truncate text-sm font-medium text-muted-foreground">
                        {r.nombre}{tieneMeta && ` · ${progresoPct}%`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <Button variant="outline" size="sm" className="mx-auto gap-1.5" onClick={() => setModalMetasAbierto(true)}>
              <Pencil className="h-3.5 w-3.5" />
              Editar metas
            </Button>
          </div>
        </section>
      </div>

      {/* ── Tendencia: día/semana/mes, últimos 12 meses (KAN-285) ─────────────── */}
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader icon={Flag} color={DEPARTAMENTO_META.EVANGELISMO.color} titulo="Tendencia" descripcion="Semana es lo típico -- Día sirve para eventos puntuales, no es la vista de rutina" intensidad={16} />
        <div className="p-5">
          <TendenciaEvangelismo evangelizados={evangelizadosTendencia} cargando={cargandoTendencia} />
        </div>
      </section>

      {/* ── Calendario + Detalle del día, agregado de toda la iglesia ────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card lg:col-span-2">
          <TarjetaHeader
            icon={CalendarRange}
            color={DEPARTAMENTO_META.EVANGELISMO.color}
            titulo="Calendario"
            descripcion="Días en los que alguna Casa de Paz registró evangelismo"
            accion={<span className="text-lg font-bold capitalize" style={{ color: DEPARTAMENTO_META.EVANGELISMO.color }}>{nombreMes(anio, mes)}</span>}
            intensidad={16}
          />
          <div className="p-4">
            {cargandoResumen ? (
              <Skeleton className="h-80 w-full rounded-2xl" />
            ) : (
              <CalendarioEvangelismo anio={anio} mes={mes} evangelizados={evangelizadosTodos} diaSeleccionado={diaSeleccionado} onSeleccionarDia={seleccionarDia} />
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <TarjetaHeader
            icon={HeartHandshake}
            color={DEPARTAMENTO_META.EVANGELISMO.color}
            titulo={diaSeleccionado ? fechaLegible(diaSeleccionado) : 'Detalle del día'}
            descripcion={diaSeleccionado ? `${detalleDelDia.length} Red${detalleDelDia.length === 1 ? '' : 'es'} con actividad` : 'Elegí un día del calendario'}
            accion={
              diaSeleccionado && (
                <Button variant="ghost" size="sm" className="shrink-0 gap-1 text-xs" onClick={() => seleccionarDia(null)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Volver
                </Button>
              )
            }
            intensidad={16}
          />
          <div className="flex flex-col gap-2 p-5">
            {!diaSeleccionado && <p className="text-sm text-muted-foreground">Elegí un día en el calendario para ver el detalle.</p>}
            {diaSeleccionado && detalleDelDia.length === 0 && <p className="text-sm text-muted-foreground">Nadie registrado este día.</p>}
            {diaSeleccionado && (
              <AcordeonRedesCdp datos={detalleDelDia} expandidas={redesExpandidas} onAlternar={alternarRedExpandida} />
            )}
          </div>
        </section>
      </div>

      {/* ── Resumen semanal (KAN-285): mismo drill-down, agrupado por semana ── */}
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader
          icon={CalendarRange}
          color={DEPARTAMENTO_META.EVANGELISMO.color}
          titulo="Resumen semanal"
          descripcion="Semanas del mes con actividad -- tocá una para ver el detalle"
          intensidad={16}
        />
        <div className="flex flex-col gap-2 p-5">
          {semanasDelMes.length === 0 && <p className="text-sm text-muted-foreground">Sin evangelismo registrado este mes.</p>}
          {semanasDelMes.map((semana) => {
            const activa = semanaSeleccionada === semana.inicio;
            return (
              <div key={semana.inicio} className="rounded-xl border border-border/60 bg-muted/20">
                <button
                  type="button"
                  onClick={() => seleccionarSemana(semana.inicio)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                >
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold text-foreground">Semana {numeroSemanaISO(semana.inicio)}</span>
                    <span className="text-xs text-muted-foreground">
                      del {fechaLegibleCorta(semana.inicio)} al {fechaLegibleCorta(semana.fin)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">{semana.total}</span>
                    {activa ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                  </span>
                </button>
                {activa && (
                  <div className="flex flex-col gap-2 border-t border-border/60 p-3">
                    <AcordeonRedesCdp datos={detalleSemana} expandidas={redesExpandidasSemana} onAlternar={alternarRedExpandidaSemana} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Modal "Metas por Red": lista completa + asignar a todas ──────────── */}
      <Dialog open={modalMetasAbierto} onOpenChange={setModalMetasAbierto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Metas por Red</DialogTitle>
            <DialogDescription>Tiene prioridad por sobre las metas que cada Líder de Red les asigne a sus Casas de Paz.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              style={{ borderColor: `color-mix(in oklab, ${MORADO} 40%, transparent)`, color: MORADO }}
              onClick={() => setRedParaMeta({ casa_de_paz_id: ID_TODAS_LAS_REDES, etiqueta: `Todas las Redes (${redes.length})`, meta: null, origen: null })}
            >
              <UsersRound className="h-3.5 w-3.5" />
              Asignar a todas
            </Button>
          </div>
          <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
            {redes.map((r) => (
              <RedMetaFila key={r.id} red={r} onEditar={setRedParaMeta} />
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <AsignarMetaRedDialog
        open={!!redParaMeta}
        onOpenChange={(open) => !open && setRedParaMeta(null)}
        cdp={redParaMeta}
        asignando={redParaMeta?.casa_de_paz_id === ID_TODAS_LAS_REDES ? bulkAsignando : asignarMetaRed.isPending}
        nota="Mientras esté vigente, esta meta se hereda hacia cada Casa de Paz de la Red que no tenga ya su propia meta asignada -- y le gana a la meta que ya le haya asignado su Líder de Red."
        onAsignar={handleAsignar}
      />
    </div>
  );
}
