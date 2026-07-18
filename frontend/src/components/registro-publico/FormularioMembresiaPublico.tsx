import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRegistrarPersonaViaUrl } from '@/hooks/useRegistroPublico';
import type { CamposObligatorios, DatosRegistroPublico } from '@/types/registro-publico.types';

function construirEsquema(obligatorios: CamposObligatorios) {
  return z.object({
    primer_nombre: z.string().trim().min(1),
    segundo_nombre: z.string().trim().optional(),
    primer_apellido: z.string().trim().min(1),
    segundo_apellido: z.string().trim().optional(),
    sexo: z.enum(['M', 'F']),
    fecha_nacimiento: obligatorios.fecha_nacimiento
      ? z.string().min(1)
      : z.string().optional(),
    ci: obligatorios.ci ? z.string().trim().min(1) : z.string().trim().optional(),
    correo: z.union([z.string().email(), z.literal('')]).optional(),
    estado_civil: z.enum(['SOLTERO', 'CASADO', 'VIUDO', 'DIVORCIADO']).optional(),
    ocupacion: obligatorios.ocupacion ? z.string().trim().min(1) : z.string().trim().optional(),
    grado_instruccion: obligatorios.grado_instruccion
      ? z.string().min(1)
      : z.string().optional(),
  });
}

interface Props {
  slug: string;
  camposObligatorios: CamposObligatorios;
  onExito: (resultado: { nombreCompleto: string; casaDePazNombre: string }) => void;
}

const GRADOS_INSTRUCCION = [
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

export function FormularioMembresiaPublico({ slug, camposObligatorios, onExito }: Props) {
  const { t } = useTranslation();
  const esquema = construirEsquema(camposObligatorios);
  type FormValues = z.infer<typeof esquema>;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(esquema) });

  const mutacion = useRegistrarPersonaViaUrl(slug);

  async function onSubmit(valores: FormValues) {
    const datos: DatosRegistroPublico = {
      primer_nombre: valores.primer_nombre,
      segundo_nombre: valores.segundo_nombre || undefined,
      primer_apellido: valores.primer_apellido,
      segundo_apellido: valores.segundo_apellido || undefined,
      sexo: valores.sexo,
      fecha_nacimiento: valores.fecha_nacimiento || undefined,
      ci: valores.ci || undefined,
      correo: valores.correo || undefined,
      estado_civil: valores.estado_civil as DatosRegistroPublico['estado_civil'],
      ocupacion: valores.ocupacion || undefined,
      grado_instruccion: valores.grado_instruccion as DatosRegistroPublico['grado_instruccion'],
    };

    try {
      const resultado = await mutacion.mutateAsync(datos);
      onExito({ nombreCompleto: resultado.nombre_completo, casaDePazNombre: resultado.casa_de_paz_nombre });
    } catch (e) {
      const error = e as { message?: string } | null;
      const mensaje = typeof error?.message === 'string' ? error.message : '';
      if (mensaje.includes('uq_persona_ci') || mensaje.includes('duplicate key')) {
        toast.error(t('registroPublico.errores.ciDuplicado'));
      } else {
        toast.error(t('registroPublico.errores.generico'));
      }
    }
  }

  const sexoActual = watch('sexo');
  const estadoCivilActual = watch('estado_civil');
  const gradoActual = watch('grado_instruccion');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="primer_nombre">{t('registroPublico.campos.primerNombre')} *</Label>
          <Input id="primer_nombre" {...register('primer_nombre')} />
          {errors.primer_nombre && <p className="text-sm text-destructive">Requerido</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="segundo_nombre">{t('registroPublico.campos.segundoNombre')}</Label>
          <Input id="segundo_nombre" {...register('segundo_nombre')} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="primer_apellido">{t('registroPublico.campos.primerApellido')} *</Label>
          <Input id="primer_apellido" {...register('primer_apellido')} />
          {errors.primer_apellido && <p className="text-sm text-destructive">Requerido</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="segundo_apellido">{t('registroPublico.campos.segundoApellido')}</Label>
          <Input id="segundo_apellido" {...register('segundo_apellido')} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{t('registroPublico.campos.sexo')} *</Label>
          <Select value={sexoActual ?? ''} onValueChange={(v) => setValue('sexo', v as 'M' | 'F', { shouldValidate: true })}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="M">{t('registroPublico.sexoOpciones.M')}</SelectItem>
              <SelectItem value="F">{t('registroPublico.sexoOpciones.F')}</SelectItem>
            </SelectContent>
          </Select>
          {errors.sexo && <p className="text-sm text-destructive">Requerido</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fecha_nacimiento">
            {t('registroPublico.campos.fechaNacimiento')} {camposObligatorios.fecha_nacimiento && '*'}
          </Label>
          <Input id="fecha_nacimiento" type="date" {...register('fecha_nacimiento')} />
          {errors.fecha_nacimiento && <p className="text-sm text-destructive">Requerido</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ci">
            {t('registroPublico.campos.ci')} {camposObligatorios.ci && '*'}
          </Label>
          <Input id="ci" {...register('ci')} />
          {errors.ci && <p className="text-sm text-destructive">Requerido</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="correo">{t('registroPublico.campos.correo')}</Label>
          <Input id="correo" type="email" {...register('correo')} />
          {errors.correo && <p className="text-sm text-destructive">Correo inválido</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{t('registroPublico.campos.estadoCivil')}</Label>
          <Select
            value={estadoCivilActual ?? ''}
            onValueChange={(v) => setValue('estado_civil', v as FormValues['estado_civil'])}
          >
            <SelectTrigger className="w-full">
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

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ocupacion">
            {t('registroPublico.campos.ocupacion')} {camposObligatorios.ocupacion && '*'}
          </Label>
          <Input id="ocupacion" {...register('ocupacion')} />
          {errors.ocupacion && <p className="text-sm text-destructive">Requerido</p>}
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label>
            {t('registroPublico.campos.gradoInstruccion')} {camposObligatorios.grado_instruccion && '*'}
          </Label>
          <Select
            value={gradoActual ?? ''}
            onValueChange={(v) => setValue('grado_instruccion', v as FormValues['grado_instruccion'], { shouldValidate: true })}
          >
            <SelectTrigger className="w-full">
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

      <Button type="submit" disabled={isSubmitting} className="mt-2">
        {isSubmitting ? t('acciones.cargando') : t('registroPublico.enviar')}
      </Button>
    </form>
  );
}
