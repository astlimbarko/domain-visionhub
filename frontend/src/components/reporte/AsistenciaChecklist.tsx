import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { MiembroCdp, NuevaVisita } from '@/types/reporte.types';

interface Props {
  miembros: MiembroCdp[];
  seleccionados: Set<string>;
  onToggle: (personaId: string, marcado: boolean) => void;
  esMenorPorPersona: Record<string, boolean>;
  onEsMenorChange: (personaId: string, esMenor: boolean) => void;
  visitasNuevas: NuevaVisita[];
  onAgregarVisita: (visita: NuevaVisita) => void;
  onQuitarVisita: (index: number) => void;
}

export function AsistenciaChecklist({
  miembros,
  seleccionados,
  onToggle,
  esMenorPorPersona,
  onEsMenorChange,
  visitasNuevas,
  onAgregarVisita,
  onQuitarVisita,
}: Props) {
  const [mostrarFormVisita, setMostrarFormVisita] = useState(false);
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [sexo, setSexo] = useState<'M' | 'F' | ''>('');
  const [esMenorVisita, setEsMenorVisita] = useState(false);

  function agregar() {
    if (!nombre.trim() || !apellido.trim() || !sexo) return;
    onAgregarVisita({
      primer_nombre: nombre.trim(),
      primer_apellido: apellido.trim(),
      sexo,
      es_menor: esMenorVisita,
    });
    setNombre('');
    setApellido('');
    setSexo('');
    setEsMenorVisita(false);
    setMostrarFormVisita(false);
  }

  return (
    <div className="flex flex-col gap-2">
      {miembros.map((m) => (
        <div key={m.persona_id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
          <Checkbox
            id={`m-${m.persona_id}`}
            checked={seleccionados.has(m.persona_id)}
            onCheckedChange={(v) => onToggle(m.persona_id, v === true)}
          />
          <Label htmlFor={`m-${m.persona_id}`} className="flex-1 cursor-pointer font-normal">
            {m.nombre_completo}
          </Label>
          {!m.tiene_fecha_nacimiento && seleccionados.has(m.persona_id) && (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Checkbox
                checked={esMenorPorPersona[m.persona_id] ?? false}
                onCheckedChange={(v) => onEsMenorChange(m.persona_id, v === true)}
              />
              es menor
            </label>
          )}
        </div>
      ))}

      {visitasNuevas.map((v, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-dashed border-border px-3 py-2">
          <span className="flex-1 text-sm">
            {v.primer_nombre} {v.primer_apellido}{' '}
            <span className="text-xs text-muted-foreground">
              (visita nueva{v.es_menor ? ', menor' : ''})
            </span>
          </span>
          <Button type="button" variant="ghost" size="icon" onClick={() => onQuitarVisita(i)} aria-label="Quitar">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {mostrarFormVisita ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label className="text-xs">Nombre</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label className="text-xs">Apellido</Label>
            <Input value={apellido} onChange={(e) => setApellido(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Sexo</Label>
            <Select value={sexo} onValueChange={(v) => setSexo(v as 'M' | 'F')}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="M">Masculino</SelectItem>
                <SelectItem value="F">Femenino</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-1.5 pb-2 text-xs text-muted-foreground">
            <Checkbox checked={esMenorVisita} onCheckedChange={(v) => setEsMenorVisita(v === true)} />
            es menor
          </label>
          <Button type="button" onClick={agregar}>
            Agregar
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" className="mt-1 gap-2 self-start" onClick={() => setMostrarFormVisita(true)}>
          <Plus className="h-4 w-4" />
          Agregar visita nueva
        </Button>
      )}
    </div>
  );
}
