import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Star, Users, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAgregarParticipante, useMinisterios, useQuitarParticipante } from '@/hooks/useMinisterios';
import type { MinisterioDePersona } from '@/types/persona.types';

interface Props {
  personaId: string;
  iglesiaId: string;
  ministerios: MinisterioDePersona[];
  puedeEditar: boolean;
}

/**
 * KAN-5: campo "Ministerio" también editable desde la ficha de la persona
 * (antes solo se podía asignar/quitar desde la página Ministerios). Reusa el
 * mismo modelo de participación (ministerio_persona) -- no un campo nuevo
 * en `persona` -- porque una persona puede liderar/participar de varios
 * ministerios a la vez (Danza, Sonido, etc.), y ese histórico ya se conserva
 * solo (fecha_fin en vez de borrar la fila) aunque el ministerio se desactive.
 * El desplegable de asignación solo ofrece ministerios activos y ya excluye
 * los que la persona ya tiene.
 */
export function FichaMinisterios({ personaId, iglesiaId, ministerios, puedeEditar }: Props) {
  const [seleccion, setSeleccion] = useState('');
  const { data: catalogo } = useMinisterios(iglesiaId);
  const agregar = useAgregarParticipante(iglesiaId);
  const quitar = useQuitarParticipante();
  const queryClient = useQueryClient();

  function invalidarFicha() {
    queryClient.invalidateQueries({ queryKey: ['personas', 'ficha', personaId] });
  }

  const idsAsignados = new Set(ministerios.map((m) => m.ministerio_id));
  const disponibles = (catalogo ?? []).filter((m) => m.activo && !idsAsignados.has(m.id));

  function handleAsignar() {
    if (!seleccion) return;
    agregar.mutate(
      { ministerioId: seleccion, personaId },
      {
        onSuccess: () => {
          invalidarFicha();
          setSeleccion('');
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo asignar el ministerio'),
      },
    );
  }

  function handleQuitar(participanteId: string) {
    quitar.mutate(participanteId, {
      onSuccess: invalidarFicha,
      onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo quitar el ministerio'),
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {ministerios.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin Ministerio asignado.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {ministerios.map((m) => (
            <Badge key={m.ministerio_id} variant={m.es_lider ? 'default' : 'secondary'} className="gap-1.5">
              {m.es_lider ? <Star className="h-3 w-3 fill-current" /> : <Users className="h-3 w-3" />}
              {m.nombre}
              {m.es_lider && <span className="text-[10px] opacity-80">líder</span>}
              {puedeEditar && (
                <button
                  type="button"
                  aria-label={`Quitar de ${m.nombre}`}
                  className="ml-0.5 rounded-full hover:opacity-70"
                  onClick={() => handleQuitar(m.participante_id)}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {puedeEditar && disponibles.length > 0 && (
        <div className="flex items-center gap-2">
          <Select value={seleccion} onValueChange={setSeleccion}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Sin Ministerio asignado" />
            </SelectTrigger>
            <SelectContent>
              {disponibles.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" size="sm" onClick={handleAsignar} disabled={!seleccion || agregar.isPending}>
            Asignar
          </Button>
        </div>
      )}
    </div>
  );
}
