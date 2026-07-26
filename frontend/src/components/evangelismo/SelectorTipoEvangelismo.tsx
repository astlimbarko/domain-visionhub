import { Cog } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TipoEvangelismo } from '@/types/evangelismo.types';

interface Props {
  tipos: TipoEvangelismo[];
  valor: string | undefined;
  onSeleccionar: (tipo: TipoEvangelismo) => void;
}

/**
 * Selector de tipo de evangelismo (1+1, Elite, Semilla, ...): un engranaje
 * por tipo, con el nombre en el centro sobre un disco solido (para que se
 * lea limpio en vez de superponerse a los dientes del engranaje). Elegir uno
 * "activa" ese tipo -- el llamador recién ahí muestra el formulario de
 * carga, y lo que se guarde queda etiquetado con ese tipo.
 */
export function SelectorTipoEvangelismo({ tipos, valor, onSeleccionar }: Props) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-8">
      {tipos.map((t) => {
        const seleccionado = valor === t.id;
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={seleccionado}
            onClick={() => onSeleccionar(t)}
            className="group flex flex-col items-center justify-self-center gap-2"
          >
            <span
              className={cn(
                'relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full transition-all duration-300 active:scale-95 sm:h-24 sm:w-24',
                seleccionado ? 'shadow-md' : 'hover:shadow-sm'
              )}
              style={{ backgroundColor: `color-mix(in oklab, ${t.color} ${seleccionado ? 20 : 10}%, transparent)` }}
            >
              <Cog
                className={cn(
                  'h-16 w-16 shrink-0 transition-all duration-700 ease-out group-hover:rotate-45 sm:h-24 sm:w-24',
                  seleccionado ? '' : 'opacity-40 group-hover:opacity-70'
                )}
                style={{ color: t.color }}
                strokeWidth={1}
              />
              {/* Disco solido detras del nombre: sin esto, el texto se mezcla con las lineas del engranaje. */}
              <span
                className={cn(
                  'pointer-events-none absolute flex h-9 w-9 items-center justify-center rounded-full bg-background transition-shadow sm:h-13 sm:w-13',
                  seleccionado ? 'shadow-[0_0_0_2px_var(--tw-shadow-color)]' : 'ring-1 ring-black/5'
                )}
                style={seleccionado ? ({ '--tw-shadow-color': t.color } as React.CSSProperties) : undefined}
              >
                <span
                  className={cn(
                    'px-1 text-center text-[9px] leading-[1.05] font-extrabold sm:px-1.5 sm:text-[12px]',
                    seleccionado ? '' : 'text-foreground/80'
                  )}
                  style={seleccionado ? { color: t.color } : undefined}
                >
                  {t.nombre}
                </span>
              </span>
            </span>
            <span
              className={cn('h-1 w-1 rounded-full transition-opacity', seleccionado ? 'opacity-100' : 'opacity-0')}
              style={{ backgroundColor: t.color }}
            />
          </button>
        );
      })}
    </div>
  );
}
