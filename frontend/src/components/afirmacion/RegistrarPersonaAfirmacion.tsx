import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
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
  SeccionMinisteriosMembresia,
  SeccionSeminarioUniversidadMembresia,
} from '@/components/shared/CamposMembresiaExtendidaFields';
import { FormularioPaginado, type PasoFormularioPaginado } from '@/components/shared/FormularioPaginado';
import { SelectorLiderCdp } from '@/components/afirmacion/SelectorLiderCdp';
import { obtenerCamposObligatoriosMembresia } from '@/services/afirmacion.service';
import { useRegistrarPersonaAfirmacion } from '@/hooks/useAfirmacion';
import { useMinisterios } from '@/hooks/useMinisterios';
import { useTiposDiscipulado } from '@/hooks/useMembresiaExtendida';
import { notificarMembresiaCompletada } from '@/services/membresia-extendida.service';
import { DATOS_MEMBRESIA_EXTENDIDA_VACIO, type DatosMembresiaExtendida } from '@/types/membresia-extendida.types';
import type { DatosPersonaAfirmacion } from '@/types/afirmacion.types';
import type { CamposObligatorios } from '@/types/registro-publico.types';

const OBLIGATORIOS_POR_DEFECTO: CamposObligatorios = {
  ci: false,
  fecha_nacimiento: false,
  ocupacion: false,
  grado_instruccion: false,
};

