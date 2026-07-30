/**
 * Campos del formulario de membresia, extraidos de FormularioMembresiaPublico
 * para reutilizarlos en el registro interno de Afirmacion sin duplicar el
 * formulario (14-afirmacion, Requisito 4.1). Misma UI, misma i18n
 * (registroPublico.campos.*) -- el shape de datos es identico en ambos flujos.
 */
import { useTranslation } from 'react-i18next';
import type { FieldErrors, FieldValues, UseFormRegister, UseFormSetValue } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CamposObligatorios } from '@/types/registro-publico.types';

// Estilo propio de este formulario (mas contraste que el <Input>/<SelectTrigger>
// por defecto, con un resplandor tipo "neon" al pasar el mouse/enfocar) --
// acotado a los dos formularios de membresia (publico + Afirmacion interno)
// que usan este componente compartido, NO es un cambio global del
// componente <Input>. Usa los tokens de tema (--ring) para respetar
// claro/oscuro sin colores fijos.
export const CAMPO_ESTILO =
  'h-10 border-2 border-border/70 transition-shadow duration-200 hover:border-ring/50 ' +
  'hover:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-ring)_18%,transparent)] ' +
  'focus-visible:border-ring/70 focus-visible:ring-0 ' +
  'focus-visible:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-ring)_28%,transparent)]';

export const GRADOS_INSTRUCCION = [
  'SIN_INSTRUCCION',
  'PRIMARIA_INCOMPLETA',
  'PRIMARIA_COMPLETA',
  'SECUNDARIA_INCOMPLETA',
  'SECUNDARIA_COMPLETA',
  'TECNICO_MEDIO',
  'TECNICO_SUPERIOR',
  'LICENCIATURA_INGENIERIA',
  'DIPLOMADO',
  'MAESTRIA',
  'DOCTORADO',
] as const;

// Tipos amplios a propósito (string, no la unión literal): cada formulario
// que use este componente infiere su propio FormValues desde su propio
// esquema zod (ver FormularioMembresiaPublico y RegistrarPersonaAfirmacion),
// y ambos deben ser asignables aquí sin fricción de tipos.
export interface CamposMembresiaValues extends FieldValues {
  primer_nombre: string;
  segundo_nombre?: string;
  primer_apellido: string;
  segundo_apellido?: string;
  sexo: string;
  fecha_nacimiento?: string;
  ci?: string;
  correo?: string;
  estado_civil?: string;
  ocupacion?: string;
  grado_instruccion?: string;
}

interface Props<T extends CamposMembresiaValues> {
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
  camposObligatorios: CamposObligatorios;
  sexoActual: string | undefined;
  estadoCivilActual: string | undefined;
  gradoActual: string | undefined;
  setValue: UseFormSetValue<T>;
}

export function CamposMembresiaFields<T extends CamposMembresiaValues>({
  register,
  errors,
  camposObligatorios,
  sexoActual,
  estadoCivilActual,
  gradoActual,
  setValue,
}: Props<T>) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor="primer_nombre">{t('registroPublico.campos.primerNombre')} *</Label>
        <Input id="primer_nombre" className={CAMPO_ESTILO} {...register('primer_nombre' as never)} />
        {errors.primer_nombre && <p className="text-sm text-destructive">Requerido</p>}
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="segundo_nombre">{t('registroPublico.campos.segundoNombre')}</Label>
        <Input id="segundo_nombre" className={CAMPO_ESTILO} {...register('segundo_nombre' as never)} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="primer_apellido">{t('registroPublico.campos.primerApellido')} *</Label>
        <Input id="primer_apellido" className={CAMPO_ESTILO} {...register('primer_apellido' as never)} />
        {errors.primer_apellido && <p className="text-sm text-destructive">Requerido</p>}
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="segundo_apellido">{t('registroPublico.campos.segundoApellido')}</Label>
        <Input id="segundo_apellido" className={CAMPO_ESTILO} {...register('segundo_apellido' as never)} />
      </div>

      <div className="flex flex-col gap-1">
        <Label>{t('registroPublico.campos.sexo')} *</Label>
        <Select value={sexoActual ?? ''} onValueChange={(v) => setValue('sexo' as never, v as never, { shouldValidate: true })}>
          <SelectTrigger className={cn("w-full", CAMPO_ESTILO)}>
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="M">{t('registroPublico.sexoOpciones.M')}</SelectItem>
            <SelectItem value="F">{t('registroPublico.sexoOpciones.F')}</SelectItem>
          </SelectContent>
        </Select>
        {errors.sexo && <p className="text-sm text-destructive">Requerido</p>}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="fecha_nacimiento">
          {t('registroPublico.campos.fechaNacimiento')} {camposObligatorios.fecha_nacimiento && '*'}
        </Label>
        <Input id="fecha_nacimiento" className={CAMPO_ESTILO} type="date" {...register('fecha_nacimiento' as never)} />
        {errors.fecha_nacimiento && <p className="text-sm text-destructive">Requerido</p>}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="ci">
          {t('registroPublico.campos.ci')} {camposObligatorios.ci && '*'}
        </Label>
        <Input id="ci" className={CAMPO_ESTILO} {...register('ci' as never)} />
        {errors.ci && <p className="text-sm text-destructive">Requerido</p>}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="correo">{t('registroPublico.campos.correo')}</Label>
        <Input id="correo" className={CAMPO_ESTILO} type="email" {...register('correo' as never)} />
        {errors.correo && <p className="text-sm text-destructive">Correo inválido</p>}
      </div>

      <div className="flex flex-col gap-1">
        <Label>{t('registroPublico.campos.estadoCivil')}</Label>
        <Select
          value={estadoCivilActual ?? ''}
          onValueChange={(v) => setValue('estado_civil' as never, v as never)}
        >
          <SelectTrigger className={cn("w-full", CAMPO_ESTILO)}>
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SOLTERO">Soltero/a</SelectItem>
            <SelectItem value="CASADO">Casado/a</SelectItem>
            <SelectItem value="VIUDO">Viudo/a</SelectItem>
            <SelectItem value="DIVORCIADO">Divorciado/a</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="ocupacion">
          {t('registroPublico.campos.ocupacion')} {camposObligatorios.ocupacion && '*'}
        </Label>
        <Input id="ocupacion" className={CAMPO_ESTILO} {...register('ocupacion' as never)} />
        {errors.ocupacion && <p className="text-sm text-destructive">Requerido</p>}
      </div>

      <div className="flex flex-col gap-1 sm:col-span-2">
        <Label>
          {t('registroPublico.campos.gradoInstruccion')} {camposObligatorios.grado_instruccion && '*'}
        </Label>
        <Select
          value={gradoActual ?? ''}
          onValueChange={(v) => setValue('grado_instruccion' as never, v as never, { shouldValidate: true })}
        >
          <SelectTrigger className={cn("w-full", CAMPO_ESTILO)}>
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {GRADOS_INSTRUCCION.map((g) => (
              <SelectItem key={g} value={g}>
                {g.replaceAll('_', ' ').toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.grado_instruccion && <p className="text-sm text-destructive">Requerido</p>}
      </div>
    </div>
  );
}
