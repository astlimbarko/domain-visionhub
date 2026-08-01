import { ChevronRight } from 'lucide-react';
import type { OpcionRolContextual } from '@/hooks/useOpcionesRolContextuales';

export type PosicionFila = 'only' | 'first' | 'middle' | 'last';

const REDONDEO: Record<PosicionFila, string> = {
  only: 'rounded-2xl',
  first: 'rounded-t-2xl',
  middle: '',
  last: 'rounded-b-2xl',
};

interface Props {
  opcion: OpcionRolContextual;
  posicion: PosicionFila;
  onSeleccionar: () => void;
}

/**
 * Una fila del grupo unido de la pantalla "Seleccionar rol". Toda la fila es
 * clicable (button, no solo la flecha) y mantiene siempre la misma altura --
 * el título admite hasta 2 líneas (roles con nombre largo, ej. "Supervisor
 * de la Visión en Acción") y hasta 2 líneas de dato secundario (anfitrión +
 * dirección de una Casa de Paz es el caso con más contenido).
 */
export function OpcionRolFila({ opcion, posicion, onSeleccionar }: Props) {
  const Icon = opcion.icon;

  return (
    <button
      type="button"
      onClick={onSeleccionar}
      className={`flex w-full min-h-[92px] items-center gap-4 bg-card px-5 py-4 text-left transition-colors hover:bg-muted/60 active:bg-muted focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
        posicion !== 'first' && posicion !== 'only' ? 'border-t border-border/70' : ''
      } ${REDONDEO[posicion]}`}
    >
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: opcion.bgIcono }}
      >
        <Icon className="h-5 w-5" style={{ color: opcion.colorIcono }} strokeWidth={2} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block text-[15px] font-bold leading-snug text-foreground">{opcion.titulo}</span>
        {opcion.lineas.length > 0 && (
          <span className="mt-1 flex flex-col gap-0.5">
            {opcion.lineas.map((linea, i) => (
              <span key={i} className="flex items-center gap-1.5 truncate text-[13px] text-muted-foreground" title={linea.texto}>
                {linea.icon && <linea.icon className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate">{linea.texto}</span>
              </span>
            ))}
          </span>
        )}
      </span>

      {opcion.colorRed && (
        <span
          className="h-6 w-6 shrink-0 rounded-full shadow-sm ring-1 ring-black/5"
          style={{ backgroundColor: opcion.colorRed }}
          aria-hidden="true"
        />
      )}

      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}
