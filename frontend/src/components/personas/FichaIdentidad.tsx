import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { normalizarNombre } from '@/utils/normalizarNombre';
import { useActualizarIdentidad, useGuardarDetalle } from '@/hooks/usePersonas';
import {
  DISCIPULADO_NIVEL_LABELS,
  ESTADO_CIVIL_LABELS,
  GRADO_INSTRUCCION_LABELS,
  type DiscipuladoNivel,
  type EstadoCivil,
  type GradoInstruccion,
  type PersonaFicha,
  type Sexo,
} from '@/types/persona.types';

interface Props {
  personaId: string;
  ficha: PersonaFicha;
  puedeEditar: boolean;
  /** KAN-408 (2026-09-21, pedido explícito del owner): nombre completo, sexo
   * y fecha de nacimiento quedan bloqueados incluso cuando la persona edita
   * SU PROPIA ficha desde "Mi cuenta" -- solo Supervisor/Pastor o Líder de
   * Afirmación pueden tocar estos 3 campos, desde la herramienta de edición
   * de siempre (Afirmación/CdP/Supervisión). Default = `puedeEditar` (el
   * comportamiento de siempre) para no romper ningún llamador existente. */
  puedeEditarIdentidadBasica?: boolean;
  /** KAN-403 seguimiento 2026-09-18 (pedido explícito del owner, paginado
   * para que entre en pantalla sin scroll): 1 = datos personales básicos,
   * 2 = censo eclesiástico. El form/estado es uno solo -- separar la
   * sección en 2 <FichaIdentidad> con la misma key haría perder lo tipeado
   * al pasar de página, así que esto solo cambia qué mitad de los mismos
   * campos se muestra, no remonta nada. Opcional (2026-09-21, merge
   * KAN-408): MiMembresia.tsx no está paginado -- muestra "Identidad y
   * censo" como una sola tarjeta con scroll, no como asistente de pasos --
   * así que ahí no se pasa esta prop y se omite el filtro, mostrando las 2
   * mitades juntas en la misma instancia. */
  pagina?: 1 | 2;
}

/** El botón "Guardar cambios" vive en el pie fijo de FichaPersonaSheet
 * (pedido del owner: se veía "en el medio" de la hoja) -- este handle expone
 * la acción para que el pie lo dispare sin que FichaIdentidad renderice su
 * propio botón. */
export interface FichaIdentidadHandle {
  guardar: () => Promise<void>;
}

