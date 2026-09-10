import { User } from 'lucide-react';

interface Props {
  hombres: number;
  mujeres: number;
}

const AZUL = 'var(--chart-1)';
const ROSA = '#ff2d55';
/** Cuántos íconos como máximo se dibujan -- cada uno representa un bloque proporcional de personas, no 1 a 1, para que no se desborde con CdP grandes. */
const MAX_ICONOS = 24;

/**
 * Pictograma (icon array): cada ícono de persona representa una porción de
 * la Casa de Paz, coloreado por sexo -- mucho más directo de leer que una
 * dona con porcentajes (2026-09-08, pedido del owner: que se entienda de un
 * vistazo qué está pasando, no solo un gráfico técnico más).
 */
export function ComposicionSexoChart({ hombres, mujeres }: Props) {
  const total = hombres + mujeres;
  if (total === 0) return <p className="text-sm text-muted-foreground">Sin personas todavía.</p>;

  const totalIconos = Math.min(MAX_ICONOS, total);
  const iconosHombres = Math.max(hombres > 0 ? 1 : 0, Math.round((hombres / total) * totalIconos));
  const iconosMujeres = Math.max(mujeres > 0 ? 1 : 0, totalIconos - iconosHombres);
  const porUnidad = total / totalIconos;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: iconosHombres }).map((_, i) => (
          <User key={`h${i}`} className="h-5 w-5 shrink-0" style={{ color: AZUL }} fill={AZUL} strokeWidth={0} />
        ))}
        {Array.from({ length: iconosMujeres }).map((_, i) => (
          <User key={`m${i}`} className="h-5 w-5 shrink-0" style={{ color: ROSA }} fill={ROSA} strokeWidth={0} />
        ))}
      </div>
      {porUnidad > 1.05 && <p className="text-[11px] text-muted-foreground">Cada ícono representa ~{Math.round(porUnidad)} personas</p>}
      <div className="flex items-center gap-5 text-sm">
        <span className="flex items-center gap-1.5 text-foreground">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: AZUL }} />
          <span className="font-semibold">{hombres}</span> Hombres <span className="text-muted-foreground">({total > 0 ? Math.round((hombres / total) * 100) : 0}%)</span>
        </span>
        <span className="flex items-center gap-1.5 text-foreground">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: ROSA }} />
          <span className="font-semibold">{mujeres}</span> Mujeres <span className="text-muted-foreground">({total > 0 ? Math.round((mujeres / total) * 100) : 0}%)</span>
        </span>
      </div>
    </div>
  );
}
