import { ChevronRight } from 'lucide-react';
import { useState, type CSSProperties, type PointerEvent } from 'react';
import type { OpcionRolContextual } from '@/hooks/useOpcionesRolContextuales';

interface Props {
  opcion: OpcionRolContextual;
  onSeleccionar: () => void;
}

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

/**
 * Una fila de la pantalla "Seleccionar rol": lista plana con divisores finos
 * (GrupoOpcionesRol), no tarjetas individuales. Reposo sin fondo, hover con
 * un tinte gris parejo sobre toda la fila, click con borde del color propio
 * del rol + un "ripple" que nace del punto exacto donde se apretó. Los 2
 * tonos (fondo del ícono, color del ícono/borde) vienen de `FILA_ROL_VISUAL`
 * (`bgIcono`/`colorIcono`), sin hardcodear un hex nuevo por estado.
 * Referencia visual: m.png / m_hover.png / m_click.png (raíz del repo).
 */
export function OpcionRolFila({ opcion, onSeleccionar }: Props) {
  const Icon = opcion.icon;
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const vars = {
    '--fila-bg-icono': opcion.bgIcono,
    '--fila-color': opcion.colorIcono,
  } as CSSProperties;

  function agregarRipple(e: PointerEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.3;
    setRipples((r) => [
      ...r,
      { id: Date.now(), x: e.clientX - rect.left - size / 2, y: e.clientY - rect.top - size / 2, size },
    ]);
  }

  return (
    <button
      type="button"
      onClick={onSeleccionar}
      onPointerDown={agregarRipple}
      style={vars}
      className="group relative flex min-h-[52px] w-full items-center gap-2.5 overflow-hidden rounded-2xl border-2 border-transparent px-3.5 py-2 text-left transition-colors hover:bg-muted/70 active:border-[var(--fila-color)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fila-color)]/50"
    >
      {ripples.map((r) => (
        <span
          key={r.id}
          onAnimationEnd={() => setRipples((rs) => rs.filter((x) => x.id !== r.id))}
          className="animate-fila-ripple pointer-events-none absolute rounded-full bg-[var(--fila-color)]/25"
          style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
          aria-hidden="true"
        />
      ))}

      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--fila-bg-icono)]">
        <Icon className="h-4 w-4" style={{ color: opcion.colorIcono }} strokeWidth={2} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="line-clamp-1 block text-[14px] font-bold leading-snug text-foreground">{opcion.titulo}</span>
        {opcion.lineas.length > 0 && (
          <span className="mt-0.5 flex flex-col gap-0.5">
            {opcion.lineas.map((linea, i) => (
              <span
                key={i}
                className="flex items-center gap-1.5 truncate text-[12px] text-muted-foreground"
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
          className="h-5 w-5 shrink-0 rounded-full shadow-sm ring-1 ring-black/5"
          style={{ backgroundColor: opcion.colorRed }}
          aria-hidden="true"
        />
      )}

      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-[var(--fila-color)]" aria-hidden="true" />
    </button>
  );
}
