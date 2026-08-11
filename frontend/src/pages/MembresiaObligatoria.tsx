import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { cn } from '@/lib/utils';
import {
  SeccionFamiliaMinisteriosMembresia,
  SeccionFormacionMembresia,
  SeccionMentorBautismoMembresia,
} from '@/components/shared/CamposMembresiaExtendidaFields';
import { FormularioPaginado } from '@/components/shared/FormularioPaginado';
import { cerrarSesion, obtenerPersonaActual } from '@/services/auth.service';
import { useCompletarMembresia } from '@/hooks/useInvitacionLider';
import { useCompletarMembresiaGeneral, useGuardarPasoMembresiaGeneral } from '@/hooks/useMembresiaExtendida';
import { useAuthStore } from '@/store/auth.store';
import { DATOS_MEMBRESIA_EXTENDIDA_VACIO, type DatosMembresiaExtendida, type MembresiaIncompleta } from '@/types/membresia-extendida.types';
import type { RolInvitable } from '@/types/invitacion-lider.types';

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

function construirEsquema(obligatorios: MembresiaIncompleta['campos_obligatorios']) {
  return z.object({
    primer_nombre: z.string().trim().min(1),
    segundo_nombre: z.string().trim().optional(),
    primer_apellido: z.string().trim().min(1),
    segundo_apellido: z.string().trim().optional(),
    sexo: z.enum(['M', 'F']),
    fecha_nacimiento: obligatorios.fecha_nacimiento ? z.string().min(1) : z.string().optional(),
    ci: obligatorios.ci ? z.string().trim().min(1) : z.string().trim().optional(),
    correo: z.union([z.string().email(), z.literal('')]).optional(),
    estado_civil: z.enum(['SOLTERO', 'CASADO', 'VIUDO', 'DIVORCIADO']).optional(),
    ocupacion: obligatorios.ocupacion ? z.string().trim().min(1) : z.string().trim().optional(),
    grado_instruccion: obligatorios.grado_instruccion ? z.string().min(1) : z.string().optional(),
  });
}

const NOMBRE_ROL: Record<RolInvitable, string> = {
  LIDER_RED: 'Líder de Red',
  LIDER_CDP: 'Líder de Casa de Paz',
  SUBLIDER_CDP: 'Sublíder de Casa de Paz',
};

function esRolInvitable(rol: string | null): rol is RolInvitable {
  return rol === 'LIDER_RED' || rol === 'LIDER_CDP' || rol === 'SUBLIDER_CDP';
}

interface Props {
  invitacion: MembresiaIncompleta;
}

