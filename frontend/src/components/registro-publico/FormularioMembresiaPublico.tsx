import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CamposMembresiaFields } from '@/components/shared/CamposMembresiaFields';
import {
  cargoRangoRespondido,
  discipuladosRespondido,
  seminarioUniversidadRespondido,
  SeccionCargoRangoMembresia,
  SeccionConyugeMembresia,
  SeccionDiscipuladosMembresia,
  SeccionFamiliaMembresia,
  SeccionMentorBautismoMembresia,
  SeccionSeminarioUniversidadMembresia,
} from '@/components/shared/CamposMembresiaExtendidaFields';
import { FormularioPaginado, type PasoFormularioPaginado } from '@/components/shared/FormularioPaginado';
import { useTiposDiscipulado } from '@/hooks/useMembresiaExtendida';
import { useRegistrarPersonaViaUrl } from '@/hooks/useRegistroPublico';
import { usePersistenciaLocal, limpiarPersistenciaLocal } from '@/hooks/usePersistenciaLocal';
import { notificarMembresiaCompletada } from '@/services/membresia-extendida.service';
import { componerTelefono } from '@/utils/paises-telefono';
import { DATOS_MEMBRESIA_EXTENDIDA_VACIO, type DatosMembresiaExtendida } from '@/types/membresia-extendida.types';
import type { CamposObligatorios, DatosRegistroPublico } from '@/types/registro-publico.types';

// KAN-230/233: ocupación y grado de instrucción tienen un checkbox "No
// aplica" que exime la validación aunque la iglesia los pida obligatorios
// -- ninguno de los dos se exige a nivel de base de datos (a diferencia de
// ci/fecha_nacimiento), así que dejarlos vacíos es seguro. Antes, si la
// persona no tenía ese dato, el asistente quedaba trabado sin poder avanzar
// y la membresía nunca llegaba a completarse.
function construirEsquema(obligatorios: CamposObligatorios) {
  return z
    .object({
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
      telefono_pais: z.string().optional(),
      telefono_numero: z.string().optional(),
      estado_civil: z.enum(['SOLTERO', 'CASADO', 'VIUDO', 'DIVORCIADO']).optional(),
      ocupacion: z.string().trim().optional(),
      ocupacion_no_aplica: z.boolean().optional(),
      grado_instruccion: z.string().optional(),
      grado_instruccion_no_aplica: z.boolean().optional(),
    })
    .superRefine((val, ctx) => {
      if (obligatorios.ocupacion && !val.ocupacion_no_aplica && !val.ocupacion?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ocupacion'], message: 'Requerido' });
      }
      if (obligatorios.grado_instruccion && !val.grado_instruccion_no_aplica && !val.grado_instruccion) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['grado_instruccion'], message: 'Requerido' });
      }
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

  // KAN-231: prefetch temprano, ver mismo comentario en MembresiaObligatoria.tsx.
  useTiposDiscipulado();

  const { pendiente, confirmarPendiente, descartarPendiente } = usePersistenciaLocal(
    storageKey,
    { base: watch(), extendido },
    (guardado) => {
      reset(guardado.base as FormValues);
      setExtendido(guardado.extendido);
    }
  );

  const mutacion = useRegistrarPersonaViaUrl(slug);

  async function onSubmit(valores: FormValues) {
    const datos: DatosRegistroPublico = {
      // KAN-252: `...extendido` primero -- si alguna vez llegara a traer una
      // clave de identidad/censo de arrastre (ej. restaurada desde
      // localStorage), no debe poder pisar lo recién validado por
      // react-hook-form. Ver el mismo fix en MembresiaObligatoria.tsx.
      ...extendido,
      primer_nombre: valores.primer_nombre,
      segundo_nombre: valores.segundo_nombre || undefined,
      primer_apellido: valores.primer_apellido,
      segundo_apellido: valores.segundo_apellido || undefined,
      sexo: valores.sexo,
      fecha_nacimiento: valores.fecha_nacimiento || undefined,
      ci: valores.ci || undefined,
      correo: valores.correo || undefined,
      telefono: componerTelefono(valores.telefono_pais, valores.telefono_numero),
      estado_civil: valores.estado_civil as DatosRegistroPublico['estado_civil'],
      ocupacion: valores.ocupacion_no_aplica ? undefined : valores.ocupacion || undefined,
      grado_instruccion: valores.grado_instruccion_no_aplica
        ? undefined
        : (valores.grado_instruccion as DatosRegistroPublico['grado_instruccion']),
    };

    try {
      const resultado = await mutacion.mutateAsync(datos);
      limpiarPersistenciaLocal(storageKey);
      void notificarMembresiaCompletada(resultado.persona_id);
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
  const ocupacionNoAplica = watch('ocupacion_no_aplica');
  const gradoNoAplica = watch('grado_instruccion_no_aplica');
  const telefonoPaisActual = watch('telefono_pais');

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
          ocupacionNoAplica={ocupacionNoAplica}
          gradoNoAplica={gradoNoAplica}
          telefonoPaisActual={telefonoPaisActual}
          setValue={setValue}
        />
      ),
    },
    {
      id: 'discipulados',
      titulo: 'Discipulados',
      validar: () => {
        if (!discipuladosRespondido(extendido)) {
          toast.error('Elegí al menos un discipulado, o marcá "Ninguno"');
          return false;
        }
        return true;
      },
      contenido: <SeccionDiscipuladosMembresia value={extendido} onChange={setExtendido} />,
    },
    {
      id: 'seminario-universidad',
      titulo: 'Seminario y Universidad',
      validar: () => {
        if (!seminarioUniversidadRespondido(extendido)) {
          toast.error('Elegí Seminario, Universidad, o marcá "Ninguna"');
          return false;
        }
        return true;
      },
      contenido: <SeccionSeminarioUniversidadMembresia value={extendido} onChange={setExtendido} />,
    },
    {
      id: 'mentor-bautismo',
      titulo: 'Mentor y Bautismo',
      contenido: <SeccionMentorBautismoMembresia value={extendido} onChange={setExtendido} />,
    },
    {
      id: 'cargo-rango',
      titulo: 'Cargo y posición',
      validar: () => {
        if (!cargoRangoRespondido(extendido)) {
          toast.error('Elegí tu posición en la iglesia, o marcá "Ninguno"');
          return false;
        }
        return true;
      },
      contenido: <SeccionCargoRangoMembresia value={extendido} onChange={setExtendido} />,
    },
    {
      id: 'conyuge',
      titulo: 'Cónyuge',
      contenido: <SeccionConyugeMembresia value={extendido} onChange={setExtendido} />,
    },
    {
      id: 'familia',
      titulo: 'Familia',
      contenido: <SeccionFamiliaMembresia value={extendido} onChange={setExtendido} />,
    },
  ];

  if (pendiente) {
    const nombrePendiente = [pendiente.base?.primer_nombre, pendiente.base?.primer_apellido]
      .filter((v) => v && v.trim())
      .join(' ');

    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <p className="text-sm text-muted-foreground">
          {nombrePendiente
            ? t('registroPublico.borrador.mensaje', { nombre: nombrePendiente })
            : t('registroPublico.borrador.mensajeSinNombre')}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button type="button" variant="outline" onClick={descartarPendiente}>
            {t('registroPublico.borrador.descartar')}
          </Button>
          <Button type="button" onClick={confirmarPendiente}>
            {t('registroPublico.borrador.continuar')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <FormularioPaginado
      pasos={pasos}
      enviando={isSubmitting}
      textoFinalizar={t('registroPublico.enviar')}
      onFinalizar={handleSubmit(onSubmit)}
    />
  );
}
