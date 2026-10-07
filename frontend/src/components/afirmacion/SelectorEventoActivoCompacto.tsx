import { Calendar } from 'lucide-react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEventosAfirmacion } from '@/hooks/useAfirmacionEventos';
import { useAuthStore } from '@/stores/useAuthStore';
import { useEventoAfirmacionActivo } from '@/stores/useEventoAfirmacionActivo';

export function SelectorEventoActivoCompacto() {
  const iglesiaId = useAuthStore((s) => s.iglesiaActivaId);
  const { data: eventos = [] } = useEventosAfirmacion(iglesiaId, true);
  const { eventoId, setEventoActivo } = useEventoAfirmacionActivo();

  const onChange = (v: string) => {
    if (v === '__none__') {
      setEventoActivo(null);
      return;
    }
    const ev = eventos.find((e) => e.id === v);
    setEventoActivo(v, ev?.titulo || null);
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <span className="text-muted-foreground">Evento:</span>
      <Select value={eventoId || '__none__'} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-[220px]">
          <SelectValue placeholder="Sin evento" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Sin evento (acumulado)</SelectItem>
          {eventos.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {e.titulo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
