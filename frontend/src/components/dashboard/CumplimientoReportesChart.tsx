interface Props {
  /** % de las últimas semanas cerradas con reporte enviado, o null si todavía no cerró ninguna semana. */
  cumplimiento: number | null;
  /** Semanas consecutivas con reporte, contando hacia atrás desde la más reciente. */
  racha: number;
  ventanaSemanas: number;
}

/** El fill lleva la severidad (bueno → alerta → peligro); el track es un paso más claro del mismo ramp -- patrón "Meter" para una proporción contra un límite, no una serie categórica. */
function colorSegunCumplimiento(pct: number) {
  if (pct >= 80) return 'var(--chart-2)';
  if (pct >= 50) return '#f59e0b';
  return 'var(--destructive)';
}

/**
 * Cumplimiento de reportes semanales (2026-09-08, pedido del owner: gráfico
 * nuevo, exclusivo de la pestaña Seguimiento) -- mismo cálculo que ya usa
 * "Historial de Reportes" (semanasVentana/cumplimiento/racha), acá resumido
 * en un medidor en vez de un calendario completo.
 */
export function CumplimientoReportesChart({ cumplimiento, racha, ventanaSemanas }: Props) {
  if (cumplimiento === null) {
    return <p className="text-sm text-muted-foreground">Todavía no se cerró ninguna semana para medir el cumplimiento.</p>;
  }
  const color = colorSegunCumplimiento(cumplimiento);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="text-3xl font-bold tracking-tight text-foreground">{cumplimiento}%</span>
        <span className="text-[13px] text-muted-foreground">últimas {ventanaSemanas} semanas</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full" style={{ background: `color-mix(in oklab, ${color} 16%, transparent)` }}>
        <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${cumplimiento}%`, background: color }} />
      </div>
      <p className="text-[13px] text-muted-foreground">
        {racha > 0 ? (
          <>
            <span className="font-semibold text-foreground">{racha}</span> semana{racha === 1 ? '' : 's'} seguida{racha === 1 ? '' : 's'} con reporte enviado
          </>
        ) : (
          'Sin racha activa -- la última semana cerrada quedó sin reporte'
        )}
      </p>
    </div>
  );
}
