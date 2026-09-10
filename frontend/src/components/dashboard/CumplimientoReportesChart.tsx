export interface DetalleSemanaReporte {
  /** true si la semana ya cerró (terminó el domingo); las semanas en curso no cuentan para el cumplimiento. */
  cerrada: boolean;
  /** true si hubo reporte enviado en esa semana. */
  reportado: boolean;
}

interface Props {
  /** % de las últimas semanas cerradas con reporte enviado, o null si todavía no cerró ninguna semana. */
  cumplimiento: number | null;
  /** Semanas consecutivas con reporte, contando hacia atrás desde la más reciente. */
  racha: number;
  ventanaSemanas: number;
  /** Una casilla por semana de la ventana, de la más vieja a la más reciente. */
  detalleSemanas: DetalleSemanaReporte[];
}

/** El color lleva la severidad (bueno → alerta → peligro), igual criterio que un medidor -- no es una serie categórica. */
function colorSegunCumplimiento(pct: number) {
  if (pct >= 80) return 'var(--chart-2)';
  if (pct >= 50) return '#f59e0b';
  return 'var(--destructive)';
}

/**
 * Cumplimiento de reportes semanales -- grilla tipo "racha" (una casilla por
 * semana, verde si se envió reporte) en vez de una sola barra de progreso más
 * (2026-09-08, pedido del owner: se leía igual que otros medidores de esta
 * pantalla). De un vistazo se ve EN QUÉ semana puntual falló, no solo el
 * promedio -- mismo cálculo que ya usa "Historial de Reportes".
 */
export function CumplimientoReportesChart({ cumplimiento, racha, ventanaSemanas, detalleSemanas }: Props) {
  if (cumplimiento === null) {
    return <p className="text-sm text-muted-foreground">Todavía no se cerró ninguna semana para medir el cumplimiento.</p>;
  }
  const color = colorSegunCumplimiento(cumplimiento);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <span className="text-3xl font-bold tracking-tight" style={{ color }}>
          {cumplimiento}%
        </span>
        <span className="text-[13px] text-muted-foreground">últimas {ventanaSemanas} semanas</span>
      </div>
      <div className="flex gap-1.5">
        {detalleSemanas.map((s, i) => (
          <div
            key={i}
            className="h-7 flex-1 rounded-md transition-colors duration-500"
            style={{
              background: !s.cerrada ? 'var(--muted)' : s.reportado ? 'var(--chart-2)' : 'color-mix(in oklab, var(--destructive) 70%, white)',
            }}
            title={!s.cerrada ? 'Semana en curso' : s.reportado ? 'Reporte enviado' : 'Sin reporte'}
          />
        ))}
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
