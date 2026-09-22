// KAN-408 (2026-09-21): mismo grupo "Discipulados realizados" del formulario
// de 10 pasos (SeccionDiscipuladosMembresia), pero con guardado directo
// add/remove (persona_discipulado vía useAgregarDiscipulado/useQuitarDiscipulado)
// en vez de acumular en un borrador y mandarlo todo junto a
// fn_guardar_membresia_extendida -- esa RPC no dedupica y no sirve para
// ediciones repetidas de un perfil ya completo.
import { useState } from 'react';
import { toast } from 'sonner';
import { GraduationCap, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CampoFechaPrecision } from '@/components/personas/CampoFechaPrecision';
import { useAgregarDiscipulado, useQuitarDiscipulado } from '@/hooks/usePersonas';
import { useTiposDiscipulado } from '@/hooks/useMembresiaExtendida';
import type { DiscipuladoFicha, ValorFechaPrecision } from '@/types/persona.types';

interface Props {
  personaId: string;
  discipulados: DiscipuladoFicha[];
  puedeEditar: boolean;
}

const FECHA_VACIA: ValorFechaPrecision = { anio: null, mes: null, dia: null, precision_fecha: null };

function textoFecha(d: DiscipuladoFicha): string | null {
  if (!d.precision_fecha) return null;
  if (d.precision_fecha === 'SOLO_ANIO') return d.anio ? String(d.anio) : null;
  if (d.precision_fecha === 'SOLO_MES_ANIO') return d.anio && d.mes ? `${d.mes}/${d.anio}` : null;
  return d.anio && d.mes && d.dia ? `${d.dia}/${d.mes}/${d.anio}` : null;
}

export function FichaDiscipulados({ personaId, discipulados, puedeEditar }: Props) {
  const { data: tiposDiscipulado = [], isLoading } = useTiposDiscipulado();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [tipoId, setTipoId] = useState('');
  const [fecha, setFecha] = useState<ValorFechaPrecision>(FECHA_VACIA);

  const agregar = useAgregarDiscipulado(personaId);
  const quitar = useQuitarDiscipulado(personaId);

  const idsRegistrados = new Set(discipulados.map((d) => d.tipo_discipulado_id));
  const disponibles = tiposDiscipulado.filter((t) => !idsRegistrados.has(t.id));

  function handleAgregar() {
    if (!tipoId) return;
    agregar.mutate(
      { tipoDiscipuladoId: tipoId, fecha },
      {
        onSuccess: () => {
          toast.success('Discipulado registrado.');
          setTipoId('');
          setFecha(FECHA_VACIA);
          setMostrarForm(false);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo registrar el discipulado'),
      },
    );
  }

  function handleQuitar(id: string) {
    quitar.mutate(id, {
      onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo quitar el discipulado'),
    });
  }

  if (isLoading) return <Skeleton className="h-20 w-full rounded-lg" />;

  return (
    <div className="flex flex-col gap-3">
      {discipulados.length === 0 && !mostrarForm && <p className="text-sm text-muted-foreground">Sin discipulados registrados.</p>}
      {discipulados.map((d) => (
        <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5">
          <div className="flex items-center gap-2 text-sm">
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{d.tipo_discipulado_nombre}</span>
            {textoFecha(d) && <span className="text-muted-foreground">— {textoFecha(d)}</span>}
          </div>
          {puedeEditar && (
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => handleQuitar(d.id)} aria-label="Quitar">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}

      {puedeEditar && !mostrarForm && disponibles.length > 0 && (
        <Button type="button" variant="outline" size="sm" className="w-fit gap-1.5" onClick={() => setMostrarForm(true)}>
          <Plus className="h-4 w-4" />
          Agregar discipulado
        </Button>
      )}

      {mostrarForm && (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <Select value={tipoId} onValueChange={setTipoId}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Tipo de discipulado" />
            </SelectTrigger>
            <SelectContent>
              {disponibles.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <CampoFechaPrecision valor={fecha} onChange={setFecha} />
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={handleAgregar} disabled={!tipoId || agregar.isPending}>
              Guardar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setMostrarForm(false);
                setTipoId('');
                setFecha(FECHA_VACIA);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
