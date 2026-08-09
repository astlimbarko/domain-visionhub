import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CamposMembresiaFields } from '@/components/shared/CamposMembresiaFields';
import {
  SeccionFamiliaMinisteriosMembresia,
  SeccionFormacionMembresia,
  SeccionMentorBautismoMembresia,
} from '@/components/shared/CamposMembresiaExtendidaFields';
import { FormularioPaginado, type PasoFormularioPaginado } from '@/components/shared/FormularioPaginado';
import { useRegistrarPersonaViaUrl } from '@/hooks/useRegistroPublico';
import { usePersistenciaLocal, limpiarPersistenciaLocal } from '@/hooks/usePersistenciaLocal';
import { DATOS_MEMBRESIA_EXTENDIDA_VACIO, type DatosMembresiaExtendida } from '@/types/membresia-extendida.types';
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

// KAN-124/125: formulario base (Identidad/Censo) + los grupos ampliados de
// KAN-123, organizados como wizard paginado. Progreso persistido en
// localStorage por slug (KAN-124 Q-7): es el flujo público, sin cuenta a la
// que volver, así que es el que más se beneficia de no perder lo tecleado si
// la persona cierra el navegador a mitad de formulario.
export function FormularioMembresiaPublico({ slug, camposObligatorios, onExito }: Props) {
  const { t } = useTranslation();
  const esquema = construirEsquema(camposObligatorios);
  type FormValues = z.infer<typeof esquema>;

  const storageKey = `membresia-publica:${slug}`;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(esquema) });

  const [extendido, setExtendido] = useState<DatosMembresiaExtendida>(DATOS_MEMBRESIA_EXTENDIDA_VACIO);

  usePersistenciaLocal(storageKey, { base: watch(), extendido }, (guardado) => {
    reset(guardado.base as FormValues);
    setExtendido(guardado.extendido);
  });

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
      ...extendido,
    };

    try {
      const resultado = await mutacion.mutateAsync(datos);
      limpiarPersistenciaLocal(storageKey);
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

  const pasos: PasoFormularioPaginado[] = [
    {
      id: 'identidad',
      titulo: 'Tus datos',
      validar: () =>
        trigger(['primer_nombre', 'primer_apellido', 'sexo', 'fecha_nacimiento', 'ci', 'correo', 'ocupacion', 'grado_instruccion']),
      contenido: (
        <CamposMembresiaFields
          register={register}
          errors={errors}
          camposObligatorios={camposObligatorios}
          sexoActual={sexoActual}
          estadoCivilActual={estadoCivilActual}
          gradoActual={gradoActual}
          setValue={setValue}
        />
      ),
    },
    {
      id: 'formacion',
      titulo: 'Formación',
      contenido: <SeccionFormacionMembresia value={extendido} onChange={setExtendido} />,
    },
    {
      id: 'mentor-bautismo',
      titulo: 'Mentor y Bautismo',
      contenido: <SeccionMentorBautismoMembresia value={extendido} onChange={setExtendido} />,
    },
    {
      id: 'familia',
      titulo: 'Familia',
      contenido: <SeccionFamiliaMinisteriosMembresia value={extendido} onChange={setExtendido} />,
    },
  ];

  return (
    <FormularioPaginado
      pasos={pasos}
      enviando={isSubmitting}
      textoFinalizar={t('registroPublico.enviar')}
      onFinalizar={handleSubmit(onSubmit)}
    />
  );
}
