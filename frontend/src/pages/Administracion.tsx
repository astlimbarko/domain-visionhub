import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Building2, Church, Database, IdCard, MoreVertical, Network, Plus, RadioTower, ShieldCheck, UserCog, Users } from 'lucide-react';
import { rutaEstructuraOrganizacional } from '@/utils/constants';
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

interface GrupoIglesias {
  raiz: IglesiaAdmin;
  filas: { iglesia: IglesiaAdmin; nivel: number }[];
}

function agruparIglesiasJerarquicamente(iglesias: IglesiaAdmin[]): GrupoIglesias[] {
  const porId = new Map(iglesias.map((iglesia) => [iglesia.id, iglesia]));
  const hijasPorPadre = new Map<string, IglesiaAdmin[]>();
  const ordenar = (a: IglesiaAdmin, b: IglesiaAdmin) => a.nombre.localeCompare(b.nombre, 'es');

  for (const iglesia of iglesias) {
    if (!iglesia.iglesia_padre_id || !porId.has(iglesia.iglesia_padre_id)) continue;
    const hijas = hijasPorPadre.get(iglesia.iglesia_padre_id) ?? [];
    hijas.push(iglesia);
    hijasPorPadre.set(iglesia.iglesia_padre_id, hijas);
  }
  for (const hijas of hijasPorPadre.values()) hijas.sort(ordenar);

  const visitadas = new Set<string>();
  const crearGrupo = (raiz: IglesiaAdmin): GrupoIglesias => {
    const filas: GrupoIglesias['filas'] = [];
    const recorrer = (iglesia: IglesiaAdmin, nivel: number) => {
      if (visitadas.has(iglesia.id)) return;
      visitadas.add(iglesia.id);
      filas.push({ iglesia, nivel });
      for (const hija of hijasPorPadre.get(iglesia.id) ?? []) recorrer(hija, nivel + 1);
    };
    recorrer(raiz, 0);
    return { raiz, filas };
  };

  const raices = iglesias
    .filter((iglesia) => !iglesia.iglesia_padre_id || !porId.has(iglesia.iglesia_padre_id))
    .sort(ordenar);
  const grupos = raices.map(crearGrupo);

  // Defensa ante datos heredados con ciclos: ninguna iglesia desaparece de la UI.
  for (const iglesia of [...iglesias].sort(ordenar)) {
    if (!visitadas.has(iglesia.id)) grupos.push(crearGrupo(iglesia));
  }
  return grupos;
}

