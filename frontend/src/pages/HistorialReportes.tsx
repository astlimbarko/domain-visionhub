import { CalendarCheck2, Flame, History, Sparkles } from 'lucide-react';
import { useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { DescargarPdfButton } from '@/components/shared/DescargarPdfButton';
import { AZUL, VERDE, AMBAR, KpiMosaico } from '@/components/dashboard/DashboardUI';
import { HistorialReportesCalendario } from '@/components/reporte/HistorialReportesCalendario';
import { HistorialReportesSupervisorVista } from '@/components/reporte/HistorialReportesSupervisorVista';
import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';
import { useAuthStore } from '@/store/auth.store';
import { useRolUI } from '@/hooks/useRolUI';
import { useMisCasasDePaz } from '@/hooks/useCalendario';
import { useHistorialReportes, useReportesRecientes } from '@/hooks/useReporte';
import { aISO, fechaLegible, finSemanaISO, inicioSemanaISO } from '@/utils/calendario-fechas';

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
  const rolUI = useRolUI();
  const personaId = useAuthStore((s) => s.personaId);
  const { data: misCasas, isLoading: cargandoCasas } = useMisCasasDePaz(personaId);
  const [casaDePazId, setCasaDePazId] = useState<string>();
  const cdpActiva = casaDePazId ?? misCasas?.[0]?.casa_de_paz_id;
  const contenedorRef = useRef<HTMLDivElement>(null);

  const hoy = new Date();
  const hoyISO = aISO(hoy);
  const semanas = semanasVentana(hoy, VENTANA_SEMANAS);
  const desdeVentana = semanas[semanas.length - 1].inicio;
  const hastaVentana = semanas[0].fin;

  const { data: fechasVentana = [], isLoading: cargandoVentana } = useHistorialReportes(cdpActiva, desdeVentana, hastaVentana);
  const { data: recientes = [] } = useReportesRecientes(cdpActiva ? [cdpActiva] : []);

  const semanasConReporte = new Set(fechasVentana.map((f) => inicioSemanaISO(f)));
  const semanasReportadas = semanas.filter((s) => semanasConReporte.has(s.inicio)).length;
  // El cumplimiento y la racha solo cuentan semanas que ya terminaron -- la semana
  // en curso todavia puede recibir su reporte, contarla como "falta" seria injusto.
  const semanasCerradas = semanas.filter((s) => s.fin < hoyISO);
  const cumplimiento =
    semanasCerradas.length > 0
      ? Math.round((semanasCerradas.filter((s) => semanasConReporte.has(s.inicio)).length / semanasCerradas.length) * 100)
      : null;
  let racha = 0;
  for (const s of semanasCerradas) {
    if (semanasConReporte.has(s.inicio)) racha++;
    else break;
  }

  // El Supervisor no lidera/sublidera ninguna Casa de Paz propia (misCasas
  // vacío no significa "sin nada que ver" para él como para el resto de los
  // roles) -- ve el Control de Reportes agrupado por Red de toda la iglesia,
  // no el historial de una sola CdP.
  if (rolUI === 'SUPERVISOR') return <HistorialReportesSupervisorVista />;

  if (cargandoCasas) return <Skeleton className="h-96 w-full rounded-2xl" />;

  if (!misCasas || misCasas.length === 0) {
    return (
      <ProximamentePlaceholder
        titulo="Historial de Reportes"
        descripcion="Todavía no tenés una Casa de Paz asignada como líder o sublíder, así que no hay historial que mostrar."
      />
    );
  }

  return (
    <div ref={contenedorRef} className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {misCasas.length > 1 && (
          <Select value={cdpActiva} onValueChange={setCasaDePazId}>
            <SelectTrigger className="w-full sm:w-56 rounded-xl border-border/60 bg-background text-sm">
              <SelectValue placeholder="Casa de Paz" />
            </SelectTrigger>
            <SelectContent>
              {misCasas.map((c) => (
                <SelectItem key={c.casa_de_paz_id} value={c.casa_de_paz_id}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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
            sub="Semanas cerradas con reporte a tiempo"
          >
            {cumplimiento != null ? `${cumplimiento}%` : '—'}
          </KpiMosaico>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <HistorialReportesCalendario casaDePazId={cdpActiva} />
        </div>

        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <TarjetaHeader icon={History} color={AZUL} titulo="Reportes recientes" descripcion="Últimos envíos de esta Casa de Paz" />
          <div className="flex flex-col gap-1.5 p-5">
            {recientes.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay reportes.</p>}
            {recientes.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm hover:bg-muted/50">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: `color-mix(in oklab, ${AZUL} 12%, transparent)` }}
                >
                  <CalendarCheck2 className="h-4 w-4" style={{ color: AZUL }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{fechaLegible(r.fecha_reunion)}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {r.total_asistentes} asistentes · {r.total_menores} niños / {r.total_mayores} adultos
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
