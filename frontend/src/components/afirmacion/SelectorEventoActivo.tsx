import { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEventosAfirmacion } from '@/hooks/useAfirmacionEventos';
import { useAuthStore } from '@/stores/useAuthStore';
import { useEventoAfirmacionActivo } from '@/stores/useEventoAfirmacionActivo';

export function SelectorEventoActivo() {
  const iglesiaId = useAuthStore((s) => s.iglesiaActivaId);
  const { data: eventos = [] } = useEventosAfirmacion(iglesiaId, true);
  const { eventoId, setEventoActivo } = useEventoAfirmacionActivo();
  const [value, setValue] = useState(eventoId || '');

  useEffect(() => {
    setValue(eventoId || '');
  }, [eventoId]);

  const onChange = (v: string) => {
    if (v === 'sin-evento') {
      setEventoActivo(null);
      setValue('');
      return;
    }
    const ev = eventos.find((e) => e.id === v);
    setEventoActivo(v, ev?.titulo || null);
    setValue(v);
  };

  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[240px] h-9">
          <SelectValue placeholder="Sin evento (acumulado)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="sin-evento">Sin evento (acumulado)</SelectItem>
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
