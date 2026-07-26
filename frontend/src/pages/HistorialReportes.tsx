import { CalendarCheck2, Flame, History } from 'lucide-react';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SeccionIconHeader } from '@/components/shared/SeccionIconHeader';
import { DonutRing } from '@/components/dashboard/DonutRing';
import { HistorialReportesCalendario } from '@/components/reporte/HistorialReportesCalendario';
import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';
import { useAuthStore } from '@/store/auth.store';
import { useMisCasasDePaz } from '@/hooks/useCalendario';
import { useHistorialReportes, useReportesRecientes } from '@/hooks/useReporte';
import { aISO, fechaLegible, finSemanaISO, inicioSemanaISO } from '@/utils/calendario-fechas';
import { cn } from '@/lib/utils';

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
  const personaId = useAuthStore((s) => s.personaId);
  const { data: misCasas, isLoading: cargandoCasas } = useMisCasasDePaz(personaId);
  const [casaDePazId, setCasaDePazId] = useState<string>();
  const cdpActiva = casaDePazId ?? misCasas?.[0]?.casa_de_paz_id;

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--chart-2)]/10">
            <History className="h-5 w-5" style={{ color: 'var(--chart-2)' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Historial de Reportes</h1>
            <p className="mt-0.5 text-[13px] text-muted-foreground">Qué semanas mandó reporte tu Casa de Paz, y cuáles se quedaron sin enviar</p>
          </div>
        </div>
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
      </div>

      {cargandoVentana ? (
        <Skeleton className="h-32 w-full rounded-2xl" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Semanas con reporte: número grande + tira de segmentos, uno por semana. */}
          <div className="glass-card-elevated flex flex-col gap-3 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--chart-2)]">
                <CalendarCheck2 className="h-4.5 w-4.5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Semanas con reporte</p>
                <p className="text-2xl font-bold tracking-tight text-foreground">
                  {semanasReportadas} <span className="text-sm font-medium text-muted-foreground">de {VENTANA_SEMANAS}</span>
                </p>
              </div>
            </div>
            <div className="flex gap-1">
              {semanas
                .slice()
                .reverse()
                .map((s) => (
                  <span
                    key={s.inicio}
                    className={cn('h-1.5 flex-1 rounded-full', semanasConReporte.has(s.inicio) ? 'bg-[var(--chart-2)]' : 'bg-muted')}
                  />
                ))}
            </div>
          </div>

          {/* Racha: rachas largas son un logro, por eso el color calido/energico. */}
          <div className="glass-card-elevated flex items-center gap-4 rounded-2xl p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: 'var(--chart-3)' }}>
              <Flame className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Racha actual</p>
              <p className="text-2xl font-bold tracking-tight text-foreground">
                {racha} <span className="text-sm font-medium text-muted-foreground">semana{racha === 1 ? '' : 's'} seguidas</span>
              </p>
            </div>
          </div>

          {/* Cumplimiento: el arco ya comunica el nivel sin necesitar rojo -- ambar solo bajo 80%. */}
          <div className="glass-card-elevated flex items-center gap-4 rounded-2xl p-4">
            <DonutRing
              porcentaje={cumplimiento}
              size={52}
              strokeWidth={6}
              color={cumplimiento != null && cumplimiento < 80 ? '#f59e0b' : '#06b6d4'}
            >
              <span className="text-xs font-bold text-foreground">{cumplimiento != null ? `${cumplimiento}%` : '—'}</span>
            </DonutRing>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Cumplimiento</p>
              <p className="text-[11px] text-muted-foreground">Semanas cerradas con reporte a tiempo</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <HistorialReportesCalendario casaDePazId={cdpActiva} />
        </div>

        <div className="glass-card-elevated rounded-2xl p-5">
          <SeccionIconHeader icon={History} color="#06b6d4" titulo="Reportes recientes" size="sm" />
          <div className="mt-4 flex flex-col gap-1.5">
            {recientes.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay reportes.</p>}
            {recientes.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm hover:bg-muted/50">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#06b6d4]/12">
                  <CalendarCheck2 className="h-4 w-4" style={{ color: '#06b6d4' }} />
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
        </div>
      </div>
    </div>
  );
}
