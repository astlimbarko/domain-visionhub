import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Estilo compartido "Perfil": encabezado de tarjeta con una banda tenue del
 * color de la sección (ícono en caja redondeada + título del mismo color +
 * descripción), y el dato de resumen que va dentro del hero navy.
 * Usado por el Perfil de Casa de Paz y el Dashboard de Líder de Red para que
 * ambos compartan exactamente el mismo lenguaje visual.
 */

/** Degradado del banner de identidad: navy → blanco en diagonal. */
export const GRADIENTE_HERO =
  'linear-gradient(120deg, var(--brand-navy) 0%, var(--brand-navy-soft) 50%, color-mix(in oklab, var(--brand-navy-soft) 62%, #fff) 82%, color-mix(in oklab, var(--brand-navy-soft) 42%, #fff) 100%)';

/** Degradado del sello de identidad (ícono): azul → blanco. */
export const DEGRADADO_IDENTIDAD = 'linear-gradient(135deg, var(--chart-1) 0%, color-mix(in oklab, var(--chart-1) 52%, #fff) 100%)';

/** Encabezado de tarjeta con banda tenue del color de la sección. */
export function TarjetaHeader({
  icon: Icon,
  color,
  titulo,
  descripcion,
  accion,
}: {
  icon: LucideIcon;
  color: string;
  titulo: string;
  descripcion: string;
  accion?: ReactNode;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-4"
      style={{ backgroundColor: `color-mix(in oklab, ${color} 8%, transparent)` }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
          style={{ backgroundColor: color, boxShadow: `0 6px 14px -5px color-mix(in oklab, ${color} 55%, transparent)` }}
        >
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </div>
        <div>
          <p className="font-semibold" style={{ color }}>{titulo}</p>
          <p className="text-[12px] text-muted-foreground">{descripcion}</p>
        </div>
      </div>
      {accion}
    </div>
  );
}

/** Dato de resumen dentro del hero navy: ícono + etiqueta clara + valor con punto opcional. */
export function HeroDato({
  icon: Icon,
  label,
  valor,
  dot,
  valorClase = 'text-white',
}: {
  icon: LucideIcon;
  label: string;
  valor: ReactNode;
  dot?: string;
  valorClase?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-[12px] font-medium text-white/60">
        <Icon className="h-3.5 w-3.5 shrink-0" /> {label}
      </span>
      <span className={`flex items-center gap-2 text-[15px] font-semibold ${valorClase}`}>
        {dot && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dot }} />}
        <span className="truncate">{valor}</span>
      </span>
    </div>
  );
}
