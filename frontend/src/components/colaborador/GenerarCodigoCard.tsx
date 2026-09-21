import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { AMBAR } from '@/components/dashboard/DashboardUI';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { cn } from '@/lib/utils';
import { useGenerarCodigoColaborador } from '@/hooks/useColaborador';

// KAN-405: sugerencias del ticket -- 6 horas, 1 día, 2 días, o personalizado.
const PRESETS = [
  { valor: '360', label: '6 horas' },
  { valor: '1440', label: '1 día' },
  { valor: '2880', label: '2 días' },
  { valor: 'custom', label: 'Personalizado' },
] as const;

interface Props {
  iglesiaId: string;
  departamentoCodigo: string;
}

export function GenerarCodigoCard({ iglesiaId, departamentoCodigo }: Props) {
  const [preset, setPreset] = useState<string>('360');
  const [dias, setDias] = useState('0');
  const [horas, setHoras] = useState('6');
  const [ultimoCodigo, setUltimoCodigo] = useState<string | null>(null);
  const generar = useGenerarCodigoColaborador(iglesiaId, departamentoCodigo);

  function minutosElegidos(): number {
    if (preset !== 'custom') return Number(preset);
    return Math.max(0, Number(dias) || 0) * 24 * 60 + Math.max(0, Number(horas) || 0) * 60;
  }

  function handleGenerar() {
    const minutos = minutosElegidos();
    if (minutos <= 0) {
      toast.error('Elegí una duración mayor a 0.');
      return;
    }
    generar.mutate(minutos, {
      onSuccess: (data) => {
        setUltimoCodigo(data.codigo);
        toast.success('Código generado.');
      },
      onError: () => toast.error('No se pudo generar el código.'),
    });
  }

  function copiar() {
    if (!ultimoCodigo) return;
    navigator.clipboard?.writeText(ultimoCodigo).then(() => toast.success('Código copiado.'));
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
      <TarjetaHeader
        icon={KeyRound}
        color={AMBAR}
        titulo="Generar código"
        descripcion="Reutilizable por varias personas -- repartilo de palabra el día del evento."
      />
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-muted-foreground">Duración</label>
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger className={cn('w-48', CAMPO_ESTILO)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p.valor} value={p.valor}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {preset === 'custom' && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-medium text-muted-foreground">Días</label>
                <Input type="number" min={0} className={cn('w-20', CAMPO_ESTILO)} value={dias} onChange={(e) => setDias(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-medium text-muted-foreground">Horas</label>
                <Input type="number" min={0} max={23} className={cn('w-20', CAMPO_ESTILO)} value={horas} onChange={(e) => setHoras(e.target.value)} />
              </div>
            </>
          )}

          <Button onClick={handleGenerar} disabled={generar.isPending}>
            {generar.isPending ? 'Generando...' : 'Generar código'}
          </Button>
        </div>

        {ultimoCodigo && (
          <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
            <span className="font-mono text-2xl font-bold tracking-[0.3em]">{ultimoCodigo}</span>
            <Button variant="outline" size="icon-sm" onClick={copiar} title="Copiar código">
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
