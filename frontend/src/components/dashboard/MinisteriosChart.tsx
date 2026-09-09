import { Trophy } from 'lucide-react';

export interface MinisterioConteo {
  nombre: string;
  cantidad: number;
}

interface Props {
  ministerios: MinisterioConteo[];
}

const COLOR = 'var(--chart-2)';
const MEDALLAS = ['#eda100', '#a8a8ad', '#c07a3e']; // oro/plata/bronce, para el 1ro/2do/3ro

/**
 * Top ministerios como "ranking" (posición + medalla en el podio + barra
 * inline), no un gráfico de barras más -- 2026-09-08, pedido del owner: se
 * repetía la misma forma de barra horizontal que otros 3 gráficos. Un
 * ranking se lee como una tabla de posiciones, distinto de todo lo demás en
 * esta pantalla.
 */
export function MinisteriosChart({ ministerios }: Props) {
  if (ministerios.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía nadie de tu Casa de Paz participa en un ministerio.</p>;
  }
  const max = Math.max(...ministerios.map((m) => m.cantidad));

  return (
    <div className="flex flex-col gap-3">
      {ministerios.map((m, i) => (
        <div key={m.nombre} className="flex items-center gap-3">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
            style={{ background: i < 3 ? MEDALLAS[i] : 'var(--muted-foreground)' }}
          >
            {i < 3 ? <Trophy className="h-3.5 w-3.5" /> : i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate text-[13px] font-medium text-foreground">{m.nombre}</span>
              <span className="shrink-0 text-[13px] font-bold text-foreground">{m.cantidad}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${Math.max(6, Math.round((m.cantidad / max) * 100))}%`, background: COLOR }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
