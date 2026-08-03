import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAgregarMilagro, useQuitarMilagro } from '@/hooks/usePersonas';
import { MILAGRO_CATEGORIA_LABELS, type MilagroCategoria } from '@/types/persona.types';
import type { PersonaFicha } from '@/types/persona.types';

interface Props {
  personaId: string;
  milagros: PersonaFicha['milagros'];
  puedeEditar: boolean;
}

/** Registro repetible: una persona puede tener varios milagros a lo largo del tiempo. */
export function FichaMilagros({ personaId, milagros, puedeEditar }: Props) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [categoria, setCategoria] = useState<MilagroCategoria | ''>('');
  const [detalle, setDetalle] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));

  const agregar = useAgregarMilagro(personaId);
  const quitar = useQuitarMilagro(personaId);

  function limpiar() {
    setCategoria('');
    setDetalle('');
    setFecha(new Date().toISOString().slice(0, 10));
  }

  function handleAgregar() {
    if (!categoria || !detalle.trim() || !fecha) return;
    agregar.mutate(
      { categoria, detalle: detalle.trim(), fecha },
      {
        onSuccess: () => {
          toast.success('Milagro registrado.');
          limpiar();
          setMostrarForm(false);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo registrar el milagro'),
      },
    );
  }

  function handleQuitar(id: string) {
    quitar.mutate(id, {
      onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo quitar el registro'),
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {milagros.length === 0 && !mostrarForm && <p className="text-sm text-muted-foreground">Sin milagros registrados.</p>}
      {milagros.map((m) => (
        <div key={m.id} className="flex items-start gap-2 rounded-lg border border-border p-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium">
              {MILAGRO_CATEGORIA_LABELS[m.categoria]} · {new Date(`${m.fecha}T00:00:00`).toLocaleDateString('es-BO')}
            </p>
            <p className="text-xs text-muted-foreground">{m.detalle}</p>
          </div>
          {puedeEditar && (
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => handleQuitar(m.id)} aria-label="Quitar">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}

      {puedeEditar && !mostrarForm && (
        <Button type="button" variant="outline" size="sm" className="w-fit gap-1.5" onClick={() => setMostrarForm(true)}>
          <Plus className="h-4 w-4" />
          Registrar milagro
        </Button>
      )}

      {mostrarForm && (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Categoría</Label>
              <Select value={categoria} onValueChange={(v) => setCategoria(v as MilagroCategoria)}>
                <SelectTrigger>
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MILAGRO_CATEGORIA_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={fecha} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setFecha(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Qué fue exactamente lo que sucedió</Label>
            <Textarea rows={3} value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Ej. Sanó de una migraña crónica de 5 años" />
          </div>

          <div className="flex gap-2">
            <Button type="button" onClick={handleAgregar} disabled={agregar.isPending || !categoria || !detalle.trim() || !fecha}>
              Guardar
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setMostrarForm(false); limpiar(); }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
