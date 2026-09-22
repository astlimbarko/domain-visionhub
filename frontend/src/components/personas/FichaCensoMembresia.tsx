// KAN-408 (2026-09-21): grupo "Cargo y posición" del formulario de 10 pasos
// (SeccionCargoRangoMembresia), guardado directo con upsert por persona_id
// (persona_censo_membresia tiene UNIQUE (persona_id) real, no partial --
// un solo upsert alcanza, sin necesitar saber si ya existe la fila).
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGuardarCenso } from '@/hooks/usePersonas';
import { OPCIONES_EFESIO, OPCIONES_RANGO_MIEMBRO, type EfesioTipo, type RangoMiembro } from '@/types/membresia-extendida.types';
import type { CensoFicha } from '@/types/persona.types';

interface Props {
  personaId: string;
  censo: CensoFicha | null;
  puedeEditar: boolean;
}

const NINGUNO = '__ninguno__';

const CARGOS = [
  ['cargo_ministro', 'Ministro'],
  ['cargo_anciano', 'Anciano'],
  ['cargo_diacono', 'Diácono'],
  ['cargo_mentor', 'Mentor'],
  ['cargo_sub_mentor', 'Sub mentor'],
  ['cargo_lider_cdp', 'Líder de CdPz'],
  ['cargo_sublider_cdp', 'Sub líder de CdPz'],
  ['cargo_lider_ministerio', 'Líder de Ministerio'],
] as const;

const CENSO_VACIO: CensoFicha = {
  efesio_tipo: null,
  rango_miembro: null,
  cargo_ministro: false,
  cargo_anciano: false,
  cargo_diacono: false,
  cargo_mentor: false,
  cargo_sub_mentor: false,
  cargo_lider_cdp: false,
  cargo_sublider_cdp: false,
  cargo_lider_ministerio: false,
};

export function FichaCensoMembresia({ personaId, censo, puedeEditar }: Props) {
  const [valor, setValor] = useState<CensoFicha>(censo ?? CENSO_VACIO);
  const guardar = useGuardarCenso(personaId);

  const tieneCargo = CARGOS.some(([campo]) => valor[campo]);

  function handleGuardar() {
    guardar.mutate(valor, {
      onSuccess: () => toast.success('Guardado.'),
      onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo guardar'),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label>Efesio</Label>
        <p className="text-xs text-muted-foreground">Apóstol, Profeta, Pastor, Evangelista o Maestro — elegí uno, o "Ninguno".</p>
        <Select
          value={valor.efesio_tipo ?? NINGUNO}
          disabled={!puedeEditar}
          onValueChange={(v) => setValor({ ...valor, efesio_tipo: v === NINGUNO ? null : (v as EfesioTipo) })}
        >
          <SelectTrigger className="w-full sm:max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NINGUNO}>Ninguno</SelectItem>
            {OPCIONES_EFESIO.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Otros cargos</Label>
        <p className="text-xs text-muted-foreground">Marcá todos los que correspondan — no son excluyentes entre sí.</p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {CARGOS.map(([campo, etiqueta]) => (
            <label key={campo} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={valor[campo]}
                disabled={!puedeEditar}
                onCheckedChange={(v) => setValor({ ...valor, [campo]: v === true })}
              />
              {etiqueta}
            </label>
          ))}
        </div>
      </div>

      {!tieneCargo && (
        <div className="flex flex-col gap-2">
          <Label>Posición en la iglesia</Label>
          <p className="text-xs text-muted-foreground">Para quienes todavía no tienen ningún cargo o liderazgo.</p>
          <Select
            value={valor.rango_miembro ?? NINGUNO}
            disabled={!puedeEditar}
            onValueChange={(v) => setValor({ ...valor, rango_miembro: v === NINGUNO ? null : (v as RangoMiembro) })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NINGUNO}>Ninguno</SelectItem>
              {OPCIONES_RANGO_MIEMBRO.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label} — {o.descripcion}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {puedeEditar && (
        <Button type="button" size="sm" className="w-fit" onClick={handleGuardar} disabled={guardar.isPending}>
          Guardar cargo y posición
        </Button>
      )}
    </div>
  );
}
