interface Props {
  verdes: number;
  amarillos: number;
  rojos: number;
}

const FILAS: { clave: 'verdes' | 'amarillos' | 'rojos'; etiqueta: string; color: string }[] = [
  { clave: 'verdes', etiqueta: 'Al día', color: 'var(--chart-2)' },
  { clave: 'amarillos', etiqueta: 'En riesgo', color: '#f59e0b' },
  { clave: 'rojos', etiqueta: 'Inactivos', color: 'var(--destructive)' },
];

const SIZE = 180;
const STROKE = 16;

/**
 * Aro de 3 segmentos (verde/ambar/rojo a proporcion). El DonutRing generico
 * solo pinta el arco de UN valor -- si todos los miembros están en rojo, ese
 * arco mide 0% y no se dibuja nada, dejando un aro vacío que parece roto
 * aunque el dato sea correcto (todos inactivos). Acá el aro completo siempre
 * queda cubierto por algún color mientras haya al menos un miembro.
 */
export function IndiceFidelidadRing({ verdes, amarillos, rojos }: Props) {
  const total = verdes + amarillos + rojos;
  const porcentaje = total > 0 ? Math.round((verdes / total) * 100) : null;
  const conteos = { verdes, amarillos, rojos };

  const radius = (SIZE - STROKE) / 2;
  const circunferencia = 2 * Math.PI * radius;
  let acumulado = 0;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-center sm:gap-8">
      <div className="flex flex-col items-center gap-2">
        <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90" aria-hidden="true">
            <circle cx={SIZE / 2} cy={SIZE / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={STROKE} />
            {total > 0 &&
              FILAS.map((f) => {
                const valor = conteos[f.clave];
                if (valor === 0) return null;
                const largo = (valor / total) * circunferencia;
                const offset = -acumulado;
                acumulado += largo;
                return (
                  <circle
                    key={f.clave}
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={radius}
                    fill="none"
                    stroke={f.color}
                    strokeWidth={STROKE}
                    strokeDasharray={`${largo} ${circunferencia - largo}`}
                    strokeDashoffset={offset}
                    className="transition-[stroke-dashoffset] duration-700 ease-out"
                  />
                );
              })}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-3xl font-bold tracking-tight text-foreground">{porcentaje ?? '—'}%</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">al día</p>
            </div>
          </div>
        </div>
        <p className="max-w-[200px] text-center text-[11px] text-muted-foreground">
          Miembros con asistencia regular sobre el total de tu Casa de Paz.
        </p>
      </div>

      <div className="flex w-full max-w-[180px] flex-col gap-2">
        {FILAS.map((f) => (
          <div key={f.clave} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 text-foreground">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: f.color }} />
              {f.etiqueta}
            </span>
            <span className="font-semibold text-foreground">{conteos[f.clave]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
