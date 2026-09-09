export interface RangoInactividad {
  etiqueta: string;
  cantidad: number;
}

interface Props {
  rangos: RangoInactividad[];
}

/** Un solo hue en rampa (más oscuro = más semanas sin venir) -- son buckets ORDINALES de severidad, mismo criterio que un rango etario. */
function colorPorIndice(i: number, total: number) {
  const pct = total <= 1 ? 0 : i / (total - 1);
  return `color-mix(in oklab, var(--destructive) ${Math.round(45 + pct * 50)}%, white)`;
}

/**
 * Hace cuánto que los inactivos no vienen -- una sola barra proporcional
 * partida por severidad (no un gráfico de barras horizontales más, 2026-09-08:
 * el owner pidió que dejara de repetir la misma forma que otros 3 gráficos).
 * Se lee como "de todos los inactivos, qué proporción es reciente vs.
 * crónica" de un solo vistazo, sin comparar largos de barras distintas.
 */
export function AntiguedadInactividadChart({ rangos }: Props) {
  const datos = rangos.map((r, i) => ({ ...r, color: colorPorIndice(i, rangos.length) })).filter((d) => d.cantidad > 0);
  const total = datos.reduce((acc, d) => acc + d.cantidad, 0);

  if (total === 0) {
    return <p className="text-sm text-muted-foreground">Nadie superó el umbral de inactividad -- buena señal.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-9 w-full gap-0.5 overflow-hidden rounded-full">
        {datos.map((d) => (
          <div
            key={d.etiqueta}
            className="flex items-center justify-center transition-[flex-grow] duration-500"
            style={{ flexGrow: d.cantidad, flexBasis: 0, background: d.color }}
            title={`${d.etiqueta}: ${d.cantidad}`}
          >
            {d.cantidad / total >= 0.12 && <span className="text-[12px] font-bold text-white">{d.cantidad}</span>}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {datos.map((d) => (
          <span key={d.etiqueta} className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="font-medium text-foreground">{d.cantidad}</span> {d.etiqueta}
          </span>
        ))}
      </div>
    </div>
  );
}
