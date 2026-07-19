import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  titulo: string;
  valor: string | number | null | undefined;
  variacionPct?: number | null;
  subtitulo?: string;
}

export function KpiCard({ titulo, valor, variacionPct, subtitulo }: Props) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{valor ?? '—'}</p>
        {subtitulo && <p className="text-xs text-muted-foreground">{subtitulo}</p>}
        {variacionPct !== undefined && variacionPct !== null && (
          <p className={`mt-1 flex items-center gap-1 text-xs ${variacionPct > 0 ? 'text-emerald-600' : variacionPct < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
            {variacionPct > 0 ? <ArrowUp className="h-3 w-3" /> : variacionPct < 0 ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {Math.abs(variacionPct)}% vs. período anterior
          </p>
        )}
      </CardContent>
    </Card>
  );
}
