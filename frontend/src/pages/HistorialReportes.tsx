import { CalendarCheck2, Flame, History, Sparkles } from 'lucide-react';
import { useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { DescargarPdfButton } from '@/components/shared/DescargarPdfButton';
import { AZUL, VERDE, AMBAR, KpiMosaico } from '@/components/dashboard/DashboardUI';
import { HistorialReportesCalendario } from '@/components/reporte/HistorialReportesCalendario';
import { HistorialReportesSupervisorVista } from '@/components/reporte/HistorialReportesSupervisorVista';
import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';
import { VolverAlDashboard } from '@/components/shared/VolverAlDashboard';
import { useAuthStore } from '@/store/auth.store';
import { useContextoActivo } from '@/hooks/useContextoActivo';
import {
  useCdpContextoReporte,
  useDiasLimiteEdicionReporte,
  useHistorialReportes,
  useReportesRecientes,
  useReunionesNoRealizadas,
} from '@/hooks/useReporte';
import { dentroDeVentanaEdicionReporte } from '@/services/reporte.service';
import { aISO, diasDeAtraso, fechaLegible, finSemanaISO, inicioSemanaISO, numeroSemanaISO } from '@/utils/calendario-fechas';
import { rutaReporteEditar } from '@/utils/constants';

const VENTANA_SEMANAS = 8;

/** Ultimas `n` semanas ISO (lunes a domingo), de la mas reciente a la mas vieja. */
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

export function HistorialReportes() {
  const { contextoActivo } = useContextoActivo();
  const rolUI = contextoActivo?.rolUI;
  const location = useLocation();
  const navigate = useNavigate();
  // Acceso directo desde el Dashboard de un Líder/Supervisor de Red (o
  // Pastor/Supervisor) inspeccionando una Casa de Paz ajena (2026-09-11,
  // mismo mecanismo que Personas.tsx/TestimoniosCdp.tsx) -- tiene que ganarle
  // a la rama de Supervisor de abajo, que si no siempre mostraría el panel
  // agrupado por Red en vez de la CdP puntual que se estaba inspeccionando.
  const cdpInspeccionada = (location.state as { casaDePazId?: string } | null)?.casaDePazId;
  const cdpActiva = cdpInspeccionada ?? (contextoActivo?.alcance === 'CDP' ? contextoActivo.cdpId : undefined);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const nombreLider = useAuthStore((s) => s.nombreCompleto);
  const { data: cdpContexto } = useCdpContextoReporte(cdpActiva, true);
  const direccionCdp = [cdpContexto?.direccion, cdpContexto?.ciudad].filter(Boolean).join(', ');

  const hoy = new Date();
  const hoyISO = aISO(hoy);
  const semanas = semanasVentana(hoy, VENTANA_SEMANAS);
  const desdeVentana = semanas[semanas.length - 1].inicio;
  const hastaVentana = semanas[0].fin;

  const { data: fechasVentana = [], isLoading: cargandoVentana } = useHistorialReportes(cdpActiva, desdeVentana, hastaVentana);
  const { data: recientes = [] } = useReportesRecientes(cdpActiva ? [cdpActiva] : []);
  // KAN-471 (pedido explícito del owner, 2026-09-26): mismo criterio
  // configurable que ya usa el calendario (HistorialReportesCalendario.tsx)
  // para decidir si un reporte todavía se puede editar.
  const { data: diasLimiteEdicion = 3 } = useDiasLimiteEdicionReporte(iglesiaActivaId, 'DIAS_LIMITE_EDICION_REPORTE_CDP');
  // Bug real encontrado en vivo (2026-09-26): "reunión no realizada" se
  // colaba en las 3 tarjetas de arriba (Semanas con reporte/Racha/
  // Cumplimiento) como si fuera un reporte real -- ya no aparece en
  // fechasVentana (obtenerFechasReportadas la excluye ahora), pero además
  // hay que sacar esas semanas del DENOMINADOR (no deben contar ni a favor
  // ni en contra, decisión ya tomada en KAN-392 -- mismo criterio que
  // HistorialReportesCalendario.tsx ya aplicaba en su propio cálculo).
  const { data: reunionesNoRealizadas = [] } = useReunionesNoRealizadas(cdpActiva, desdeVentana, hastaVentana);
  const semanasConReporte = new Set(fechasVentana.map((f) => inicioSemanaISO(f.fecha_reunion)));
  // Caso límite real encontrado en vivo (2026-09-26): si una semana tiene un
  // reporte real Y ADEMÁS una marca de "no realizada" (datos de prueba
  // desprolijos, no debería pasar en uso normal), esa semana sigue contando
  // como "reportada" -- la marca de "no realizada" solo excluye del
  // denominador a las semanas que NO tienen ningún reporte real.
  const semanasNoRealizada = new Set(
    reunionesNoRealizadas.map((r) => inicioSemanaISO(r.fecha_reunion)).filter((inicio) => !semanasConReporte.has(inicio))
  );
  const semanasJuzgables = semanas.filter((s) => !semanasNoRealizada.has(s.inicio));
  const semanasReportadas = semanasJuzgables.filter((s) => semanasConReporte.has(s.inicio)).length;
  // Cumplimiento (pedido explícito del owner, 2026-09-26): antes contaba
  // cualquier semana con reporte, sin importar cuánto atraso tuvo -- una CdP
  // con reportes de 100+ días de atraso igual mostraba 100%. Ahora una
  // semana solo cuenta como "cumplida" si además se envió a tiempo (0 días
  // de atraso). La racha de abajo sigue siendo solo de existencia (KAN-367),
  // no se toca -- son dos preguntas distintas ("¿mandó algo?" vs "¿a
  // tiempo?").
  const semanasConReporteATiempo = new Set(
    fechasVentana.filter((f) => diasDeAtraso(f.fecha_reunion, f.fecha_creacion) <= 0).map((f) => inicioSemanaISO(f.fecha_reunion))
  );
  // El cumplimiento y la racha solo cuentan semanas que ya terminaron -- la semana
  // en curso todavia puede recibir su reporte, contarla como "falta" seria injusto.
  const semanasCerradas = semanasJuzgables.filter((s) => s.fin < hoyISO);
  const semanasATiempoCount = semanasCerradas.filter((s) => semanasConReporteATiempo.has(s.inicio)).length;
  const cumplimiento = semanasCerradas.length > 0 ? Math.round((semanasATiempoCount / semanasCerradas.length) * 100) : null;
  let racha = 0;
  for (const s of semanasCerradas) {
    if (semanasConReporte.has(s.inicio)) racha++;
    else break;
  }

  // El Supervisor no lidera/sublidera ninguna Casa de Paz propia (misCasas
  // vacío no significa "sin nada que ver" para él como para el resto de los
  // roles) -- ve el Control de Reportes agrupado por Red de toda la iglesia,
  // no el historial de una sola CdP. Salvo que esté inspeccionando una CdP
  // puntual (cdpInspeccionada) -- ahí sí corresponde el historial de esa CdP.
  if (rolUI === 'SUPERVISOR' && !cdpInspeccionada) return <HistorialReportesSupervisorVista />;

  if (!cdpActiva) {
    return (
      <ProximamentePlaceholder
        titulo="Historial de Reportes"
        descripcion="Todavía no tenés una Casa de Paz asignada como líder o sublíder, así que no hay historial que mostrar."
      />
    );
  }

  return (
    <div ref={contenedorRef} className="flex flex-col gap-6">
      <VolverAlDashboard />
      <div className="flex justify-end">
        <DescargarPdfButton contenedorRef={contenedorRef} nombreArchivo="historial-reportes" />
      </div>

      {/* Pedido explícito del owner (2026-09-26): encabezado con líder +
          dirección de la CdP, solo para el PDF descargado -- en la pantalla
          normal no aporta nada (el usuario ya sabe qué CdP está viendo), pero
          un PDF suelto sin ese dato no se identifica solo. `data-pdf-solo`
          lo mantiene oculto acá y `descargarElementoComoPdf` lo revela
          justo antes de capturar la imagen. */}
      {(nombreLider || direccionCdp) && (
        <div data-pdf-solo="true" style={{ display: 'none' }} className="flex flex-col gap-0.5 border-b border-border/60 pb-4">
          <p className="text-lg font-bold tracking-tight">Historial de Reportes -- Casa de Paz</p>
          {nombreLider && (
            <p className="text-sm text-muted-foreground">
              <strong className="font-semibold text-foreground">Líder:</strong> {nombreLider}
            </p>
          )}
          {direccionCdp && (
            <p className="text-sm text-muted-foreground">
              <strong className="font-semibold text-foreground">Dirección:</strong> {direccionCdp}
            </p>
          )}
        </div>
      )}

      {cargandoVentana ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiMosaico
            compact
            label="Semanas con reporte"
            icon={CalendarCheck2}
            color={VERDE}
            sub={
              semanasJuzgables.length < VENTANA_SEMANAS
                ? `De las últimas ${VENTANA_SEMANAS} semanas (sin contar "no realizada")`
                : `De las últimas ${VENTANA_SEMANAS} semanas`
            }
          >
            {semanasReportadas}/{semanasJuzgables.length}
          </KpiMosaico>

          {/* Rachas largas son un logro, por eso el color calido/energico. */}
          <KpiMosaico
            compact
            label="Racha actual"
            icon={Flame}
            color={AMBAR}
            sub={`semana${racha === 1 ? '' : 's'} seguidas`}
          >
            {racha}
          </KpiMosaico>

          <KpiMosaico
            compact
            label="Cumplimiento"
            icon={Sparkles}
            color={AZUL}
            sub={
              semanasCerradas.length > 0
                ? `${semanasATiempoCount} de ${semanasCerradas.length} entregados a tiempo`
                : 'Todavía no hay semanas cerradas'
            }
          >
            {cumplimiento != null ? `${cumplimiento}%` : '—'}
          </KpiMosaico>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <HistorialReportesCalendario casaDePazId={cdpActiva} iglesiaId={iglesiaActivaId} />
        </div>

        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <TarjetaHeader icon={History} color={AZUL} titulo="Reportes recientes" descripcion="Últimos envíos de esta Casa de Paz" />
          <div className="flex flex-col gap-1.5 p-5">
            {recientes.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay reportes.</p>}
            {recientes.map((r) => {
              const atraso = diasDeAtraso(r.fecha_reunion, r.fecha_creacion);
              // KAN-471 (pedido explícito del owner, 2026-09-26): toda la
              // fila pasa a ser clickeable para editar ese reporte -- pero
              // solo si sigue dentro de la ventana de edición (mismo
              // criterio que ya usan los círculos verdes del calendario).
              // Si ya venció, queda igual que antes: informativa, sin click.
              const editable = dentroDeVentanaEdicionReporte(r.fecha_creacion, diasLimiteEdicion);
              return (
                <button
                  key={r.id}
                  type="button"
                  disabled={!editable}
                  onClick={editable ? () => navigate(rutaReporteEditar(r.id)) : undefined}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm transition-colors',
                    editable && 'cursor-pointer',
                    !editable && 'cursor-default',
                    atraso >= 1 ? 'hover:brightness-95' : editable && 'hover:bg-muted/50'
                  )}
                  // Pedido explícito del owner (2026-09-26): fondo "hueso
                  // rojizo" suave en los reportes con atraso, para que se
                  // distingan de un vistazo sin depender solo del badge.
                  style={atraso >= 1 ? { backgroundColor: 'color-mix(in oklab, var(--destructive) 8%, transparent)' } : undefined}
                >
                  {atraso >= 1 ? (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                      <CalendarCheck2 className="h-4 w-4 text-destructive" />
                    </div>
                  ) : (
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: `color-mix(in oklab, ${AZUL} 12%, transparent)` }}
                    >
                      <CalendarCheck2 className="h-4 w-4" style={{ color: AZUL }} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate font-medium">{fechaLegible(r.fecha_reunion)}</p>
                      <span className="shrink-0 text-[11px] font-normal text-muted-foreground">Semana {numeroSemanaISO(r.fecha_reunion)}</span>
                      {atraso >= 1 && (
                        <Badge variant="destructive">
                          {atraso} día{atraso === 1 ? '' : 's'} de atraso
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {r.total_asistentes} asistente{r.total_asistentes === 1 ? '' : 's'} · {r.total_menores} niño
                      {r.total_menores === 1 ? '' : 's'} / {r.total_mayores} adulto{r.total_mayores === 1 ? '' : 's'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
