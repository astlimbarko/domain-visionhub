import { useState } from 'react';
import { toast } from 'sonner';
import { Building2, Database, IdCard, Plus, ShieldCheck, TrendingUp, UserCog, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { AZUL, AMBAR, MARINO, TEAL, KpiMosaico } from '@/components/dashboard/DashboardUI';
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
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiMosaico label="Iglesias" icon={Building2} color={MARINO}>{panorama.iglesias.length}</KpiMosaico>
            <KpiMosaico label="Personas (todo el sistema)" icon={Users} color={AZUL}>{panorama.crecimiento.total_personas}</KpiMosaico>
            <KpiMosaico label="Cuentas" icon={IdCard} color={TEAL} sub={`${panorama.cuentas.nunca_inicio_sesion} nunca iniciaron sesión`}>
              {panorama.cuentas.total}
            </KpiMosaico>
            <KpiMosaico label="Tamaño de la base" icon={Database} color={AMBAR}>{`${panorama.salud_bd.tamano_mb} MB`}</KpiMosaico>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <TarjetaHeader icon={TrendingUp} color={AZUL} titulo="Crecimiento de personas" descripcion="Nuevas personas por mes, últimos 6 meses, todas las iglesias." />
              <div className="p-5">
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
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <TarjetaHeader icon={UserCog} color={TEAL} titulo="Cuentas por rol" descripcion={`${panorama.cuentas.sin_persona_vinculada} sin persona vinculada todavía.`} />
              <div className="flex flex-col gap-1.5 p-5">
                {panorama.cuentas.por_rol.map((r) => (
                  <div key={r.rol} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{NOMBRE_ROL_CORTO[r.rol]}</span>
                    <span className="font-medium">{r.cantidad}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <TarjetaHeader icon={Building2} color={MARINO} titulo="Resumen por iglesia" descripcion="Redes, CdP y personas por iglesia." />
              <div className="flex flex-col gap-2 p-5">
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
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <TarjetaHeader
                icon={ShieldCheck}
                color={AMBAR}
                titulo="Salud de la base de datos"
                descripcion={`RLS en ${panorama.salud_bd.rls_cobertura.con_rls}/${panorama.salud_bd.rls_cobertura.total} tablas${
                  panorama.salud_bd.super_admin_con_rol_operativo > 0
                    ? ` · ⚠ ${panorama.salud_bd.super_admin_con_rol_operativo} Super Admin con rol operativo`
                    : ''
                }`}
              />
              <div className="flex flex-col gap-1.5 p-5">
                {panorama.salud_bd.tablas_mas_grandes.map((t) => (
                  <div key={t.tabla} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t.tabla}</span>
                    <span className="font-medium">{t.mb} MB</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <TarjetaHeader
            icon={Building2}
            color={MARINO}
            titulo="Iglesias"
            descripcion="Todas las iglesias registradas en el sistema."
            accion={
              <Button size="sm" className="gap-1.5" onClick={() => setMostrarCrearIglesia(true)}>
                <Plus className="h-4 w-4" />
                Iglesia
              </Button>
            }
          />
          <div className="flex flex-col gap-2 p-5">
            {cargandoIglesias && <Skeleton className="h-24 w-full rounded-2xl" />}
            {!cargandoIglesias && iglesias.length === 0 && (
              <p className="text-sm text-muted-foreground">Todavía no hay iglesias.</p>
            )}
            {iglesias.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-2 rounded-xl border border-border px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{i.nombre}</p>
                  <p className="truncate text-sm text-muted-foreground">{i.ciudad}</p>
                </div>
                {!i.activo && <Badge variant="outline" className="shrink-0">Inactiva</Badge>}
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <TarjetaHeader
            icon={Users}
            color={TEAL}
            titulo="Usuarios"
            descripcion="Cuentas con acceso al sistema."
            accion={
              <Button size="sm" className="gap-1.5" onClick={() => setMostrarInvitar(true)}>
                <Plus className="h-4 w-4" />
                Invitar
              </Button>
            }
          />
          <div className="flex flex-col gap-2 p-5">
            {cargandoUsuarios && <Skeleton className="h-24 w-full rounded-2xl" />}
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
          </div>
        </section>
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
