import { ChevronRight } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { OpcionRolContextual } from '@/hooks/useOpcionesRolContextuales';

interface Props {
  opcion: OpcionRolContextual;
  onSeleccionar: () => void;
}

/**
 * Una fila de la pantalla "Seleccionar rol": tarjeta redondeada propia por
 * opción (ya no un grupo fusionado con una sola tarjeta exterior). Reposo
 * con el tinte suave del color del rol, hover con borde saturado + flecha
 * coloreada, click con relleno sólido y contenido en blanco. Los 4 tonos
 * (fondo, borde, color, color oscuro para la flecha en click) se derivan
 * con `color-mix` de los 2 colores que ya definía `FILA_ROL_VISUAL`
 * (`bgIcono`/`colorIcono`), sin hardcodear un hex nuevo por estado.
 * Referencia visual: opencode/multirol/{modelo,hover,click}.jpeg.
 */
export function OpcionRolFila({ opcion, onSeleccionar }: Props) {
  const Icon = opcion.icon;
  const vars = {
    '--fila-bg': `color-mix(in oklab, ${opcion.bgIcono} 55%, white)`,
    '--fila-borde': opcion.bgIcono,
    '--fila-color': opcion.colorIcono,
    '--fila-color-oscuro': `color-mix(in oklab, ${opcion.colorIcono} 100%, black 25%)`,
  } as CSSProperties;

  return (
    <button
      type="button"
      onClick={onSeleccionar}
      style={vars}
      className="group flex min-h-[52px] w-full items-center gap-2.5 rounded-2xl border-2 border-[var(--fila-borde)] bg-[var(--fila-bg)] px-3.5 py-2 text-left transition-colors hover:border-[var(--fila-color)] active:border-white/30 active:bg-[var(--fila-color)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fila-color)]/50"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--fila-borde)] transition-colors group-active:bg-white">
        <Icon className="h-4 w-4" style={{ color: opcion.colorIcono }} strokeWidth={2} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="line-clamp-1 block text-[14px] font-bold leading-snug text-foreground transition-colors group-active:text-white">{opcion.titulo}</span>
        {opcion.lineas.length > 0 && (
          <span className="mt-0.5 flex flex-col gap-0.5">
            {opcion.lineas.map((linea, i) => (
              <span
                key={i}
                className="flex items-center gap-1.5 truncate text-[12px] text-muted-foreground transition-colors group-active:text-white/85"
                title={linea.texto}
              >
                {linea.icon && <linea.icon className="h-3 w-3 shrink-0" />}
                <span className="truncate">{linea.texto}</span>
              </span>
            ))}
          </span>
        )}
      </span>

      {opcion.colorRed && (
        <span
          className="h-5 w-5 shrink-0 rounded-full shadow-sm ring-1 ring-black/5 group-active:ring-white/40"
          style={{ backgroundColor: opcion.colorRed }}
          aria-hidden="true"
        />
      )}

      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors group-hover:bg-[var(--fila-color)] group-hover:text-white group-active:bg-[var(--fila-color-oscuro)] group-active:text-white">
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </button>
  );
}
