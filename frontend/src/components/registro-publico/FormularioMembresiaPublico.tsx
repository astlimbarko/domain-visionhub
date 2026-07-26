import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CamposMembresiaFields } from '@/components/shared/CamposMembresiaFields';
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
      <CamposMembresiaFields
        register={register}
        errors={errors}
        camposObligatorios={camposObligatorios}
        sexoActual={sexoActual}
        estadoCivilActual={estadoCivilActual}
        gradoActual={gradoActual}
        setValue={setValue}
      />

      <Button type="submit" disabled={isSubmitting} className="mt-2">
        {isSubmitting ? t('acciones.cargando') : t('registroPublico.enviar')}
      </Button>
    </form>
  );
}
