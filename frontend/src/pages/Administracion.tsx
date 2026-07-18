import { useState } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useIglesiasTodas, useUsuarios, useCrearIglesia, useInvitarUsuario } from '@/hooks/useAdmin';
import { CrearIglesiaDialog } from '@/components/admin/CrearIglesiaDialog';
import { InvitarUsuarioDialog } from '@/components/admin/InvitarUsuarioDialog';
import type { RolSistema } from '@/types/auth.types';

const NOMBRE_ROL: Record<RolSistema, string> = {
  SUPER_ADMIN: 'Super Admin',
  PASTOR: 'Pastor',
  SUPERVISOR_VISION_ACCION: 'Supervisor de Visión en Acción',
  LIDER_RED: 'Líder de Red',
  LIDER_CDP: 'Líder de Casa de Paz',
  SUBLIDER_CDP: 'Sublíder de Casa de Paz',
};

export function Administracion() {
  const [mostrarCrearIglesia, setMostrarCrearIglesia] = useState(false);
  const [mostrarInvitar, setMostrarInvitar] = useState(false);

  const { data: iglesias = [], isLoading: cargandoIglesias } = useIglesiasTodas();
  const { data: usuarios = [], isLoading: cargandoUsuarios } = useUsuarios(undefined);
  const crearIglesia = useCrearIglesia();
  const invitarUsuario = useInvitarUsuario();

  function manejarError(e: unknown, generico: string) {
    const error = e as { message?: string } | null;
    const mensaje = typeof error?.message === 'string' ? error.message : '';
    if (mensaje.includes('PIN_INCORRECTO')) {
      toast.error('El PIN es incorrecto');
    } else if (mensaje.includes('email_exists') || mensaje.includes('Ya existe una cuenta')) {
      toast.error(mensaje);
    } else {
      toast.error(mensaje || generico);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="rounded-2xl">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Iglesias</CardTitle>
          <Button size="sm" className="gap-1.5" onClick={() => setMostrarCrearIglesia(true)}>
            <Plus className="h-4 w-4" />
            Iglesia
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {cargandoIglesias && <Skeleton className="h-24 w-full" />}
          {!cargandoIglesias && iglesias.length === 0 && (
            <p className="text-sm text-muted-foreground">Todavía no hay iglesias.</p>
          )}
          {iglesias.map((i) => (
            <div key={i.id} className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
              <div>
                <p className="font-medium">{i.nombre}</p>
                <p className="text-sm text-muted-foreground">{i.ciudad}</p>
              </div>
              {!i.activo && <Badge variant="outline">Inactiva</Badge>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Usuarios</CardTitle>
          <Button size="sm" className="gap-1.5" onClick={() => setMostrarInvitar(true)}>
            <Plus className="h-4 w-4" />
            Invitar
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {cargandoUsuarios && <Skeleton className="h-24 w-full" />}
          {!cargandoUsuarios && usuarios.length === 0 && (
            <p className="text-sm text-muted-foreground">Todavía no hay usuarios.</p>
          )}
          {usuarios.map((u) => (
            <div key={u.usuario_rol_id} className="flex flex-col gap-0.5 rounded-xl border border-border px-4 py-3">
              <p className="font-medium">{u.correo}</p>
              <p className="text-sm text-muted-foreground">
                {NOMBRE_ROL[u.rol]}
                {u.iglesia_nombre && ` · ${u.iglesia_nombre}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {u.persona_nombre ? `Asociado a ${u.persona_nombre}` : 'Sin persona asociada todavía'}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <CrearIglesiaDialog
        open={mostrarCrearIglesia}
        onOpenChange={setMostrarCrearIglesia}
        creando={crearIglesia.isPending}
        onCrear={(sufijo, ciudad, pin) =>
          crearIglesia.mutate(
            { sufijo, ciudad, pin },
            {
              onSuccess: () => {
                toast.success('Iglesia creada');
                setMostrarCrearIglesia(false);
              },
              onError: (e) => manejarError(e, 'No se pudo crear la iglesia'),
            }
          )
        }
      />

      <InvitarUsuarioDialog
        open={mostrarInvitar}
        onOpenChange={setMostrarInvitar}
        iglesias={iglesias}
        invitando={invitarUsuario.isPending}
        onInvitar={(correo, rol, iglesiaId, pin) =>
          invitarUsuario.mutate(
            { correo, rol, iglesiaId, pin },
            {
              onSuccess: () => {
                toast.success(`Invitación enviada a ${correo}`);
                setMostrarInvitar(false);
              },
              onError: (e) => manejarError(e, 'No se pudo invitar al usuario'),
            }
          )
        }
      />
    </div>
  );
}