export const FichaIdentidad = forwardRef<FichaIdentidadHandle, Props>(function FichaIdentidad(
  { personaId, ficha, puedeEditar, puedeEditarIdentidadBasica = puedeEditar, pagina },
  ref
) {
  const [form, setForm] = useState(() => construirForm(ficha));
  useEffect(() => setForm(construirForm(ficha)), [ficha]);

  const actualizarIdentidad = useActualizarIdentidad(personaId);
  const guardarDetalle = useGuardarDetalle(personaId);

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
        fecha_bautizo: form.fechaBautizo || null,
        fecha_retiro: form.fechaRetiro || null,
        discipulado_nivel: (form.discipuladoNivel || null) as DiscipuladoNivel | null,
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

  useImperativeHandle(ref, () => ({ guardar }));

  return (
    <div className="flex flex-col gap-4">
      {(pagina === undefined || pagina === 1) && (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo label="Primer nombre *">
          <Input
            className={cn(puedeEditar && CAMPO_ESTILO)}
            value={form.primerNombre}
            disabled={!puedeEditarIdentidadBasica}
            onChange={(e) => setForm((f) => ({ ...f, primerNombre: e.target.value }))}
            onBlur={(e) => setForm((f) => ({ ...f, primerNombre: normalizarNombre(e.target.value, true) }))}
          />
        </Campo>
        <Campo label="Segundo nombre">
          <Input
            className={cn(puedeEditar && CAMPO_ESTILO)}
            value={form.segundoNombre}
            disabled={!puedeEditarIdentidadBasica}
            onChange={(e) => setForm((f) => ({ ...f, segundoNombre: e.target.value }))}
            onBlur={(e) => setForm((f) => ({ ...f, segundoNombre: normalizarNombre(e.target.value) }))}
          />
        </Campo>
        <Campo label="Primer apellido *">
          <Input
            className={cn(puedeEditar && CAMPO_ESTILO)}
            value={form.primerApellido}
            disabled={!puedeEditarIdentidadBasica}
            onChange={(e) => setForm((f) => ({ ...f, primerApellido: e.target.value }))}
            onBlur={(e) => setForm((f) => ({ ...f, primerApellido: normalizarNombre(e.target.value) }))}
          />
        </Campo>
        <Campo label="Segundo apellido">
          <Input
            className={cn(puedeEditar && CAMPO_ESTILO)}
            value={form.segundoApellido}
            disabled={!puedeEditarIdentidadBasica}
            onChange={(e) => setForm((f) => ({ ...f, segundoApellido: e.target.value }))}
            onBlur={(e) => setForm((f) => ({ ...f, segundoApellido: normalizarNombre(e.target.value) }))}
          />
        </Campo>
        {/* Pares pensados por longitud de contenido, no por orden alfabético
            del censo original -- campos cortos (Sexo/CI) juntos, así no
            queda espacio vacío al lado de Sexo (pedido explícito del
            owner, KAN-403 seguimiento 2026-09-18). */}
        <Campo label="Sexo *">
          <Select value={form.sexo} onValueChange={(v) => setForm((f) => ({ ...f, sexo: v as Sexo }))} disabled={!puedeEditarIdentidadBasica}>
            <SelectTrigger className={cn('w-full', puedeEditar && CAMPO_ESTILO)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="M">Masculino</SelectItem>
              <SelectItem value="F">Femenino</SelectItem>
            </SelectContent>
          </Select>
        </Campo>
        <Campo label="Carnet de identidad">
          <Input
            className={cn(puedeEditar && CAMPO_ESTILO)}
            value={form.ci}
            disabled={!puedeEditar}
            onChange={(e) => setForm((f) => ({ ...f, ci: e.target.value }))}
          />
        </Campo>
        <Campo label="Fecha de nacimiento">
          <Input
            type="date"
            className={cn(puedeEditar && CAMPO_ESTILO)}
            value={form.fechaNacimiento}
            max={new Date().toISOString().slice(0, 10)}
            disabled={!puedeEditarIdentidadBasica}
            onChange={(e) => setForm((f) => ({ ...f, fechaNacimiento: e.target.value }))}
          />
        </Campo>
        <Campo label="Correo">
          <Input
            type="email"
            className={cn(puedeEditar && CAMPO_ESTILO)}
            value={form.correo}
            disabled={!puedeEditar}
            onChange={(e) => setForm((f) => ({ ...f, correo: e.target.value }))}
          />
        </Campo>
      </div>
      )}

      {(pagina === undefined || pagina === 2) && (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo label="Ciudad de nacimiento">
          <Input
            className={cn(puedeEditar && CAMPO_ESTILO)}
            value={form.nacimientoCiudad}
            disabled={!puedeEditar}
            onChange={(e) => setForm((f) => ({ ...f, nacimientoCiudad: e.target.value }))}
          />
        </Campo>
        <Campo label="Ocupación">
          <Input
            className={cn(puedeEditar && CAMPO_ESTILO)}
            value={form.ocupacion}
            disabled={!puedeEditar}
            onChange={(e) => setForm((f) => ({ ...f, ocupacion: e.target.value }))}
          />
        </Campo>
        <Campo label="Estado civil">
          <Select
            value={form.estadoCivil}
            onValueChange={(v) => setForm((f) => ({ ...f, estadoCivil: v as EstadoCivil }))}
            disabled={!puedeEditar}
          >
            <SelectTrigger className={cn('w-full', puedeEditar && CAMPO_ESTILO)}>
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
            <SelectTrigger className={cn('w-full', puedeEditar && CAMPO_ESTILO)}>
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
        <Campo label="Fecha de bautizo">
          <Input
            type="date"
            className={cn(puedeEditar && CAMPO_ESTILO)}
            value={form.fechaBautizo}
            max={new Date().toISOString().slice(0, 10)}
            disabled={!puedeEditar}
            onChange={(e) => setForm((f) => ({ ...f, fechaBautizo: e.target.value }))}
          />
        </Campo>
        <Campo label="Fecha de retiro">
          <Input
            type="date"
            className={cn(puedeEditar && CAMPO_ESTILO)}
            value={form.fechaRetiro}
            max={new Date().toISOString().slice(0, 10)}
            disabled={!puedeEditar}
            onChange={(e) => setForm((f) => ({ ...f, fechaRetiro: e.target.value }))}
          />
        </Campo>
        {/* Sola en su fila a propósito -- las opciones de este Select son
            las más largas de toda la sección, se ven apretadas a media
            columna. */}
        <Campo label="Nivel de discipulado completado" className="sm:col-span-2">
          <Select
            value={form.discipuladoNivel}
            onValueChange={(v) => setForm((f) => ({ ...f, discipuladoNivel: v as DiscipuladoNivel }))}
            disabled={!puedeEditar}
          >
            <SelectTrigger className={cn('w-full sm:max-w-sm', puedeEditar && CAMPO_ESTILO)}>
              <SelectValue placeholder="Sin especificar" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DISCIPULADO_NIVEL_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
      </div>
      )}

      {(pagina === undefined || pagina === 2) && form.estadoCivil === 'CASADO' && (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <Campo label="Apellido de casada">
            <div className="flex gap-2">
              <Input
                className={cn(puedeEditar && CAMPO_ESTILO)}
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
    </div>
  );
});

function Campo({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
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
    fechaBautizo: ficha.detalle?.fecha_bautizo ?? '',
    fechaRetiro: ficha.detalle?.fecha_retiro ?? '',
    discipuladoNivel: (ficha.detalle?.discipulado_nivel ?? '') as DiscipuladoNivel | '',
  };
}
