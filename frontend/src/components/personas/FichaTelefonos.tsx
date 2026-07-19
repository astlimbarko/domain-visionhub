import { useState } from 'react';
import { toast } from 'sonner';
import { Phone, Plus, Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAgregarTelefono, useMarcarTelefonoPrincipal, useQuitarTelefono, useTiposTelefono } from '@/hooks/usePersonas';
import type { PersonaFicha } from '@/types/persona.types';

interface Props {
  personaId: string;
  iglesiaId: string;
  telefonos: PersonaFicha['telefonos'];
  puedeEditar: boolean;
}

export function FichaTelefonos({ personaId, iglesiaId, telefonos, puedeEditar }: Props) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [tipoId, setTipoId] = useState('');
  const [numero, setNumero] = useState('');

  const { data: tipos = [] } = useTiposTelefono();
  const agregar = useAgregarTelefono(personaId, iglesiaId);
  const marcarPrincipal = useMarcarTelefonoPrincipal(personaId);
  const quitar = useQuitarTelefono(personaId);

  const activos = telefonos.filter((t) => t.activo);

  function handleAgregar() {
    if (!tipoId || !numero.trim()) return;
    agregar.mutate(
      { tipoTelefonoId: tipoId, numero: numero.trim(), observaciones: null, esPrincipal: activos.length === 0 },
      {
        onSuccess: () => {
          toast.success('Teléfono agregado.');
          setNumero('');
          setTipoId('');
          setMostrarForm(false);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo agregar el teléfono'),
      },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {activos.length === 0 && !mostrarForm && <p className="text-sm text-muted-foreground">Sin teléfonos registrados.</p>}
      {activos.map((t) => (
        <div key={t.asignacion_id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium">
                {t.numero}
                {t.es_principal && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
              </p>
              <p className="text-xs text-muted-foreground">{t.tipo_nombre}</p>
            </div>
          </div>
          {puedeEditar && (
            <div className="flex shrink-0 gap-1">
              {!t.es_principal && (
                <Button type="button" variant="ghost" size="sm" onClick={() => marcarPrincipal.mutate(t.asignacion_id)}>
                  Marcar principal
                </Button>
              )}
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => quitar.mutate(t.asignacion_id)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      ))}

      {puedeEditar && !mostrarForm && (
        <Button type="button" variant="outline" size="sm" className="w-fit gap-1.5" onClick={() => setMostrarForm(true)}>
          <Plus className="h-4 w-4" />
          Agregar teléfono
        </Button>
      )}

      {mostrarForm && (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1">
            <Label className="text-xs">Tipo</Label>
            <Select value={tipoId} onValueChange={setTipoId}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                {tipos.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <Label className="text-xs">Número</Label>
            <Input value={numero} onChange={(e) => setNumero(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={handleAgregar} disabled={agregar.isPending || !tipoId || !numero.trim()}>
              Guardar
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMostrarForm(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
