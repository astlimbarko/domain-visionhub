import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BuscadorPersona } from '@/components/casas-de-paz/BuscadorPersona';
import {
  useAgregarReferenciaFamiliar,
  useAgregarRelacionFamiliar,
  useQuitarReferenciaFamiliar,
  useQuitarRelacionFamiliar,
  useTiposRelacion,
} from '@/hooks/usePersonas';
import type { PersonaFicha } from '@/types/persona.types';

interface Props {
  personaId: string;
  iglesiaId: string;
  ficha: PersonaFicha;
  puedeEditar: boolean;
}

export function FichaFamilia({ personaId, iglesiaId, ficha, puedeEditar }: Props) {
  const { data: tipos = [] } = useTiposRelacion();

  const [familiar, setFamiliar] = useState<{ id: string; nombre_completo: string } | null>(null);
  const [tipoRelacionId, setTipoRelacionId] = useState('');
  const agregarRelacion = useAgregarRelacionFamiliar(personaId, iglesiaId);
  const quitarRelacion = useQuitarRelacionFamiliar(personaId);

  const [mostrarRef, setMostrarRef] = useState(false);
  const [nombreRef, setNombreRef] = useState('');
  const [tipoRefId, setTipoRefId] = useState('');
  const agregarReferencia = useAgregarReferenciaFamiliar(personaId, iglesiaId);
  const quitarReferencia = useQuitarReferenciaFamiliar(personaId);

  const yaRelacionados = ficha.familia.map((f) => f.familiar_id);

  function handleAgregarRelacion() {
    if (!familiar || !tipoRelacionId) return;
    agregarRelacion.mutate(
      { familiarId: familiar.id, tipoRelacionId },
      {
        onSuccess: () => {
          toast.success('Relación registrada.');
          setFamiliar(null);
          setTipoRelacionId('');
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo registrar la relación'),
      },
    );
  }

  function handleAgregarReferencia() {
    if (!nombreRef.trim() || !tipoRefId) return;
    agregarReferencia.mutate(
      { nombreFamiliar: nombreRef.trim(), tipoRelacionId: tipoRefId },
      {
        onSuccess: () => {
          toast.success('Referencia agregada.');
          setNombreRef('');
          setTipoRefId('');
          setMostrarRef(false);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo agregar la referencia'),
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground">Relaciones registradas</p>
        {ficha.familia.length === 0 && <p className="text-sm text-muted-foreground">Sin relaciones familiares registradas.</p>}
        {ficha.familia.map((f) => (
          <div key={f.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5">
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{f.familiar_nombre}</span>
              <span className="text-muted-foreground">— {f.tipo_nombre}</span>
            </div>
            {puedeEditar && (
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => quitarRelacion.mutate(f.id)}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}

        {puedeEditar && (
          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            {familiar ? (
              <div className="flex items-center justify-between rounded-md border border-border px-2 py-1.5 text-sm">
                <span>{familiar.nombre_completo}</span>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setFamiliar(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <BuscadorPersona
                iglesiaId={iglesiaId}
                onSeleccionar={setFamiliar}
                excluirIds={[personaId, ...yaRelacionados]}
              />
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={tipoRelacionId} onValueChange={setTipoRelacionId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Parentesco" />
                </SelectTrigger>
                <SelectContent>
                  {tipos.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                onClick={handleAgregarRelacion}
                disabled={!familiar || !tipoRelacionId || agregarRelacion.isPending}
              >
                Agregar
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground">Familiares no registrados en el sistema</p>
        {ficha.referencias_familiares.length === 0 && !mostrarRef && (
          <p className="text-sm text-muted-foreground">Sin referencias registradas.</p>
        )}
        {ficha.referencias_familiares.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5">
            <div className="text-sm">
              <span className="font-medium">{r.nombre_familiar}</span>
              <span className="text-muted-foreground"> — {r.tipo_nombre}</span>
            </div>
            {puedeEditar && (
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => quitarReferencia.mutate(r.id)}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}

        {puedeEditar && !mostrarRef && (
          <Button type="button" variant="outline" size="sm" className="w-fit gap-1.5" onClick={() => setMostrarRef(true)}>
            <Plus className="h-4 w-4" />
            Agregar referencia
          </Button>
        )}

        {mostrarRef && (
          <div className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1">
              <Label className="text-xs">Nombre</Label>
              <Input value={nombreRef} onChange={(e) => setNombreRef(e.target.value)} placeholder="Ej. Juan Pérez" />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <Label className="text-xs">Parentesco</Label>
              <Select value={tipoRefId} onValueChange={setTipoRefId}>
                <SelectTrigger>
                  <SelectValue placeholder="Parentesco" />
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
            <div className="flex gap-2">
              <Button type="button" onClick={handleAgregarReferencia} disabled={!nombreRef.trim() || !tipoRefId}>
                Guardar
              </Button>
              <Button type="button" variant="ghost" onClick={() => setMostrarRef(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
