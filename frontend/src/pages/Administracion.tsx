import { useState } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { useIglesiasTodas, useUsuarios, useCrearIglesia, useInvitarUsuario, useDashboardSuperAdmin } from '@/hooks/useAdmin';
import { CrearIglesiaDialog } from '@/components/admin/CrearIglesiaDialog';
import { InvitarUsuarioDialog } from '@/components/admin/InvitarUsuarioDialog';
import type { RolSistema } from '@/types/auth.types';

const NOMBRE_ROL_CORTO: Record<RolSistema, string> = {
  SUPER_ADMIN: 'Super Admin',
  PASTOR: 'Pastor',
  SUPERVISOR_VISION_ACCION: 'Supervisor',
  LIDER_RED: 'Líder de Red',
  LIDER_CDP: 'Líder de CdP',
  SUBLIDER_CDP: 'Sublíder de CdP',
};

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
  const { data: panorama, isLoading: cargandoPanorama } = useDashboardSuperAdmin();
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
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Panorama general</h1>
        <p className="text-sm text-muted-foreground">
          Indicadores generales del sistema. Sin datos operativos de ninguna iglesia en particular.
        </p>
      </div>

      {cargandoPanorama || !panorama ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28 w-full lg:col-span-4" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard titulo="Iglesias" valor={panorama.iglesias.length} />
            <KpiCard titulo="Personas (todo el sistema)" valor={panorama.crecimiento.total_personas} />
            <KpiCard titulo="Cuentas" valor={panorama.cuentas.total} subtitulo={`${panorama.cuentas.nunca_inicio_sesion} nunca iniciaron sesión`} />
            <KpiCard titulo="Tamaño de la base" valor={`${panorama.salud_bd.tamano_mb} MB`} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base">Crecimiento de personas</CardTitle>
                <CardDescription>Nuevas personas por mes, últimos 6 meses, todas las iglesias.</CardDescription>
              </CardHeader>
              <CardContent>
                {panorama.crecimiento.por_mes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin altas registradas en este período.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {panorama.crecimiento.por_mes.map((m) => (
                      <div key={m.mes} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{m.mes}</span>
                        <span className="font-medium">{m.nuevas}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base">Cuentas por rol</CardTitle>
                <CardDescription>{panorama.cuentas.sin_persona_vinculada} sin persona vinculada todavía.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5">
                {panorama.cuentas.por_rol.map((r) => (
                  <div key={r.rol} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{NOMBRE_ROL_CORTO[r.rol]}</span>
                    <span className="font-medium">{r.cantidad}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base">Resumen por iglesia</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {panorama.iglesias.map((i) => (
                  <div key={i.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">
                        {i.nombre} {!i.activa && <Badge variant="outline">Inactiva</Badge>}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {i.ciudad}
                      {i.iglesia_padre && ` · hija de ${i.iglesia_padre}`} · {i.redes} red(es) · {i.cdp} CdP · {i.personas} personas
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base">Salud de la base de datos</CardTitle>
                <CardDescription>
                  RLS en {panorama.salud_bd.rls_cobertura.con_rls}/{panorama.salud_bd.rls_cobertura.total} tablas
                  {panorama.salud_bd.super_admin_con_rol_operativo > 0 &&
                    ` · ⚠ ${panorama.salud_bd.super_admin_con_rol_operativo} Super Admin con rol operativo`}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5">
                {panorama.salud_bd.tablas_mas_grandes.map((t) => (
                  <div key={t.tabla} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t.tabla}</span>
                    <span className="font-medium">{t.mb} MB</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}

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
      </div>

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
