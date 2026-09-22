// KAN-408 (2026-09-21): grupo "Mentor" del formulario de 10 pasos
// (mitad de SeccionMentorBautismoMembresia -- Bautismo ya se cubre con
// FichaIdentidad/fecha_bautizo existente, no se duplica acá), guardado
// directo update-o-insert por id conocido/null (persona_mentor).
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useGuardarMentor, useQuitarMentor } from '@/hooks/usePersonas';
import type { MentorFicha } from '@/types/persona.types';

interface Props {
  personaId: string;
  mentor: MentorFicha | null;
  puedeEditar: boolean;
}

export function FichaMentor({ personaId, mentor, puedeEditar }: Props) {
  const [marcado, setMarcado] = useState(!!mentor);
  const [nombre, setNombre] = useState(mentor?.mentor_nombre_txt ?? '');
  const [esMiembro, setEsMiembro] = useState(mentor?.mentor_es_miembro ?? false);

  const guardar = useGuardarMentor(personaId);
  const quitar = useQuitarMentor(personaId);

  function handleGuardar() {
    if (!nombre.trim()) return;
    guardar.mutate(
      { idExistente: mentor?.id ?? null, datos: { mentor_nombre_txt: nombre.trim(), mentor_es_miembro: esMiembro } },
      {
        onSuccess: () => toast.success('Guardado.'),
        onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo guardar el mentor'),
      },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-sm font-medium">
        <Checkbox
          checked={marcado}
          disabled={!puedeEditar}
          onCheckedChange={(v) => {
            const m = v === true;
            setMarcado(m);
            if (!m && mentor) {
              quitar.mutate(mentor.id, { onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo quitar') });
              setNombre('');
              setEsMiembro(false);
            }
          }}
        />
        ¿Tenés un mentor?
      </label>
      {marcado && (
        <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-2 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Nombre del mentor</Label>
            <Input value={nombre} disabled={!puedeEditar} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 pb-1.5 text-sm">
            <Checkbox checked={esMiembro} disabled={!puedeEditar} onCheckedChange={(v) => setEsMiembro(v === true)} />
            Es miembro de la iglesia
          </label>
          {puedeEditar && (
            <Button type="button" size="sm" onClick={handleGuardar} disabled={!nombre.trim() || guardar.isPending}>
              Guardar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
