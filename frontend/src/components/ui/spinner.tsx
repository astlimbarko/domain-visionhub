import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Spinner de carga estándar de la app -- usar dentro de botones o como indicador inline mientras algo tarda. */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin', className)} aria-hidden="true" />;
}