export function MembresiaObligatoria({ invitacion }: Props) {
  // KAN-126: invitacion.id !== null significa que vino de invitacion_lider/
  // invitacion_departamento (caso ya existente, obligatorio, sin Saltar).
  // invitacion.id === null es el caso general (usuario_rol vigente sin
  // Persona, Q-8, ej. Pastor/Supervisor asignado directo desde Administración)
  // -- ahí sí hay botón Saltar y se usa fn_completar_membresia_general en vez
  // de fn_completar_membresia (que exige una invitacion_lider real).
  //
  // KAN-179: solo el caso general se muestra como modal SOBRE el panel del
  // rol ya cargado (PrivateLayout.tsx renderiza <AppShell> normal + este
  // modal encima) -- el caso de invitación no tiene panel detrás todavía
  // (el cargo real recién se crea al completar, no antes), así que sigue
  // siendo lo único visible, igual que antes.
  const esCasoGeneral = invitacion.id === null;

  const completarMembresiaLocal = useAuthStore((s) => s.completarMembresiaLocal);
  const saltarMembresiaLocal = useAuthStore((s) => s.saltarMembresiaLocal);
  const logout = useAuthStore((s) => s.logout);
  const esquema = construirEsquema(invitacion.campos_obligatorios);
  type FormValues = z.infer<typeof esquema>;

  const datosGuardados = invitacion.datos_guardados ?? undefined;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(esquema),
    defaultValues: datosGuardados as Partial<FormValues> | undefined,
  });

  const [extendido, setExtendido] = useState<DatosMembresiaExtendida>(
    (datosGuardados as DatosMembresiaExtendida | undefined) ?? DATOS_MEMBRESIA_EXTENDIDA_VACIO
  );

  const mutacionInvitacion = useCompletarMembresia();
  const mutacionGeneral = useCompletarMembresiaGeneral();
  const guardarPaso = useGuardarPasoMembresiaGeneral();

  // KAN-179: guardado progresivo -- se llama al hacer clic en "Siguiente" de
  // cada página (solo en el caso general). Si falla (ej. corte de red), avisa
  // y NO deja avanzar -- mejor que perder en silencio lo que se tipeó.
  async function guardarPasoSiCorresponde(paso: number, datos: DatosMembresiaExtendida | Record<string, unknown>) {
    if (!esCasoGeneral) return true;
    try {
      await guardarPaso.mutateAsync({ paso, datos: datos as Record<string, unknown> });
      return true;
    } catch {
      toast.error('No se pudo guardar esta página, revisá tu conexión e intentá de nuevo');
      return false;
    }
  }

  async function onSubmit(valores: FormValues) {
    const datos = {
      primer_nombre: valores.primer_nombre,
      segundo_nombre: valores.segundo_nombre || undefined,
      primer_apellido: valores.primer_apellido,
      segundo_apellido: valores.segundo_apellido || undefined,
      sexo: valores.sexo,
      fecha_nacimiento: valores.fecha_nacimiento || undefined,
      ci: valores.ci || undefined,
      correo: valores.correo || undefined,
      estado_civil: valores.estado_civil || undefined,
      ocupacion: valores.ocupacion || undefined,
      grado_instruccion: valores.grado_instruccion || undefined,
      // KAN-123: campos ampliados. Ministerios queda fuera acá -- ninguno de
      // los 2 caminos (invitación ni caso general) trae iglesia_id al
      // frontend (ver comentario en membresia-extendida.types.ts).
      ...extendido,
    };

    try {
      if (esCasoGeneral) {
        await mutacionGeneral.mutateAsync(datos);
      } else {
        await mutacionInvitacion.mutateAsync(datos);
      }
      const persona = await obtenerPersonaActual();
      completarMembresiaLocal(persona?.id ?? '', persona?.nombre_completo ?? '');
      toast.success('Membresía completada');
    } catch (e) {
      const error = e as { message?: string } | null;
      const mensaje = typeof error?.message === 'string' ? error.message : '';
      if (mensaje.includes('uq_persona_ci') || mensaje.includes('duplicate key')) {
        toast.error('Ya existe una persona con ese CI');
      } else {
        toast.error('No se pudo completar la membresía');
      }
    }
  }

  async function salir() {
    await cerrarSesion();
    logout();
  }

  function saltar() {
    saltarMembresiaLocal();
  }

  const sexoActual = watch('sexo');
  const estadoCivilActual = watch('estado_civil');
  const gradoActual = watch('grado_instruccion');

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl">Completá tu Membresía</DialogTitle>
          <DialogDescription>
            {esCasoGeneral ? (
              <>
                Tu cuenta ya tiene un rol en <strong>{invitacion.iglesia_nombre}</strong>, pero todavía no
                completaste tu ficha de Membresía.
              </>
            ) : invitacion.rol && esRolInvitable(invitacion.rol) ? (
              <>
                Te invitaron como <strong>{NOMBRE_ROL[invitacion.rol]}</strong>
                {invitacion.destino && (
                  <>
                    {' '}
                    de <strong>{invitacion.destino}</strong>
                  </>
                )}{' '}
                en {invitacion.iglesia_nombre}.
              </>
            ) : (
              <>
                Te invitaron como <strong>Líder de {invitacion.destino}</strong> en {invitacion.iglesia_nombre}.
              </>
            )}{' '}
            Antes de ver tu panel necesitamos estos datos.
            {esCasoGeneral && ' Podés salir cuando quieras: lo que ya completaste queda guardado y retomás justo donde dejaste.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <FormularioPaginado
            enviando={isSubmitting}
            textoFinalizar="Completar membresía y continuar"
            pasoInicial={esCasoGeneral ? (invitacion.paso_actual ?? 1) - 1 : 0}
            onFinalizar={handleSubmit(onSubmit)}
            accionExtra={
              esCasoGeneral ? (
                <Button type="button" variant="ghost" onClick={saltar}>
                  Saltar
                </Button>
              ) : (
                <Button type="button" variant="ghost" className="gap-1.5" onClick={salir}>
                  <LogOut className="h-4 w-4" />
                  Salir sin completar
                </Button>
              )
            }
            pasos={[
              {
                id: 'nombre',
                titulo: 'Tu nombre',
                validar: async () => {
                  const ok = await trigger(['primer_nombre', 'primer_apellido', 'sexo']);
                  if (!ok) return false;
                  const valores = getValues();
                  return guardarPasoSiCorresponde(1, {
                    primer_nombre: valores.primer_nombre,
                    segundo_nombre: valores.segundo_nombre || undefined,
                    primer_apellido: valores.primer_apellido,
                    segundo_apellido: valores.segundo_apellido || undefined,
                    sexo: valores.sexo,
                  });
                },
                contenido: (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="primer_nombre">Primer nombre *</Label>
                      <Input id="primer_nombre" className={CAMPO_ESTILO} {...register('primer_nombre')} />
                      {errors.primer_nombre && <p className="text-sm text-destructive">Requerido</p>}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="segundo_nombre">Segundo nombre</Label>
                      <Input id="segundo_nombre" className={CAMPO_ESTILO} {...register('segundo_nombre')} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="primer_apellido">Primer apellido *</Label>
                      <Input id="primer_apellido" className={CAMPO_ESTILO} {...register('primer_apellido')} />
                      {errors.primer_apellido && <p className="text-sm text-destructive">Requerido</p>}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="segundo_apellido">Segundo apellido</Label>
                      <Input id="segundo_apellido" className={CAMPO_ESTILO} {...register('segundo_apellido')} />
                    </div>

                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <Label>Sexo *</Label>
                      <Select value={sexoActual ?? ''} onValueChange={(v) => setValue('sexo', v as 'M' | 'F', { shouldValidate: true })}>
                        <SelectTrigger className={cn('w-full', CAMPO_ESTILO)}>
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="M">Masculino</SelectItem>
                          <SelectItem value="F">Femenino</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.sexo && <p className="text-sm text-destructive">Requerido</p>}
                    </div>
                  </div>
                ),
              },
              {
                id: 'datos-personales',
                titulo: 'Datos personales',
                validar: async () => {
                  const ok = await trigger(['fecha_nacimiento', 'ci', 'correo']);
                  if (!ok) return false;
                  const valores = getValues();
                  return guardarPasoSiCorresponde(2, {
                    fecha_nacimiento: valores.fecha_nacimiento || undefined,
                    ci: valores.ci || undefined,
                    correo: valores.correo || undefined,
                  });
                },
                contenido: (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="fecha_nacimiento">
                        Fecha de nacimiento {invitacion.campos_obligatorios.fecha_nacimiento && '*'}
                      </Label>
                      <Input id="fecha_nacimiento" type="date" className={CAMPO_ESTILO} {...register('fecha_nacimiento')} />
                      {errors.fecha_nacimiento && <p className="text-sm text-destructive">Requerido</p>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="ci">CI {invitacion.campos_obligatorios.ci && '*'}</Label>
                      <Input id="ci" className={CAMPO_ESTILO} {...register('ci')} />
                      {errors.ci && <p className="text-sm text-destructive">Requerido</p>}
                    </div>

                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <Label htmlFor="correo">Correo</Label>
                      <Input id="correo" type="email" className={CAMPO_ESTILO} {...register('correo')} />
                      {errors.correo && <p className="text-sm text-destructive">Correo inválido</p>}
                    </div>
                  </div>
                ),
              },
              {
                id: 'datos-generales',
                titulo: 'Datos generales',
                validar: async () => {
                  const ok = await trigger(['ocupacion', 'grado_instruccion']);
                  if (!ok) return false;
                  const valores = getValues();
                  return guardarPasoSiCorresponde(3, {
                    estado_civil: valores.estado_civil || undefined,
                    ocupacion: valores.ocupacion || undefined,
                    grado_instruccion: valores.grado_instruccion || undefined,
                  });
                },
                contenido: (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label>Estado civil</Label>
                      <Select
                        value={estadoCivilActual ?? ''}
                        onValueChange={(v) => setValue('estado_civil', v as FormValues['estado_civil'])}
                      >
                        <SelectTrigger className={cn('w-full', CAMPO_ESTILO)}>
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
                      <Label htmlFor="ocupacion">Ocupación {invitacion.campos_obligatorios.ocupacion && '*'}</Label>
                      <Input id="ocupacion" className={CAMPO_ESTILO} {...register('ocupacion')} />
                      {errors.ocupacion && <p className="text-sm text-destructive">Requerido</p>}
                    </div>

                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <Label>Grado de instrucción {invitacion.campos_obligatorios.grado_instruccion && '*'}</Label>
                      <Select
                        value={gradoActual ?? ''}
                        onValueChange={(v) => setValue('grado_instruccion', v as FormValues['grado_instruccion'], { shouldValidate: true })}
                      >
                        <SelectTrigger className={cn('w-full', CAMPO_ESTILO)}>
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
                ),
              },
              {
                id: 'formacion',
                titulo: 'Formación',
                validar: () => guardarPasoSiCorresponde(4, extendido),
                contenido: <SeccionFormacionMembresia value={extendido} onChange={setExtendido} />,
              },
              {
                id: 'mentor-bautismo',
                titulo: 'Mentor y Bautismo',
                validar: () => guardarPasoSiCorresponde(5, extendido),
                contenido: <SeccionMentorBautismoMembresia value={extendido} onChange={setExtendido} />,
              },
              {
                id: 'familia',
                titulo: 'Familia',
                validar: () => guardarPasoSiCorresponde(6, extendido),
                contenido: <SeccionFamiliaMinisteriosMembresia value={extendido} onChange={setExtendido} />,
              },
            ]}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
