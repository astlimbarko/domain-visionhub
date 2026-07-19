import { useState } from 'react';
import { toast } from 'sonner';
import { MapPin, Plus, Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAgregarDireccion, useMarcarDireccionPrincipal, useQuitarDireccion } from '@/hooks/usePersonas';
import type { PersonaFicha } from '@/types/persona.types';

interface Props {
  personaId: string;
  iglesiaId: string;
  direcciones: PersonaFicha['direcciones'];
  puedeEditar: boolean;
}

const VACIO = { ciudad: '', zona: '', anillo: '', calle: '', numero: '', referencia: '', urlGps: '', observaciones: '' };

export function FichaDirecciones({ personaId, iglesiaId, direcciones, puedeEditar }: Props) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(VACIO);

  const agregar = useAgregarDireccion(personaId, iglesiaId);
  const marcarPrincipal = useMarcarDireccionPrincipal(personaId);
  const quitar = useQuitarDireccion(personaId);

  const activas = direcciones.filter((d) => d.activo);

  function handleAgregar() {
    agregar.mutate(
      {
        datos: {
          ciudad: form.ciudad.trim() || null,
          zona: form.zona.trim() || null,
          anillo: form.anillo.trim() || null,
          calle: form.calle.trim() || null,
          numero: form.numero.trim() || null,
          referencia: form.referencia.trim() || null,
          url_gps: form.urlGps.trim() || null,
          observaciones: form.observaciones.trim() || null,
        },
        esPrincipal: activas.length === 0,
      },
      {
        onSuccess: () => {
          toast.success('Dirección agregada.');
          setForm(VACIO);
          setMostrarForm(false);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo agregar la dirección'),
      },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {activas.length === 0 && !mostrarForm && <p className="text-sm text-muted-foreground">Sin direcciones registradas.</p>}
      {activas.map((d) => (
        <div key={d.asignacion_id} className="flex items-start justify-between gap-2 rounded-lg border border-border p-3">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="text-sm">
              <p className="flex items-center gap-1.5 font-medium">
                {[d.calle, d.numero].filter(Boolean).join(' ') || 'Sin calle'}
                {d.es_principal && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
              </p>
              <p className="text-xs text-muted-foreground">
                {[d.zona, d.anillo && `anillo ${d.anillo}`, d.ciudad].filter(Boolean).join(', ')}
              </p>
              {d.referencia && <p className="text-xs text-muted-foreground">Ref: {d.referencia}</p>}
            </div>
          </div>
          {puedeEditar && (
            <div className="flex shrink-0 gap-1">
              {!d.es_principal && (
                <Button type="button" variant="ghost" size="sm" onClick={() => marcarPrincipal.mutate(d.asignacion_id)}>
                  Marcar principal
                </Button>
              )}
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => quitar.mutate(d.asignacion_id)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      ))}

      {puedeEditar && !mostrarForm && (
        <Button type="button" variant="outline" size="sm" className="w-fit gap-1.5" onClick={() => setMostrarForm(true)}>
          <Plus className="h-4 w-4" />
          Agregar dirección
        </Button>
      )}

      {mostrarForm && (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <div className="grid grid-cols-2 gap-2">
            <Campo label="Ciudad">
              <Input value={form.ciudad} onChange={(e) => setForm((f) => ({ ...f, ciudad: e.target.value }))} />
            </Campo>
            <Campo label="Zona">
              <Input value={form.zona} onChange={(e) => setForm((f) => ({ ...f, zona: e.target.value }))} />
            </Campo>
            <Campo label="Anillo">
              <Input value={form.anillo} onChange={(e) => setForm((f) => ({ ...f, anillo: e.target.value }))} placeholder="Ej. 4to" />
            </Campo>
            <Campo label="Calle">
              <Input value={form.calle} onChange={(e) => setForm((f) => ({ ...f, calle: e.target.value }))} />
            </Campo>
            <Campo label="Número">
              <Input value={form.numero} onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))} />
            </Campo>
            <Campo label="URL de mapa">
              <Input value={form.urlGps} onChange={(e) => setForm((f) => ({ ...f, urlGps: e.target.value }))} />
            </Campo>
          </div>
          <Campo label="Referencia">
            <Textarea rows={2} value={form.referencia} onChange={(e) => setForm((f) => ({ ...f, referencia: e.target.value }))} />
          </Campo>
          <div className="flex gap-2">
            <Button type="button" onClick={handleAgregar} disabled={agregar.isPending}>
              {agregar.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setMostrarForm(false); setForm(VACIO); }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
