import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { cn } from '@/lib/utils';
import {
  SeccionCargoRangoMembresia,
  SeccionConyugeMembresia,
  SeccionDiscipuladosMembresia,
  SeccionFamiliaMinisteriosMembresia,
  SeccionMentorBautismoMembresia,
  SeccionSeminarioUniversidadMembresia,
} from '@/components/shared/CamposMembresiaExtendidaFields';
import { FormularioPaginado } from '@/components/shared/FormularioPaginado';
import { cerrarSesion, obtenerPersonaActual } from '@/services/auth.service';
import { useCompletarMembresia } from '@/hooks/useInvitacionLider';
import { useCompletarMembresiaGeneral, useGuardarPasoMembresiaGeneral, useTiposDiscipulado } from '@/hooks/useMembresiaExtendida';
import { notificarMembresiaCompletada } from '@/services/membresia-extendida.service';
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

// KAN-230/233: ver el mismo comentario en FormularioMembresiaPublico.tsx --
// "No aplica" exime ocupación/grado de instrucción de la validación aunque
// la iglesia los pida obligatorios (ninguno de los dos se exige a nivel de
// base de datos, a diferencia de ci/fecha_nacimiento).
function construirEsquema(obligatorios: MembresiaIncompleta['campos_obligatorios']) {
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
  const nombreCompleto = useAuthStore((s) => s.nombreCompleto);
  const correo = useAuthStore((s) => s.correo);
  // KAN-192: el modal saluda por nombre; si todavía no llenó su nombre
  // (persona recién creada, sin membresía completada) usa el correo con el
  // que inició sesión en su lugar.
  const nombreOCorreo = nombreCompleto?.trim() || correo || null;
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

  // KAN-231: prefetch en cuanto se abre el modal, no recién al llegar al
  // paso de Discipulados -- el catálogo tarda lo mismo, pero así el viaje
  // de red ya terminó (o va bien encaminado) mientras la persona llena los
  // primeros pasos, en vez de sentirse "lento" recién al llegar ahí.
  useTiposDiscipulado();

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
      ocupacion: valores.ocupacion_no_aplica ? undefined : valores.ocupacion || undefined,
      grado_instruccion: valores.grado_instruccion_no_aplica ? undefined : valores.grado_instruccion || undefined,
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
      if (persona?.id) void notificarMembresiaCompletada(persona.id);
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
  const ocupacionNoAplica = watch('ocupacion_no_aplica');
  const gradoNoAplica = watch('grado_instruccion_no_aplica');

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl">
            {nombreOCorreo ? `Completa tu Membresía, ${nombreOCorreo}` : 'Completa tu Membresía'}
          </DialogTitle>
          <DialogDescription>
            {esCasoGeneral ? (
              <>
                Tu cuenta tiene un rol en <strong>{invitacion.iglesia_nombre}</strong>, falta completar tu
                ficha de Membresía.
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
            Necesitamos estos datos para continuar.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <FormularioPaginado
            enviando={isSubmitting}
            textoFinalizar="Completar membresía y continuar"
            pasoInicial={esCasoGeneral ? (invitacion.paso_actual ?? 1) - 1 : 0}
            onFinalizar={handleSubmit(onSubmit)}
            notaPie={
              esCasoGeneral && (
                <p className="rounded-lg bg-[color-mix(in_oklab,var(--color-chart-1)_10%,transparent)] px-3 py-2 text-center text-xs text-foreground">
                  Se puede <strong>saltar</strong> en cualquier momento — el avance queda guardado.
                </p>
              )
            }
            accionExtra={
              esCasoGeneral ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-destructive/40 text-destructive hover:border-destructive/60 hover:bg-destructive/10 hover:text-destructive sm:w-auto"
                  onClick={saltar}
                >
                  Saltar
                </Button>
              ) : (
                <Button type="button" variant="outline" className="w-full gap-1.5 sm:w-auto" onClick={salir}>
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
                    ocupacion: valores.ocupacion_no_aplica ? undefined : valores.ocupacion || undefined,
                    ocupacion_no_aplica: valores.ocupacion_no_aplica || undefined,
                    grado_instruccion: valores.grado_instruccion_no_aplica ? undefined : valores.grado_instruccion || undefined,
                    grado_instruccion_no_aplica: valores.grado_instruccion_no_aplica || undefined,
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
                      <Label htmlFor="ocupacion">
                        Ocupación {invitacion.campos_obligatorios.ocupacion && !ocupacionNoAplica && '*'}
                      </Label>
                      <Input
                        id="ocupacion"
                        className={CAMPO_ESTILO}
                        disabled={ocupacionNoAplica}
                        placeholder={ocupacionNoAplica ? 'No aplica' : undefined}
                        {...register('ocupacion')}
                      />
                      {errors.ocupacion && <p className="text-sm text-destructive">Requerido</p>}
                      {invitacion.campos_obligatorios.ocupacion && (
                        <label className="flex items-center gap-2 pt-0.5 text-xs text-muted-foreground">
                          <Checkbox
                            checked={!!ocupacionNoAplica}
                            onCheckedChange={(v) => {
                              const marcado = v === true;
                              setValue('ocupacion_no_aplica', marcado, { shouldValidate: true });
                              if (marcado) setValue('ocupacion', '', { shouldValidate: true });
                            }}
                          />
                          No aplica
                        </label>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <Label>
                        Grado de instrucción {invitacion.campos_obligatorios.grado_instruccion && !gradoNoAplica && '*'}
                      </Label>
                      <Select
                        value={gradoActual ?? ''}
                        disabled={gradoNoAplica}
                        onValueChange={(v) => setValue('grado_instruccion', v as FormValues['grado_instruccion'], { shouldValidate: true })}
                      >
                        <SelectTrigger className={cn('w-full', CAMPO_ESTILO)}>
                          <SelectValue placeholder={gradoNoAplica ? 'No aplica' : '—'} />
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
                      {invitacion.campos_obligatorios.grado_instruccion && (
                        <label className="flex items-center gap-2 pt-0.5 text-xs text-muted-foreground">
                          <Checkbox
                            checked={!!gradoNoAplica}
                            onCheckedChange={(v) => {
                              const marcado = v === true;
                              setValue('grado_instruccion_no_aplica', marcado, { shouldValidate: true });
                              if (marcado) setValue('grado_instruccion', '', { shouldValidate: true });
                            }}
                          />
                          No aplica
                        </label>
                      )}
                    </div>
                  </div>
                ),
              },
              {
                id: 'discipulados',
                titulo: 'Discipulados',
                validar: () => guardarPasoSiCorresponde(4, extendido),
                contenido: <SeccionDiscipuladosMembresia value={extendido} onChange={setExtendido} />,
              },
              {
                id: 'seminario-universidad',
                titulo: 'Seminario y Universidad',
                validar: () => guardarPasoSiCorresponde(5, extendido),
                contenido: <SeccionSeminarioUniversidadMembresia value={extendido} onChange={setExtendido} />,
              },
              {
                id: 'mentor-bautismo',
                titulo: 'Mentor y Bautismo',
                validar: () => guardarPasoSiCorresponde(6, extendido),
                contenido: <SeccionMentorBautismoMembresia value={extendido} onChange={setExtendido} />,
              },
              {
                id: 'cargo-rango',
                titulo: 'Cargo y posición',
                validar: () => guardarPasoSiCorresponde(7, extendido),
                contenido: <SeccionCargoRangoMembresia value={extendido} onChange={setExtendido} />,
              },
              {
                id: 'conyuge',
                titulo: 'Cónyuge',
                validar: () => guardarPasoSiCorresponde(8, extendido),
                contenido: <SeccionConyugeMembresia value={extendido} onChange={setExtendido} />,
              },
              {
                id: 'familia',
                titulo: 'Familia',
                validar: () => guardarPasoSiCorresponde(9, extendido),
                contenido: <SeccionFamiliaMinisteriosMembresia value={extendido} onChange={setExtendido} />,
              },
            ]}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
