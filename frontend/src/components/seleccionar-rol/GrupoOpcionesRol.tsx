import { OpcionRolFila, type PosicionFila } from './OpcionRolFila';
import type { OpcionRolContextual } from '@/hooks/useOpcionesRolContextuales';

interface Props {
  opciones: OpcionRolContextual[];
  onSeleccionar: (opcion: OpcionRolContextual) => void;
}

function posicionDe(indice: number, total: number): PosicionFila {
  if (total === 1) return 'only';
  if (indice === 0) return 'first';
  if (indice === total - 1) return 'last';
  return 'middle';
}

/**
 * Grupo unido de opciones (sin separación externa, sin sombra por fila) --
 * funciona igual para 1 o para 8 opciones, sin condiciones manuales por
 * cantidad (calcula isFirst/isLast/isOnly/isMiddle en `posicionDe`).
 */
export function GrupoOpcionesRol({ opciones, onSeleccionar }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 shadow-sm shadow-black/[0.03]">
      {opciones.map((opcion, i) => (
        <OpcionRolFila
          key={opcion.key}
          opcion={opcion}
          posicion={posicionDe(i, opciones.length)}
          onSeleccionar={() => onSeleccionar(opcion)}
        />
      ))}
    </div>
  );
}
