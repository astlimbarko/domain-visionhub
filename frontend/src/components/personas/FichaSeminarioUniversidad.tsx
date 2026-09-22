// KAN-408 (2026-09-21): mismo grupo "Seminario + Universidad del Rey Jesús"
// del formulario de 10 pasos (SeccionSeminarioUniversidadMembresia), pero
// guardado directo update-o-insert por id conocido/null (persona_seminario/
// persona_universidad_rey_jesus tienen a lo sumo 1 fila viva cada una, ver
// los índices únicos parciales verificados contra la base real) en vez de
// fn_guardar_membresia_extendida (INSERT sin ON CONFLICT útil en un re-guardado).
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CampoFechaPrecision } from '@/components/personas/CampoFechaPrecision';
import { useGuardarSeminario, useGuardarUniversidad, useQuitarSeminario, useQuitarUniversidad } from '@/hooks/usePersonas';
import type { SeminarioUniversidadFicha, ValorFechaPrecision } from '@/types/persona.types';

interface Props {
  personaId: string;
  seminario: SeminarioUniversidadFicha | null;
  universidad: SeminarioUniversidadFicha | null;
  puedeEditar: boolean;
}

const FECHA_VACIA: ValorFechaPrecision = { anio: null, mes: null, dia: null, precision_fecha: null };

function aValor(f: SeminarioUniversidadFicha | null): ValorFechaPrecision {
  return f ? { anio: f.anio, mes: f.mes, dia: f.dia, precision_fecha: f.precision_fecha } : FECHA_VACIA;
}

function Bloque({
  titulo,
  registro,
  puedeEditar,
  onGuardar,
  onQuitar,
  guardando,
}: {
  titulo: string;
  registro: SeminarioUniversidadFicha | null;
  puedeEditar: boolean;
  onGuardar: (fecha: ValorFechaPrecision) => void;
  onQuitar: () => void;
  guardando: boolean;
}) {
  const [marcado, setMarcado] = useState(!!registro);
  const [fecha, setFecha] = useState<ValorFechaPrecision>(aValor(registro));

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-sm font-medium">
        <Checkbox
          checked={marcado}
          disabled={!puedeEditar}
          onCheckedChange={(v) => {
            const m = v === true;
            setMarcado(m);
            if (!m && registro) onQuitar();
          }}
        />
        {titulo}
      </label>
      {marcado && (
        <>
          <CampoFechaPrecision valor={fecha} onChange={setFecha} disabled={!puedeEditar} />
          {puedeEditar && (
            <Button type="button" size="sm" className="w-fit" onClick={() => onGuardar(fecha)} disabled={guardando}>
              Guardar fecha
            </Button>
          )}
        </>
      )}
    </div>
  );
}

export function FichaSeminarioUniversidad({ personaId, seminario, universidad, puedeEditar }: Props) {
  const guardarSeminario = useGuardarSeminario(personaId);
  const guardarUniversidad = useGuardarUniversidad(personaId);
  const quitarSeminario = useQuitarSeminario(personaId);
  const quitarUniversidad = useQuitarUniversidad(personaId);

  return (
    <div className="flex flex-col gap-4">
      <Bloque
        titulo="¿Está o estuvo en el Seminario?"
        registro={seminario}
        puedeEditar={puedeEditar}
        guardando={guardarSeminario.isPending}
        onQuitar={() => seminario && quitarSeminario.mutate(seminario.id, { onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo quitar') })}
        onGuardar={(fecha) =>
          guardarSeminario.mutate(
            { idExistente: seminario?.id ?? null, fecha },
            { onSuccess: () => toast.success('Guardado.'), onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo guardar') },
          )
        }
      />
      <Bloque
        titulo="¿Cursó la Universidad del Rey Jesús?"
        registro={universidad}
        puedeEditar={puedeEditar}
        guardando={guardarUniversidad.isPending}
        onQuitar={() => universidad && quitarUniversidad.mutate(universidad.id, { onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo quitar') })}
        onGuardar={(fecha) =>
          guardarUniversidad.mutate(
            { idExistente: universidad?.id ?? null, fecha },
            { onSuccess: () => toast.success('Guardado.'), onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo guardar') },
          )
        }
      />
    </div>
  );
}
