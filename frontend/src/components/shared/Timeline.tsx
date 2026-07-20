import type { ReactNode } from 'react';

export interface TimelineItem {
  id: string;
  titulo: ReactNode;
  fecha?: string;
  descripcion?: ReactNode;
  dotColor?: string;
}

interface Props {
  items: TimelineItem[];
  vacio?: string;
}

export function Timeline({ items, vacio = 'Sin datos todavía.' }: Props) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{vacio}</p>;
  }

  return (
    <div className="flex flex-col">
      {items.map((item, i) => (
        <div key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
          {i < items.length - 1 && (
            <span className="absolute top-3 left-[5px] h-[calc(100%-0.75rem)] w-px bg-border" />
          )}
          <span
            className="relative z-10 mt-1 h-[11px] w-[11px] shrink-0 rounded-full ring-4 ring-background"
            style={{ background: item.dotColor ?? 'var(--primary)' }}
          />
          <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{item.titulo}</p>
              {item.descripcion && <p className="text-xs text-muted-foreground">{item.descripcion}</p>}
            </div>
            {item.fecha && <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">{item.fecha}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
