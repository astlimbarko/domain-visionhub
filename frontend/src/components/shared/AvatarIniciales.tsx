import { UserRound } from 'lucide-react';

/** Colores de avatar que rotan por posición, para dar variedad como en el diseño. */
export const COLORES_AVATAR = ['var(--chart-2)', 'var(--chart-1)', 'var(--chart-3)', 'var(--chart-4)'];

export function iniciales(nombreCompleto: string) {
  const palabras = nombreCompleto.trim().split(/\s+/);
  return ((palabras[0]?.[0] ?? '') + (palabras[1]?.[0] ?? '')).toUpperCase();
}

export function AvatarPersona({
  nombre,
  color,
  size = 'md',
}: {
  nombre: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const dim = size === 'lg' ? 'h-11 w-11 text-sm' : size === 'sm' ? 'h-7 w-7 text-[11px]' : 'h-9 w-9 text-[13px]';
  return (
    <div
      title={nombre}
      className={`flex ${dim} shrink-0 items-center justify-center rounded-full font-bold ring-2 ring-card`}
      style={{ backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)`, color }}
    >
      {iniciales(nombre) || <UserRound className="h-4 w-4" />}
    </div>
  );
}

interface PersonaMini {
  id: string;
  nombre_completo: string;
}

/** Fila compacta de avatares circulares (con iniciales) para resumir varias
 * personas en poco espacio -- p. ej. sublíderes de una Casa de Paz en una
 * tarjeta de listado. Muestra hasta `max` avatares y agrupa el resto en un
 * "+N" con tooltip con los nombres completos. */
export function GrupoAvataresCompacto({ personas, max = 3 }: { personas: PersonaMini[]; max?: number }) {
  if (personas.length === 0) return null;
  const visibles = personas.slice(0, max);
  const restantes = personas.slice(max);
  return (
    <div className="flex items-center -space-x-2">
      {visibles.map((p, i) => (
        <AvatarPersona key={p.id} nombre={p.nombre_completo} color={COLORES_AVATAR[i % COLORES_AVATAR.length]} size="sm" />
      ))}
      {restantes.length > 0 && (
        <div
          title={restantes.map((p) => p.nombre_completo).join(', ')}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground ring-2 ring-card"
        >
          +{restantes.length}
        </div>
      )}
    </div>
  );
}
