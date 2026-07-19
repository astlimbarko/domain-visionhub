import { Badge } from '@/components/ui/badge';

const ESTILOS: Record<string, string> = {
  VERDE: 'border-emerald-500 text-emerald-600',
  AMARILLO: 'border-amber-500 text-amber-600',
  ROJO: 'border-red-500 text-red-600',
};

export function SemaforoBadge({ semaforo }: { semaforo: string }) {
  return (
    <Badge variant="outline" className={ESTILOS[semaforo] ?? ''}>
      {semaforo}
    </Badge>
  );
}
