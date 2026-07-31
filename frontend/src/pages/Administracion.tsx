import { useState } from 'react';
import { toast } from 'sonner';
import { Building2, Database, IdCard, MoreVertical, Plus, ShieldCheck, TrendingUp, UserCog, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { ConfirmarCambioDialog } from '@/components/shared/ConfirmarCambioDialog';
import { AZUL, AMBAR, MARINO, TEAL, KpiMosaico } from '@/components/dashboard/DashboardUI';
import {
  useIglesiasTodas,
  useUsuarios,
  useCrearIglesia,
  useActualizarIglesia,
  useToggleIglesiaActiva,
  useEliminarIglesia,
  useInvitarUsuario,
  useAsignarUsuarioExistente,
  useActualizarUsuarioRol,
  useToggleUsuarioRol,
  useDashboardSuperAdmin,
} from '@/hooks/useAdmin';
import { CrearIglesiaDialog } from '@/components/admin/CrearIglesiaDialog';
import { EditarIglesiaDialog } from '@/components/admin/EditarIglesiaDialog';
import { InvitarUsuarioDialog } from '@/components/admin/InvitarUsuarioDialog';
import { EditarUsuarioDialog } from '@/components/admin/EditarUsuarioDialog';
import type { RolSistema } from '@/types/auth.types';
import type { IglesiaAdmin, UsuarioListado } from '@/types/admin.types';

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

// Mismo limite que InvitarUsuarioDialog (owner, 2026-07-19 -- "acotar Super
// Admin"): Lider de Red/CdP/Sublider se gestionan desde Casas de Paz, nunca
// desde aca. Se listan igual (para que el panorama sea completo) pero sin
// acciones de edicion/remocion -- fn_actualizar_usuario_rol/fn_toggle_usuario_rol
// tambien lo rechazan del lado del backend.
const ROLES_GESTIONABLES_DESDE_ADMIN: RolSistema[] = ['SUPER_ADMIN', 'PASTOR', 'SUPERVISOR_VISION_ACCION'];

interface ConfirmarIglesia {
  iglesia: IglesiaAdmin;
  accion: 'suspender' | 'reactivar' | 'eliminar';
}

export function Administracion() {
  const [mostrarCrearIglesia, setMostrarCrearIglesia] = useState(false);
  const [mostrarInvitar, setMostrarInvitar] = useState(false);
  const [iglesiaEditar, setIglesiaEditar] = useState<IglesiaAdmin | null>(null);
  const [confirmarIglesia, setConfirmarIglesia] = useState<ConfirmarIglesia | null>(null);
  const [usuarioEditar, setUsuarioEditar] = useState<UsuarioListado | null>(null);
  const [usuarioRemover, setUsuarioRemover] = useState<UsuarioListado | null>(null);

  const { data: iglesias = [], isLoading: cargandoIglesias } = useIglesiasTodas();
  const { data: usuarios = [], isLoading: cargandoUsuarios } = useUsuarios(undefined);
  const { data: panorama, isLoading: cargandoPanorama } = useDashboardSuperAdmin();
  const crearIglesia = useCrearIglesia();
  const actualizarIglesia = useActualizarIglesia();
  const toggleIglesiaActiva = useToggleIglesiaActiva();
  const eliminarIglesia = useEliminarIglesia();
  const invitarUsuario = useInvitarUsuario();
  const asignarUsuarioExistente = useAsignarUsuarioExistente();
  const actualizarUsuarioRol = useActualizarUsuarioRol();
  const toggleUsuarioRol = useToggleUsuarioRol();

  function manejarError(e: unknown, generico: string) {
    const error = e as { message?: string } | null;
    const mensaje = typeof error?.message === 'string' ? error.message : '';
    if (mensaje.includes('PIN_INCORRECTO')) {
      toast.error('El código es incorrecto o expiró');
    } else if (mensaje.includes('email_exists') || mensaje.includes('Ya existe una cuenta')) {
      toast.error(mensaje);
    } else if (mensaje.includes('ULTIMO_SUPER_ADMIN')) {
      toast.error('No se puede quitar al único Super Admin del sistema');
    } else if (mensaje.includes('ROL_AUTOMODIFICACION')) {
      toast.error('No podés modificar tu propio cargo');
    } else if (mensaje.includes('IGLESIA_CON_REDES_ACTIVAS') || mensaje.includes('IGLESIA_CON_HIJAS')) {
      toast.error('Esta iglesia tiene estructura vigente; reasignala antes de eliminar');
    } else if (mensaje.includes('USUARIO_FUERA_DE_ALCANCE')) {
      toast.error('Los cargos de Red y Casa de Paz se gestionan desde Casas de Paz');
    } else {
      toast.error(mensaje || generico);
    }
  }

  function tituloConfirmarIglesia(c: ConfirmarIglesia) {
    if (c.accion === 'eliminar') return `Eliminar ${c.iglesia.nombre}`;
    if (c.accion === 'suspender') return `Suspender ${c.iglesia.nombre}`;
    return `Reactivar ${c.iglesia.nombre}`;
  }

  function confirmarAccionIglesia(_motivo: string, pin?: string) {
    if (!confirmarIglesia) return;
    const { iglesia, accion } = confirmarIglesia;
    if (accion === 'eliminar') {
      eliminarIglesia.mutate(
        { iglesiaId: iglesia.id, pin },
        {
          onSuccess: () => { toast.success('Iglesia eliminada'); setConfirmarIglesia(null); },
          onError: (e) => manejarError(e, 'No se pudo eliminar la iglesia'),
        }
      );
    } else {
      toggleIglesiaActiva.mutate(
        { iglesiaId: iglesia.id, activa: accion === 'reactivar', pin },
        {
          onSuccess: () => { toast.success(accion === 'reactivar' ? 'Iglesia reactivada' : 'Iglesia suspendida'); setConfirmarIglesia(null); },
          onError: (e) => manejarError(e, 'No se pudo actualizar la iglesia'),
        }
      );
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
                  <p className="truncate text-sm text-muted-foreground">
                    {i.ciudad}
                    {i.iglesia_padre_id &&
                      ` · ${i.tipo === 'SATELITE' ? 'Satélite' : 'Hija'} de ${iglesias.find((p) => p.id === i.iglesia_padre_id)?.nombre ?? '—'}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!i.activo && <Badge variant="outline">Inactiva</Badge>}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="Acciones">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setIglesiaEditar(i)}>Editar</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setConfirmarIglesia({ iglesia: i, accion: i.activo ? 'suspender' : 'reactivar' })}>
                        {i.activo ? 'Suspender' : 'Reactivar'}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => setConfirmarIglesia({ iglesia: i, accion: 'eliminar' })}
                        className="text-destructive focus:text-destructive"
                      >
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
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
                Agregar
              </Button>
            }
          />
          <div className="flex flex-col gap-2 p-5">
            {cargandoUsuarios && <Skeleton className="h-24 w-full rounded-2xl" />}
            {!cargandoUsuarios && usuarios.length === 0 && (
              <p className="text-sm text-muted-foreground">Todavía no hay usuarios.</p>
            )}
            {usuarios.map((u) => (
              <div key={u.usuario_rol_id} className="flex items-center justify-between gap-2 rounded-xl border border-border px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{u.correo}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {NOMBRE_ROL[u.rol]}
                    {u.iglesia_nombre && ` · ${u.iglesia_nombre}`}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {u.persona_nombre ? `Asociado a ${u.persona_nombre}` : 'Sin persona asociada todavía'}
                  </p>
                </div>
                {ROLES_GESTIONABLES_DESDE_ADMIN.includes(u.rol) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" className="shrink-0" aria-label="Acciones">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setUsuarioEditar(u)}>Editar cargo</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setUsuarioRemover(u)} className="text-destructive focus:text-destructive">
                        Remover
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <CrearIglesiaDialog
        open={mostrarCrearIglesia}
        onOpenChange={setMostrarCrearIglesia}
        iglesias={iglesias}
        creando={crearIglesia.isPending}
        invitandoPastor={invitarUsuario.isPending}
        onCrear={async (sufijo, ciudad, iglesiaPadreId, tipo, pastorUsuarioId, pin) => {
          try {
            const resultado = await crearIglesia.mutateAsync({ sufijo, ciudad, iglesiaPadreId, tipo, pastorUsuarioId, pin });
            toast.success(pastorUsuarioId ? 'Iglesia creada y Pastor asignado' : 'Iglesia creada');
            return resultado;
          } catch (e) {
            manejarError(e, 'No se pudo crear la iglesia');
            throw e;
          }
        }}
        onInvitarPastor={async (correo, iglesiaId, pin) => {
          try {
            await invitarUsuario.mutateAsync({ correo, rol: 'PASTOR', iglesiaId, pin });
            toast.success(`Pastor invitado a ${correo}`);
          } catch (e) {
            manejarError(e, 'No se pudo invitar al Pastor');
            throw e;
          }
        }}
      />

      <EditarIglesiaDialog
        open={!!iglesiaEditar}
        onOpenChange={(abierto) => !abierto && setIglesiaEditar(null)}
        iglesia={iglesiaEditar}
        guardando={actualizarIglesia.isPending}
        onGuardar={(sufijo, ciudad, correo, pin) => {
          if (!iglesiaEditar) return;
          actualizarIglesia.mutate(
            { iglesiaId: iglesiaEditar.id, sufijo, ciudad, correo, pin },
            {
              onSuccess: () => { toast.success('Iglesia actualizada'); setIglesiaEditar(null); },
              onError: (e) => manejarError(e, 'No se pudo actualizar la iglesia'),
            }
          );
        }}
      />

      {confirmarIglesia && (
        <ConfirmarCambioDialog
          open={!!confirmarIglesia}
          onOpenChange={(abierto) => !abierto && setConfirmarIglesia(null)}
          titulo={tituloConfirmarIglesia(confirmarIglesia)}
          descripcion={
            confirmarIglesia.accion === 'eliminar'
              ? 'Deja de contarse en la operación diaria; el historial se conserva.'
              : undefined
          }
          requiereMotivo={confirmarIglesia.accion === 'eliminar'}
          procesando={eliminarIglesia.isPending || toggleIglesiaActiva.isPending}
          onConfirmar={confirmarAccionIglesia}
        />
      )}

      <InvitarUsuarioDialog
        open={mostrarInvitar}
        onOpenChange={setMostrarInvitar}
        iglesias={iglesias}
        invitando={invitarUsuario.isPending}
        asignando={asignarUsuarioExistente.isPending}
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
        onAsignarExistente={(usuarioId, rol, iglesiaId, pin) =>
          asignarUsuarioExistente.mutate(
            { usuarioId, rol, iglesiaId, pin },
            {
              onSuccess: () => {
                toast.success('Cargo asignado');
                setMostrarInvitar(false);
              },
              onError: (e) => manejarError(e, 'No se pudo asignar el cargo'),
            }
          )
        }
      />

      <EditarUsuarioDialog
        open={!!usuarioEditar}
        onOpenChange={(abierto) => !abierto && setUsuarioEditar(null)}
        usuario={usuarioEditar}
        iglesias={iglesias}
        guardando={actualizarUsuarioRol.isPending}
        onGuardar={(rol, iglesiaId, pin) => {
          if (!usuarioEditar) return;
          actualizarUsuarioRol.mutate(
            { usuarioRolId: usuarioEditar.usuario_rol_id, rol, iglesiaId, pin },
            {
              onSuccess: () => { toast.success('Cargo actualizado'); setUsuarioEditar(null); },
              onError: (e) => manejarError(e, 'No se pudo actualizar el cargo'),
            }
          );
        }}
      />

      {usuarioRemover && (
        <ConfirmarCambioDialog
          open={!!usuarioRemover}
          onOpenChange={(abierto) => !abierto && setUsuarioRemover(null)}
          titulo={`Remover a ${usuarioRemover.correo}`}
          descripcion="Pierde acceso al sistema con este cargo; el historial se conserva."
          requiereMotivo
          procesando={toggleUsuarioRol.isPending}
          onConfirmar={(_motivo, pin) =>
            toggleUsuarioRol.mutate(
              { usuarioRolId: usuarioRemover.usuario_rol_id, activo: false, pin },
              {
                onSuccess: () => { toast.success('Usuario removido'); setUsuarioRemover(null); },
                onError: (e) => manejarError(e, 'No se pudo remover al usuario'),
              }
            )
          }
        />
      )}
    </div>
  );
}
