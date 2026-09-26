import { CalendarCheck2, Flame, History, Sparkles } from 'lucide-react';
import { useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { DescargarPdfButton } from '@/components/shared/DescargarPdfButton';
import { AZUL, VERDE, AMBAR, KpiMosaico } from '@/components/dashboard/DashboardUI';
import { HistorialReportesCalendario } from '@/components/reporte/HistorialReportesCalendario';
import { HistorialReportesSupervisorVista } from '@/components/reporte/HistorialReportesSupervisorVista';
import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';
import { VolverAlDashboard } from '@/components/shared/VolverAlDashboard';
import { useAuthStore } from '@/store/auth.store';
import { useContextoActivo } from '@/hooks/useContextoActivo';
import { useHistorialReportes, useReportesRecientes } from '@/hooks/useReporte';
import { aISO, diasDeAtraso, fechaLegible, finSemanaISO, inicioSemanaISO } from '@/utils/calendario-fechas';

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
  // Acceso directo desde el Dashboard de un Líder/Supervisor de Red (o
  // Pastor/Supervisor) inspeccionando una Casa de Paz ajena (2026-09-11,
  // mismo mecanismo que Personas.tsx/TestimoniosCdp.tsx) -- tiene que ganarle
  // a la rama de Supervisor de abajo, que si no siempre mostraría el panel
  // agrupado por Red en vez de la CdP puntual que se estaba inspeccionando.
  const cdpInspeccionada = (location.state as { casaDePazId?: string } | null)?.casaDePazId;
  const cdpActiva = cdpInspeccionada ?? (contextoActivo?.alcance === 'CDP' ? contextoActivo.cdpId : undefined);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;

  const hoy = new Date();
  const hoyISO = aISO(hoy);
  const semanas = semanasVentana(hoy, VENTANA_SEMANAS);
  const desdeVentana = semanas[semanas.length - 1].inicio;
  const hastaVentana = semanas[0].fin;

  const { data: fechasVentana = [], isLoading: cargandoVentana } = useHistorialReportes(cdpActiva, desdeVentana, hastaVentana);
  const { data: recientes = [] } = useReportesRecientes(cdpActiva ? [cdpActiva] : []);

  const semanasConReporte = new Set(fechasVentana.map((f) => inicioSemanaISO(f.fecha_reunion)));
  const semanasReportadas = semanas.filter((s) => semanasConReporte.has(s.inicio)).length;
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
  const semanasCerradas = semanas.filter((s) => s.fin < hoyISO);
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
            sub={`De las últimas ${VENTANA_SEMANAS} semanas`}
          >
            {semanasReportadas}/{VENTANA_SEMANAS}
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
            {/* KAN-367: la edición se hace desde el calendario (círculo verde),
                no desde acá -- esta lista queda como resumen informativo. */}
            {recientes.map((r) => {
              const atraso = diasDeAtraso(r.fecha_reunion, r.fecha_creacion);
              return (
                <div key={r.id} className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm hover:bg-muted/50">
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
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
