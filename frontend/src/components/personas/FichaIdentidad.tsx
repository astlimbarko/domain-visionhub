import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useActualizarIdentidad, useGuardarDetalle } from '@/hooks/usePersonas';
import {
  ESTADO_CIVIL_LABELS,
  GRADO_INSTRUCCION_LABELS,
  type EstadoCivil,
  type GradoInstruccion,
  type PersonaFicha,
  type Sexo,
} from '@/types/persona.types';

interface Props {
  personaId: string;
  ficha: PersonaFicha;
  puedeEditar: boolean;
}

export function FichaIdentidad({ personaId, ficha, puedeEditar }: Props) {
  const [form, setForm] = useState(() => construirForm(ficha));
  useEffect(() => setForm(construirForm(ficha)), [ficha]);

  const actualizarIdentidad = useActualizarIdentidad(personaId);
  const guardarDetalle = useGuardarDetalle(personaId);
  const guardando = actualizarIdentidad.isPending || guardarDetalle.isPending;

  async function guardar() {
    // El censo va primero: si estado_civil pasa a CASADO en este mismo guardado,
    // la fila de persona_detalle tiene que existir antes de que el trigger de
    // persona valide "apellido_casada requiere estado_civil = CASADO".
    try {
      await guardarDetalle.mutateAsync({
        nacimiento_ciudad: form.nacimientoCiudad.trim() || null,
        estado_civil: (form.estadoCivil || null) as EstadoCivil | null,
        grado_instruccion: (form.gradoInstruccion || null) as GradoInstruccion | null,
        ocupacion: form.ocupacion.trim() || null,
      });
      await actualizarIdentidad.mutateAsync({
        primer_nombre: form.primerNombre.trim(),
        segundo_nombre: form.segundoNombre.trim() || null,
        primer_apellido: form.primerApellido.trim(),
        segundo_apellido: form.segundoApellido.trim() || null,
        apellido_casada: form.estadoCivil === 'CASADO' ? form.apellidoCasada.trim() || null : null,
        mostrar_apellido_casada: form.mostrarApellidoCasada,
        sexo: form.sexo as Sexo,
        fecha_nacimiento: form.fechaNacimiento || null,
        ci: form.ci.trim() || null,
        correo: form.correo.trim() || null,
      });
      toast.success('Guardado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Primer nombre *">
          <Input value={form.primerNombre} disabled={!puedeEditar} onChange={(e) => setForm((f) => ({ ...f, primerNombre: e.target.value }))} />
        </Campo>
        <Campo label="Segundo nombre">
          <Input value={form.segundoNombre} disabled={!puedeEditar} onChange={(e) => setForm((f) => ({ ...f, segundoNombre: e.target.value }))} />
        </Campo>
        <Campo label="Primer apellido *">
          <Input value={form.primerApellido} disabled={!puedeEditar} onChange={(e) => setForm((f) => ({ ...f, primerApellido: e.target.value }))} />
        </Campo>
        <Campo label="Segundo apellido">
          <Input value={form.segundoApellido} disabled={!puedeEditar} onChange={(e) => setForm((f) => ({ ...f, segundoApellido: e.target.value }))} />
        </Campo>
        <Campo label="Sexo *">
          <Select value={form.sexo} onValueChange={(v) => setForm((f) => ({ ...f, sexo: v as Sexo }))} disabled={!puedeEditar}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="M">Masculino</SelectItem>
              <SelectItem value="F">Femenino</SelectItem>
            </SelectContent>
          </Select>
        </Campo>
        <Campo label="Fecha de nacimiento">
          <Input
            type="date"
            value={form.fechaNacimiento}
            max={new Date().toISOString().slice(0, 10)}
            disabled={!puedeEditar}
            onChange={(e) => setForm((f) => ({ ...f, fechaNacimiento: e.target.value }))}
          />
        </Campo>
        <Campo label="Carnet de identidad">
          <Input value={form.ci} disabled={!puedeEditar} onChange={(e) => setForm((f) => ({ ...f, ci: e.target.value }))} />
        </Campo>
        <Campo label="Correo">
          <Input type="email" value={form.correo} disabled={!puedeEditar} onChange={(e) => setForm((f) => ({ ...f, correo: e.target.value }))} />
        </Campo>
        <Campo label="Ciudad de nacimiento">
          <Input value={form.nacimientoCiudad} disabled={!puedeEditar} onChange={(e) => setForm((f) => ({ ...f, nacimientoCiudad: e.target.value }))} />
        </Campo>
        <Campo label="Ocupación">
          <Input value={form.ocupacion} disabled={!puedeEditar} onChange={(e) => setForm((f) => ({ ...f, ocupacion: e.target.value }))} />
        </Campo>
        <Campo label="Estado civil">
          <Select
            value={form.estadoCivil}
            onValueChange={(v) => setForm((f) => ({ ...f, estadoCivil: v as EstadoCivil }))}
            disabled={!puedeEditar}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sin especificar" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ESTADO_CIVIL_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        <Campo label="Grado de instrucción">
          <Select
            value={form.gradoInstruccion}
            onValueChange={(v) => setForm((f) => ({ ...f, gradoInstruccion: v as GradoInstruccion }))}
            disabled={!puedeEditar}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sin especificar" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(GRADO_INSTRUCCION_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
      </div>

      {form.estadoCivil === 'CASADO' && (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <Campo label="Apellido de casada">
            <div className="flex gap-2">
              <Input
                value={form.apellidoCasada}
                disabled={!puedeEditar}
                onChange={(e) => setForm((f) => ({ ...f, apellidoCasada: e.target.value }))}
              />
              {puedeEditar && ficha.persona.sugerencia_apellido_casada && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForm((f) => ({ ...f, apellidoCasada: ficha.persona.sugerencia_apellido_casada ?? '' }))}
                >
                  Usar sugerencia
                </Button>
              )}
            </div>
          </Campo>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch
              checked={form.mostrarApellidoCasada}
              disabled={!puedeEditar}
              onCheckedChange={(v) => setForm((f) => ({ ...f, mostrarApellidoCasada: v }))}
            />
            Mostrar el apellido de casada en el nombre completo
          </label>
        </div>
      )}

      {puedeEditar && (
        <Button type="button" onClick={guardar} disabled={guardando || !form.primerNombre.trim() || !form.primerApellido.trim()} className="w-fit">
          {guardando ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      )}
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function construirForm(ficha: PersonaFicha) {
  return {
    primerNombre: ficha.persona.primer_nombre,
    segundoNombre: ficha.persona.segundo_nombre ?? '',
    primerApellido: ficha.persona.primer_apellido,
    segundoApellido: ficha.persona.segundo_apellido ?? '',
    apellidoCasada: ficha.persona.apellido_casada ?? '',
    mostrarApellidoCasada: ficha.persona.mostrar_apellido_casada,
    sexo: ficha.persona.sexo,
    fechaNacimiento: ficha.persona.fecha_nacimiento ?? '',
    ci: ficha.persona.ci ?? '',
    correo: ficha.persona.correo ?? '',
    nacimientoCiudad: ficha.detalle?.nacimiento_ciudad ?? '',
    ocupacion: ficha.detalle?.ocupacion ?? '',
    estadoCivil: (ficha.detalle?.estado_civil ?? '') as EstadoCivil | '',
    gradoInstruccion: (ficha.detalle?.grado_instruccion ?? '') as GradoInstruccion | '',
  };
}
