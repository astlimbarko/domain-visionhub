import { useState } from 'react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { ConfiguracionItem } from '@/types/panel-supervisor.types';

interface Props {
  item: ConfiguracionItem;
  onGuardar: (codigo: string, valor: string) => Promise<void>;
}

export function ConfiguracionRow({ item, onGuardar }: Props) {
  const [valor, setValor] = useState(item.valor_actual);
  const [guardando, setGuardando] = useState(false);

  async function guardar(nuevoValor: string) {
    if (nuevoValor === item.valor_actual) return;
    setGuardando(true);
    try {
      await onGuardar(item.codigo, nuevoValor);
    } catch {
      toast.error(`No se pudo guardar "${item.nombre}"`);
      setValor(item.valor_actual);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 border-b border-border py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium text-foreground">{item.nombre}</Label>
          {item.es_personalizado && (
            <Badge variant="secondary" className="text-xs">
              personalizado
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{item.descripcion}</p>
      </div>

      <div className="shrink-0">
        {item.tipo === 'BOOLEANO' && (
          <Switch
            checked={valor === 'true'}
            disabled={guardando}
            onCheckedChange={(checked) => {
              const nuevo = checked ? 'true' : 'false';
              setValor(nuevo);
              guardar(nuevo);
            }}
          />
        )}

        {item.tipo === 'NUMERICO' && (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              className="w-24"
              min={item.valor_min ?? undefined}
              max={item.valor_max ?? undefined}
              value={valor}
              disabled={guardando}
              onChange={(e) => setValor(e.target.value)}
              onBlur={(e) => guardar(e.target.value)}
            />
            {item.unidad && <span className="text-xs text-muted-foreground">{item.unidad}</span>}
          </div>
        )}

        {item.tipo === 'TEXTO' && (
          <Input
            className="w-48"
            value={valor}
            disabled={guardando}
            onChange={(e) => setValor(e.target.value)}
            onBlur={(e) => guardar(e.target.value)}
          />
        )}
      </div>
    </div>
  );
}