export function Administracion() {
  const navigate = useNavigate();
  const [mostrarCrearIglesia, setMostrarCrearIglesia] = useState(false);
  const [mostrarInvitar, setMostrarInvitar] = useState(false);
  const [iglesiaEditar, setIglesiaEditar] = useState<IglesiaAdmin | null>(null);
  const [confirmarIglesia, setConfirmarIglesia] = useState<ConfirmarIglesia | null>(null);
  const [usuarioEditar, setUsuarioEditar] = useState<UsuarioListado | null>(null);
  const [usuarioRemover, setUsuarioRemover] = useState<UsuarioListado | null>(null);

  const { data: iglesias = [], isLoading: cargandoIglesias } = useIglesiasTodas();
  const gruposIglesias = agruparIglesiasJerarquicamente(iglesias);
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
        <h1 className="text-xl font-semibold text-white">Panorama general</h1>
        <p className="text-sm text-white/50">
          Indicadores generales del sistema. Sin datos operativos de ninguna iglesia en particular.
        </p>
      </div>

      {cargandoPanorama || !panorama ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl bg-white/5" />)}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-2xl bg-white/5" />)}
          </div>
        </div>
      ) : (
        <>
          {/* KPIs minimalistas: en fila angosta (compact), sin ocupar tanto lugar. */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiMosaico compact label="Iglesias" icon={Building2} color={MARINO}>{panorama.iglesias.length}</KpiMosaico>
            <KpiMosaico compact label="Personas" icon={Users} color={AZUL}>{panorama.crecimiento.total_personas}</KpiMosaico>
            <KpiMosaico compact label="Cuentas" icon={IdCard} color={TEAL} sub={`${panorama.cuentas.nunca_inicio_sesion} nunca iniciaron sesión`}>
              {panorama.cuentas.total}
            </KpiMosaico>
            <KpiMosaico compact label="Tamaño BD" icon={Database} color={AMBAR}>{`${panorama.salud_bd.tamano_mb} MB`}</KpiMosaico>
          </div>

          {/* "Crecimiento de personas" y "Resumen por iglesia" removidos a pedido
              del owner (2026-08-03) -- no se necesitaban acá. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
              <TarjetaHeader oscuro icon={UserCog} color={TEAL} titulo="Cuentas por rol" descripcion={`${panorama.cuentas.sin_persona_vinculada} sin persona vinculada todavía.`} />
              <div className="flex flex-col gap-1.5 p-5">
                {panorama.cuentas.por_rol.map((r) => (
                  <div key={r.rol} className="flex items-center justify-between text-sm">
                    <span className="text-white/50">{NOMBRE_ROL_CORTO[r.rol]}</span>
                    <span className="font-medium text-white">{r.cantidad}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
              <TarjetaHeader
                oscuro
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
                    <span className="text-white/50">{t.tabla}</span>
                    <span className="font-medium text-white">{t.mb} MB</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
          <TarjetaHeader
            oscuro
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
            {cargandoIglesias && <Skeleton className="h-24 w-full rounded-2xl bg-white/5" />}
            {!cargandoIglesias && iglesias.length === 0 && (
              <p className="text-sm text-white/50">Todavía no hay iglesias.</p>
            )}
            {gruposIglesias.map((grupo) => (
              <div key={grupo.raiz.id} className="overflow-hidden rounded-2xl border border-white/20 bg-white/[0.02]">
                {grupo.filas.map(({ iglesia: i, nivel }, indice) => (
                  <div key={i.id} className={`flex items-stretch ${indice > 0 ? 'border-t border-white/10' : ''}`}>
                    <button
                      type="button"
                      onClick={() => navigate(rutaEstructuraOrganizacional(i.id))}
                      className="group flex min-w-0 flex-1 items-center gap-3 py-3 pr-2 text-left transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70"
                      style={{ paddingLeft: `${16 + nivel * 22}px` }}
                      aria-label={`Abrir estructura organizacional de ${i.nombre}`}
                    >
                      {nivel > 0 && (
                        <span aria-hidden="true" className="shrink-0 font-mono text-sm text-white/35">└─</span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-medium text-white">{i.nombre}</span>
                          {nivel > 0 && (
                            <span className="shrink-0 rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/50">
                              {i.tipo === 'SATELITE' ? 'Satélite' : 'Hija'}
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-sm text-white/50">{i.ciudad}</span>
                      </span>
                      {!i.activo && <Badge variant="outline" className="border-white/20 text-white/70">Inactiva</Badge>}
                      <span
                        role="img"
                        aria-label={!i.iglesia_padre_id ? 'Iglesia madre' : i.tipo === 'SATELITE' ? 'Iglesia satélite' : 'Iglesia hija'}
                        title={!i.iglesia_padre_id ? 'Iglesia madre' : i.tipo === 'SATELITE' ? 'Iglesia satélite' : 'Iglesia hija'}
                        className="shrink-0 text-white/30 transition-colors group-hover:text-white/70"
                      >
                        {!i.iglesia_padre_id ? (
                          <Church className="h-4 w-4" aria-hidden="true" />
                        ) : i.tipo === 'SATELITE' ? (
                          <RadioTower className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Building2 className="h-4 w-4" aria-hidden="true" />
                        )}
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center pr-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Acciones de ${i.nombre}`}
                            className="text-white/60 hover:bg-white/10 hover:text-white"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="border border-white/10 bg-[#0a0e1a] text-white">
                          <DropdownMenuItem onSelect={() => navigate(rutaEstructuraOrganizacional(i.id))} className="focus:bg-white/10 focus:text-white">
                            <Network className="h-4 w-4" /> Estructura organizacional
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setIglesiaEditar(i)} className="focus:bg-white/10 focus:text-white">Editar</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setConfirmarIglesia({ iglesia: i, accion: i.activo ? 'suspender' : 'reactivar' })} className="focus:bg-white/10 focus:text-white">
                            {i.activo ? 'Suspender' : 'Reactivar'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => setConfirmarIglesia({ iglesia: i, accion: 'eliminar' })}
                            className="text-destructive focus:bg-destructive/20 focus:text-destructive"
                          >
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
          <TarjetaHeader
            oscuro
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
            {cargandoUsuarios && <Skeleton className="h-24 w-full rounded-2xl bg-white/5" />}
            {!cargandoUsuarios && usuarios.length === 0 && (
              <p className="text-sm text-white/50">Todavía no hay usuarios.</p>
            )}
            {usuarios.map((u) => (
              <div key={u.usuario_rol_id} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{u.correo}</p>
                  <p className="truncate text-sm text-white/50">
                    {NOMBRE_ROL[u.rol]}
                    {u.iglesia_nombre && ` · ${u.iglesia_nombre}`}
                  </p>
                  <p className="truncate text-xs text-white/40">
                    {u.persona_nombre ? `Asociado a ${u.persona_nombre}` : 'Sin persona asociada todavía'}
                  </p>
                </div>
                {ROLES_GESTIONABLES_DESDE_ADMIN.includes(u.rol) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" className="shrink-0 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Acciones">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="border border-white/10 bg-[#0a0e1a] text-white">
                      <DropdownMenuItem onSelect={() => setUsuarioEditar(u)} className="focus:bg-white/10 focus:text-white">Editar cargo</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setUsuarioRemover(u)} className="text-destructive focus:bg-destructive/20 focus:text-destructive">
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
        oscuro
        onCrear={async (sufijo, ciudad, iglesiaPadreId, tipo, pastorUsuarioId, pastorCorreoNuevo, pin) => {
          try {
            const resultado = await crearIglesia.mutateAsync({
              sufijo, ciudad, iglesiaPadreId, tipo, pastorUsuarioId, pastorCorreoNuevo, pin,
            });
            if (resultado.error) {
              toast.warning(resultado.error);
            } else if (pastorUsuarioId || pastorCorreoNuevo) {
              toast.success('Iglesia creada y Pastor asignado');
            } else {
              toast.success('Iglesia creada');
            }
            return resultado;
          } catch (e) {
            manejarError(e, 'No se pudo crear la iglesia');
            throw e;
          }
        }}
      />

      <EditarIglesiaDialog
        open={!!iglesiaEditar}
        onOpenChange={(abierto) => !abierto && setIglesiaEditar(null)}
        iglesia={iglesiaEditar}
        guardando={actualizarIglesia.isPending}
        oscuro
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
          oscuro
          onConfirmar={confirmarAccionIglesia}
        />
      )}

      <InvitarUsuarioDialog
        open={mostrarInvitar}
        onOpenChange={setMostrarInvitar}
        iglesias={iglesias}
        invitando={invitarUsuario.isPending}
        asignando={asignarUsuarioExistente.isPending}
        oscuro
        onInvitar={(correo, rol, iglesiaId, pin) =>
          invitarUsuario.mutate(
            { correo, rol, iglesiaId, pin },
            {
              onSuccess: (resultado) => {
                if (resultado.error) {
                  toast.warning(resultado.error);
                } else {
                  toast.success(`Invitación enviada a ${correo}`);
                }
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
        oscuro
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
          oscuro
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
