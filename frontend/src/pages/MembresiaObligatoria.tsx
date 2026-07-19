import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cerrarSesion, obtenerPersonaActual } from '@/services/auth.service';
import { useCompletarMembresia } from '@/hooks/useInvitacionLider';
import { useAuthStore } from '@/store/auth.store';
import type { InvitacionPendiente } from '@/types/invitacion-lider.types';

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

function construirEsquema(obligatorios: InvitacionPendiente['campos_obligatorios']) {
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

const NOMBRE_ROL: Record<InvitacionPendiente['rol'], string> = {
  LIDER_RED: 'Líder de Red',
  LIDER_CDP: 'Líder de Casa de Paz',
  SUBLIDER_CDP: 'Sublíder de Casa de Paz',
};

interface Props {
  invitacion: InvitacionPendiente;
}

export function MembresiaObligatoria({ invitacion }: Props) {
  const completarMembresiaLocal = useAuthStore((s) => s.completarMembresiaLocal);
  const logout = useAuthStore((s) => s.logout);
  const esquema = construirEsquema(invitacion.campos_obligatorios);
  type FormValues = z.infer<typeof esquema>;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(esquema) });

  const mutacion = useCompletarMembresia();

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
    };

    try {
      await mutacion.mutateAsync(datos);
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

  const sexoActual = watch('sexo');
  const estadoCivilActual = watch('estado_civil');
  const gradoActual = watch('grado_instruccion');

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg rounded-2xl shadow-lg">
        <CardHeader>
          <CardTitle>Completá tu membresía</CardTitle>
          <CardDescription>
            Te invitaron como <strong>{NOMBRE_ROL[invitacion.rol]}</strong> de{' '}
            <strong>{invitacion.destino}</strong> en {invitacion.iglesia_nombre}. Antes de ver tu panel necesitamos
            estos datos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="primer_nombre">Primer nombre *</Label>
                <Input id="primer_nombre" {...register('primer_nombre')} />
                {errors.primer_nombre && <p className="text-sm text-destructive">Requerido</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="segundo_nombre">Segundo nombre</Label>
                <Input id="segundo_nombre" {...register('segundo_nombre')} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="primer_apellido">Primer apellido *</Label>
                <Input id="primer_apellido" {...register('primer_apellido')} />
                {errors.primer_apellido && <p className="text-sm text-destructive">Requerido</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="segundo_apellido">Segundo apellido</Label>
                <Input id="segundo_apellido" {...register('segundo_apellido')} />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Sexo *</Label>
                <Select value={sexoActual ?? ''} onValueChange={(v) => setValue('sexo', v as 'M' | 'F', { shouldValidate: true })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Femenino</SelectItem>
                  </SelectContent>
                </Select>
                {errors.sexo && <p className="text-sm text-destructive">Requerido</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fecha_nacimiento">
                  Fecha de nacimiento {invitacion.campos_obligatorios.fecha_nacimiento && '*'}
                </Label>
                <Input id="fecha_nacimiento" type="date" {...register('fecha_nacimiento')} />
                {errors.fecha_nacimiento && <p className="text-sm text-destructive">Requerido</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ci">CI {invitacion.campos_obligatorios.ci && '*'}</Label>
                <Input id="ci" {...register('ci')} />
                {errors.ci && <p className="text-sm text-destructive">Requerido</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="correo">Correo</Label>
                <Input id="correo" type="email" {...register('correo')} />
                {errors.correo && <p className="text-sm text-destructive">Correo inválido</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Estado civil</Label>
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
                <Label htmlFor="ocupacion">Ocupación {invitacion.campos_obligatorios.ocupacion && '*'}</Label>
                <Input id="ocupacion" {...register('ocupacion')} />
                {errors.ocupacion && <p className="text-sm text-destructive">Requerido</p>}
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label>Grado de instrucción {invitacion.campos_obligatorios.grado_instruccion && '*'}</Label>
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
              {isSubmitting ? 'Guardando...' : 'Completar membresía y continuar'}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={salir}>
              <LogOut className="h-4 w-4" />
              Salir sin completar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
