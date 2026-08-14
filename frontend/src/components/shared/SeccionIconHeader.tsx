import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  icon: LucideIcon;
  color: string;
  titulo: string;
  descripcion?: ReactNode;
  size?: 'default' | 'sm';
}

/**
 * Ícono + color propios de una sección, para identificar su tema de un
 * vistazo. Sirve tanto de header de Card (Dashboard) como de encabezado de
 * subsección suelto dentro de un formulario largo (Reportes).
 */
export function SeccionIconHeader({ icon: Icon, color, titulo, descripcion, size = 'default' }: Props) {
  const cajaSize = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';
  const iconoSize = size === 'sm' ? 'h-4 w-4' : 'h-4.5 w-4.5';
  const tituloSize = size === 'sm' ? 'text-sm' : 'text-base';

  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex ${cajaSize} shrink-0 items-center justify-center rounded-xl`}
        style={{ backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)` }}
      >
        <Icon className={iconoSize} style={{ color }} />
      </div>
      <div>
        <h3 className={`font-heading ${tituloSize} leading-snug font-semibold tracking-tight text-foreground`}>{titulo}</h3>
        {descripcion && <p className="text-[12px] text-muted-foreground">{descripcion}</p>}
      </div>
    </div>
  );
}