// KAN-230/233: ver el mismo comentario en FormularioMembresiaPublico.tsx --
// "No aplica" exime ocupación/grado de instrucción de la validación aunque
// la iglesia los pida obligatorios (ninguno de los dos se exige a nivel de
// base de datos).
function construirEsquema(obligatorios: CamposObligatorios) {
  return z
    .object({
      primer_nombre: z.string().trim().min(1),
      segundo_nombre: z.string().trim().optional(),
      primer_apellido: z.string().trim().min(1),
      segundo_apellido: z.string().trim().optional(),
      sexo: z.enum(['M', 'F']),
      fecha_nacimiento: obligatorios.fecha_nacimiento ? z.string().min(1) : z.string().optional(),
      ci: obligatorios.ci ? z.string().trim().min(1) : z.string().trim().optional(),
      correo: z.union([z.string().email(), z.literal('')]).optional(),
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
  iglesiaId: string;
}

export function RegistrarPersonaAfirmacion({ iglesiaId }: Props) {
  const [casaDePazCargoId, setCasaDePazCargoId] = useState<string>();
  const [intentoSinLider, setIntentoSinLider] = useState(false);

  const { data: obligatorios = OBLIGATORIOS_POR_DEFECTO, isLoading: cargandoConfig } = useQuery({
    queryKey: ['afirmacion', 'obligatorios-membresia', iglesiaId],
    queryFn: () => obtenerCamposObligatoriosMembresia(iglesiaId),
  });

  const esquema = construirEsquema(obligatorios);
  type FormValues = z.infer<typeof esquema>;

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
  const { data: ministerios = [] } = useMinisterios(iglesiaId);
  // KAN-231: prefetch temprano, ver mismo comentario en MembresiaObligatoria.tsx.
  useTiposDiscipulado();

  const mutacion = useRegistrarPersonaAfirmacion();

  async function onSubmit(valores: FormValues) {
    if (!casaDePazCargoId) {
      setIntentoSinLider(true);
      return;
    }

    const datos: DatosPersonaAfirmacion = {
      // KAN-123: campos ampliados, incluye Ministerios (acá sí hay iglesiaId).
      // KAN-252: va primero -- no debe poder pisar lo recién validado por
      // react-hook-form si alguna vez trajera una clave de identidad/censo
      // de arrastre. Ver el mismo fix en MembresiaObligatoria.tsx.
      ...extendido,
      primer_nombre: valores.primer_nombre,
      segundo_nombre: valores.segundo_nombre || undefined,
      primer_apellido: valores.primer_apellido,
      segundo_apellido: valores.segundo_apellido || undefined,
      sexo: valores.sexo,
      fecha_nacimiento: valores.fecha_nacimiento || undefined,
      ci: valores.ci || undefined,
      correo: valores.correo || undefined,
      estado_civil: valores.estado_civil as DatosPersonaAfirmacion['estado_civil'],
      ocupacion: valores.ocupacion_no_aplica ? undefined : valores.ocupacion || undefined,
      grado_instruccion: valores.grado_instruccion_no_aplica
        ? undefined
        : (valores.grado_instruccion as DatosPersonaAfirmacion['grado_instruccion']),
    };

    try {
      const resultado = await mutacion.mutateAsync({ datos, casaDePazCargoId });
      void notificarMembresiaCompletada(resultado.persona_id);
      toast.success(`${resultado.nombre_completo} quedó registrado en ${resultado.casa_de_paz_nombre}.`);
      reset();
      setExtendido(DATOS_MEMBRESIA_EXTENDIDA_VACIO);
      setCasaDePazCargoId(undefined);
      setIntentoSinLider(false);
    } catch (e) {
      const error = e as { message?: string; code?: string } | null;
      const mensaje = typeof error?.message === 'string' ? error.message : '';
      if (error?.code === '23505' || mensaje.includes('uq_persona_ci') || mensaje.includes('duplicate key')) {
        toast.error('Ese carnet de identidad ya está registrado.');
      } else if (mensaje.includes('AFIRMACION_LIDER_CDP_INVALIDO')) {
        toast.error('Ese líder de Casa de Paz ya no tiene un cargo vigente. Elegí otro.');
      } else if (mensaje.includes('AFIRMACION_SIN_PERMISO')) {
        toast.error('No tenés permiso para registrar personas en esta iglesia.');
      } else {
        toast.error('No se pudo completar el registro. Intentá de nuevo.');
      }
    }
  }

  const sexoActual = watch('sexo');
  const estadoCivilActual = watch('estado_civil');
  const gradoActual = watch('grado_instruccion');
  const ocupacionNoAplica = watch('ocupacion_no_aplica');
  const gradoNoAplica = watch('grado_instruccion_no_aplica');

  if (cargandoConfig) {
    return <Skeleton className="h-80 w-full rounded-2xl" />;
  }

  const pasos: PasoFormularioPaginado[] = [
    {
      id: 'identidad',
      titulo: 'Identidad y censo',
      validar: async () => {
        if (!casaDePazCargoId) {
          setIntentoSinLider(true);
          return false;
        }
        return trigger(['primer_nombre', 'primer_apellido', 'sexo', 'fecha_nacimiento', 'ci', 'correo', 'ocupacion', 'grado_instruccion']);
      },
      contenido: (
        <CamposMembresiaFields
          register={register}
          errors={errors}
          camposObligatorios={obligatorios}
          sexoActual={sexoActual}
          estadoCivilActual={estadoCivilActual}
          gradoActual={gradoActual}
          ocupacionNoAplica={ocupacionNoAplica}
          gradoNoAplica={gradoNoAplica}
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
    {
      id: 'ministerios',
      titulo: 'Ministerios',
      contenido: (
        <SeccionMinisteriosMembresia
          value={extendido}
          onChange={setExtendido}
          ministerios={ministerios.filter((m) => m.activo)}
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <SelectorLiderCdp
          iglesiaId={iglesiaId}
          value={casaDePazCargoId}
          onChange={(id) => {
            setCasaDePazCargoId(id);
            setIntentoSinLider(false);
          }}
        />
        {intentoSinLider && <p className="text-sm text-destructive">Elegí una Red y un líder de Casa de Paz antes de enviar.</p>}
      </div>

      <FormularioPaginado
        pasos={pasos}
        enviando={isSubmitting}
        textoFinalizar="Registrar persona"
        onFinalizar={handleSubmit(onSubmit)}
      />
    </div>
  );
}
