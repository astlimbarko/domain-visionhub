import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MapPin, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { AsignarCargoDialog } from '@/components/casas-de-paz/AsignarCargoDialog';
import { DomicilioAnfitrionDialog } from '@/components/casas-de-paz/DomicilioAnfitrionDialog';
import { ConfirmarQuitarDialog } from '@/components/shared/ConfirmarQuitarDialog';
import { useCancelarInvitacionLider, useInvitacionesLider, useInvitarLider, useReenviarInvitacionLider } from '@/hooks/useInvitacionLider';
import {
  useAsignarCargoCdp,
  useCargoVigenteCdp,
  useCargos,
  useDomicilioCdp,
  useQuitarCargoCdp,
} from '@/hooks/useCasasDePaz';
import { useEliminarCasaDePazEstructura, useReactivarCasaDePazEstructura } from './useEstructuraOrganizacional';
import { notificarAsignacionCargoCdp } from './estructura.service';
import { textoLegibleSobre } from './contraste';
import type { CargoCdpCodigo, PersonaBusqueda } from '@/types/casas-de-paz.types';
import type { CasaDePazEstructura } from './types';

/** Color de respaldo cuando la Red de la CdP no tiene un color propio configurado (sigue en '#FFFFFF' o no se pudo resolver). */
const COLOR_BANNER_POR_DEFECTO = '#64748b';

/**
 * Reusa el mismo flujo ya construido en GestionEstructuraVista.tsx
 * (fn_asignar_cargo_cdp / casa_de_paz_cargo, AsignarCargoDialog) y el
 * domicilio del anfitrión (DomicilioAnfitrionDialog) en vez de duplicar la
 * lógica de asignación dentro del organigrama. Sublíderes (SUBLIDER_CDP):
 * queda para el siguiente ítem de la lista.
 */
interface Props {
  iglesiaId: string;
  casaDePaz: CasaDePazEstructura;
  /** Color real de la Red a la que pertenece esta Casa de Paz (la CdP no tiene
   * color propio en la base de datos -- hereda el de su Red, mismo criterio
   * que ya usa el lienzo en layout.ts/NodoEstructura para las tarjetas y
   * líneas conectoras). `null`/`undefined`/blanco cae al gris neutro. */
  colorRed?: string | null;
  abrirAnadirSubliderAlAbrir?: boolean;
  otpRequerido: boolean;
  /** KAN-190: solo Super Admin puede eliminar por completo (pedido
   * explícito del owner, 2026-08-13 -- antes también podía Supervisor de la
   * Visión en Acción). El backend (fn_estructura_eliminar_casa_de_paz)
   * ya exige además que no tenga datos reales (sin miembros ni
   * reportes/reuniones registradas; líder/sublíder/anfitrión sí puede
   * tener, eso ya no bloquea -- KAN-189). */
  puedeEliminarPorCompleto: boolean;
  onClose: () => void;
}

interface DialogoCargo {
  codigo: CargoCdpCodigo;
  titulo: string;
  exclusivo: boolean;
}

function manejarErrorCargo(e: unknown, generico: string) {
  const mensaje = e instanceof Error ? e.message : '';
  toast.error(mensaje || generico);
}

export function PanelCasaDePazEstructura({ iglesiaId, casaDePaz, colorRed, abrirAnadirSubliderAlAbrir, otpRequerido, puedeEliminarPorCompleto, onClose }: Props) {
  const queryClient = useQueryClient();
  // KAN-95: banner superior pintado con el color real de la Red (la CdP no
  // tiene color propio), con el mismo criterio de contraste de texto que ya
  // usa el resto del lienzo (contraste.ts) en vez de un estilo fijo.
  const color = colorRed && colorRed.toUpperCase() !== '#FFFFFF' ? colorRed : COLOR_BANNER_POR_DEFECTO;
  const colorTexto = textoLegibleSobre(color);
  const [dialogoCargo, setDialogoCargo] = useState<DialogoCargo | null>(null);
  const [mostrarDomicilio, setMostrarDomicilio] = useState(false);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const [otpEliminar, setOtpEliminar] = useState('');
  const eliminarCdp = useEliminarCasaDePazEstructura(iglesiaId);
  // KAN-111: reactivar una CdP eliminada por la vía normal (fn_eliminar_cdp)
  // mientras siga dentro del período de gracia configurable.
  const [confirmandoReactivar, setConfirmandoReactivar] = useState(false);
  const [otpReactivar, setOtpReactivar] = useState('');
  const reactivarCdp = useReactivarCasaDePazEstructura(iglesiaId);

  useEffect(() => {
    // Bug real (2026-08-15): el atajo "+ Añadir sublíder" del nodo en el
    // lienzo dispara esto sin pasar por el gate de `casaDePaz.eliminada` de
    // más abajo -- en una CdP cerrada terminaba abriendo el diálogo de
    // todas formas, y el backend rechazaba con CDP_INEXISTENTE, que
    // invitar-lider (edge function) confunde con "ya existe una cuenta".
    if (abrirAnadirSubliderAlAbrir && !casaDePaz.eliminada) {
      setDialogoCargo({ codigo: 'SUBLIDER_CDP', titulo: 'Sublíderes de Casa de Paz', exclusivo: false });
    }
  }, [abrirAnadirSubliderAlAbrir, casaDePaz.id, casaDePaz.eliminada]);

  const { data: cargos = [] } = useCargos();
  const { data: vigentes = [], isLoading: cargandoVigentes } = useCargoVigenteCdp(
    casaDePaz.id,
    dialogoCargo?.codigo ?? 'LIDER_CDP',
  );
  const { data: domicilio } = useDomicilioCdp(casaDePaz.id);
  const asignarCargo = useAsignarCargoCdp(iglesiaId);
  const quitarCargo = useQuitarCargoCdp();
  const invitarLider = useInvitarLider();
  const { data: invitacionesLider = [] } = useInvitacionesLider(iglesiaId);
  const invitacionesPendientes = invitacionesLider.filter((inv) => inv.casa_de_paz_id === casaDePaz.id && inv.estado === 'PENDIENTE');
  const reenviarInvitacion = useReenviarInvitacionLider();
  const cancelarInvitacion = useCancelarInvitacionLider();
  const [cancelandoInvitacionId, setCancelandoInvitacionId] = useState<string | null>(null);

  function handleCancelarInvitacion(invitacionId: string) {
    cancelarInvitacion.mutate(invitacionId, {
      onSuccess: () => { toast.success('Invitación cancelada'); setCancelandoInvitacionId(null); void invalidarEstructura(); },
      onError: (e) => { manejarErrorCargo(e, 'No se pudo cancelar'); setCancelandoInvitacionId(null); },
    });
  }

  const lider = casaDePaz.lideres[0];
  const anfitrion = casaDePaz.anfitriones[0];

  // KAN-189: el diálogo de "Eliminar Casa de Paz" nombra al líder y/o
  // sublíder actuales (si existen) en vez de un texto genérico -- el backend
  // ya no bloquea el borrado por tenerlos asignados, así que hay que dejar
  // claro con quién se está usando la acción antes de confirmar.
  const nombreLider = lider ? (lider.nombre || lider.etiqueta) : null;
  const nombresSublideres = casaDePaz.sublideres.map((s) => s.nombre || s.etiqueta);
  const partesAsignadas = [
    nombreLider ? `líder a ${nombreLider}` : null,
    nombresSublideres.length > 0 ? `sublíder a ${nombresSublideres.join(' y ')}` : null,
  ].filter((parte): parte is string => parte !== null);
  const tituloEliminar = partesAsignadas.length > 0
    ? `¿Eliminar esta Casa de Paz? Tiene como ${partesAsignadas.join(' y como ')}.`
    : '¿Eliminar esta Casa de Paz de la base de datos?';

  useEffect(() => {
    if (dialogoCargo || mostrarDomicilio || confirmandoEliminar) return;
    const cerrarConEscape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', cerrarConEscape);
    return () => window.removeEventListener('keydown', cerrarConEscape);
  }, [onClose, dialogoCargo, mostrarDomicilio, confirmandoEliminar]);

  const invalidarEstructura = () => queryClient.invalidateQueries({ queryKey: ['estructura-organizacional', iglesiaId] });

  async function confirmarEliminar() {
    if (otpRequerido && !/^\d{6}$/.test(otpEliminar)) return;
    try {
      await eliminarCdp.mutateAsync({ cdpId: casaDePaz.id, otp: otpEliminar || null });
      toast.success('Casa de Paz eliminada de la base de datos');
      setConfirmandoEliminar(false);
      setOtpEliminar('');
      onClose();
    } catch (e) {
      manejarErrorCargo(e, 'No se pudo eliminar la Casa de Paz');
    }
  }

  async function confirmarReactivar() {
    if (otpRequerido && !/^\d{6}$/.test(otpReactivar)) return;
    try {
      await reactivarCdp.mutateAsync({ cdpId: casaDePaz.id, otp: otpReactivar || null });
      toast.success('Casa de Paz reactivada');
      setConfirmandoReactivar(false);
      setOtpReactivar('');
    } catch (e) {
      manejarErrorCargo(e, 'No se pudo reactivar la Casa de Paz');
    }
  }

  async function handleAsignar(persona: PersonaBusqueda) {
    if (!dialogoCargo) return;
    const cargo = cargos.find((c) => c.codigo === dialogoCargo.codigo);
    if (!cargo) return;
    try {
      const { pendiente } = await asignarCargo.mutateAsync({
        cdpId: casaDePaz.id,
        personaId: persona.id,
        codigo: dialogoCargo.codigo,
        cargoId: cargo.id,
      });
      toast.success(pendiente ? 'Solicitud enviada' : `${persona.nombre_completo} asignado`);
      // KAN-117: aviso por correo a Lider/Sublider de CdP recien designado,
      // mismo mecanismo que ya usa Red (notificarAsignacionCargoRed). No
      // aplica a Anfitrion (no es un cargo de liderazgo) ni cuando la
      // asignacion quedo "pendiente" (solicitud de cambio de Lider sin
      // resolver todavia -- ahi todavia no hay nadie designado a quien avisar).
      if (!pendiente && (dialogoCargo.codigo === 'LIDER_CDP' || dialogoCargo.codigo === 'SUBLIDER_CDP')) {
        notificarAsignacionCargoCdp(casaDePaz.id, persona.id, dialogoCargo.codigo).catch((e) =>
          console.error('No se pudo avisar por correo de la designación', e),
        );
      }
      void invalidarEstructura();
    } catch (e) {
      manejarErrorCargo(e, 'No se pudo asignar el cargo');
    }
  }

  function handleQuitar(id: string) {
    quitarCargo.mutate(id, {
      onSuccess: () => void invalidarEstructura(),
      onError: (e) => manejarErrorCargo(e, 'No se pudo quitar el cargo'),
    });
  }

  // KAN-24x: si el correo ya tenia cuenta con una Persona vinculada, el
  // backend devuelve 409 con personaId/personaNombre -- se lo pasamos a
  // AsignarCargoDialog para que pida confirmacion antes de asignar, en vez
  // de asignar en silencio. Una invitacion nueva de verdad (todavia sin
  // cuenta) sigue avisando por toast.
  async function handleInvitar(correo: string) {
    if (!dialogoCargo) return;
    try {
      const resultado = await invitarLider.mutateAsync(
        { correo, rol: dialogoCargo.codigo as 'LIDER_CDP' | 'SUBLIDER_CDP', redId: null, casaDePazId: casaDePaz.id },
      );
      toast.success(`Invitación enviada a ${correo}`);
      void invalidarEstructura();
      return resultado;
    } catch (e) {
      const { personaId, personaNombre } = e as { personaId?: string; personaNombre?: string };
      if (personaId && personaNombre) return { personaExistente: { id: personaId, nombre: personaNombre } };
      manejarErrorCargo(e, 'No se pudo invitar');
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Cerrar detalle de Casa de Paz"
        onClick={() => { if (!dialogoCargo && !mostrarDomicilio) onClose(); }}
        className="absolute inset-0 z-20 cursor-default bg-slate-950/15 backdrop-blur-[1px]"
      />
      <aside className="absolute inset-x-0 bottom-0 z-30 max-h-[90%] overflow-y-auto rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:inset-y-4 sm:right-4 sm:left-auto sm:w-[380px] sm:max-h-none sm:rounded-3xl">
        <div className="flex justify-center pt-2 pb-1 sm:hidden">
          <div className="h-1.5 w-10 rounded-full bg-slate-300" />
        </div>
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4" style={{ backgroundColor: color }}>
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide uppercase opacity-70" style={{ color: colorTexto }}>Casa de Paz</p>
            {casaDePaz.nombre?.trim() && (
              <p className="truncate text-sm font-bold" style={{ color: colorTexto }}>{casaDePaz.nombre.trim()}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel"
            // KAN-63: h-9 w-9 (36px) queda bajo el minimo tactil de 44x44
            // (REQ-MOB-3) -- antes:absolute expande el area de toque real
            // sin agrandar el icono visible, mismo patron ya usado en los
            // botones de zoom/centrar del lienzo (EstructuraOrganizacional.tsx).
            className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-colors before:absolute before:-inset-1 before:content-[''] hover:bg-black/10"
            style={{ color: colorTexto }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {casaDePaz.eliminada ? (
        <div className="space-y-4 p-5">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-800">Esta Casa de Paz fue cerrada</p>
            <p className="mt-1 text-xs text-amber-700">
              Sigue visible (agrisada) mientras dure su período de gracia configurable. Nada se puede modificar hasta reactivarla.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmandoReactivar(true)}
            className="h-10 w-full cursor-pointer rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Reactivar Casa de Paz
          </button>
          {puedeEliminarPorCompleto && (
            <button
              type="button"
              onClick={() => setConfirmandoEliminar(true)}
              className="h-9 w-full cursor-pointer rounded-xl text-xs font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600"
            >
              Eliminar Casa de Paz
            </button>
          )}
        </div>
        ) : (
        <div className="space-y-4 p-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Líder</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-900">{lider?.etiqueta ?? 'Sin asignar'}</p>
                {lider?.correo && lider.nombre && <p className="truncate text-xs text-slate-500">{lider.correo}</p>}
              </div>
              <button
                type="button"
                onClick={() => setDialogoCargo({ codigo: 'LIDER_CDP', titulo: 'Líder de Casa de Paz', exclusivo: true })}
                className="shrink-0 cursor-pointer rounded-lg border border-blue-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
              >
                {lider ? 'Cambiar' : 'Asignar'}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Anfitrión</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-900">{anfitrion?.etiqueta ?? 'Sin asignar'}</p>
                {anfitrion?.correo && anfitrion.nombre && <p className="truncate text-xs text-slate-500">{anfitrion.correo}</p>}
              </div>
              <button
                type="button"
                onClick={() => setDialogoCargo({ codigo: 'ANFITRION', titulo: 'Anfitrión de Casa de Paz', exclusivo: true })}
                className="shrink-0 cursor-pointer rounded-lg border border-blue-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
              >
                {anfitrion ? 'Cambiar' : 'Asignar'}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Sublíderes</p>
                {casaDePaz.sublideres.length === 0 ? (
                  <p className="mt-1 text-sm text-slate-500">Sin sublíderes todavía.</p>
                ) : (
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {casaDePaz.sublideres.map((sub) => (
                      <li key={sub.id} className="truncate text-sm text-slate-900">
                        {sub.etiqueta}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDialogoCargo({ codigo: 'SUBLIDER_CDP', titulo: 'Sublíderes de Casa de Paz', exclusivo: false })}
                className="shrink-0 cursor-pointer rounded-lg border border-blue-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
              >
                + Añadir
              </button>
            </div>
          </section>

          {invitacionesPendientes.length > 0 && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-bold tracking-wide text-amber-700 uppercase">Invitaciones pendientes</p>
              <ul className="mt-2 flex flex-col gap-2">
                {invitacionesPendientes.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate text-amber-800">{inv.correo}</span>
                    {cancelandoInvitacionId === inv.id ? (
                      <span className="flex shrink-0 items-center gap-2 text-xs">
                        <button type="button" onClick={() => setCancelandoInvitacionId(null)} className="relative cursor-pointer font-semibold text-slate-500 before:absolute before:-inset-x-2 before:-inset-y-3.5 before:content-['']">No</button>
                        <button type="button" disabled={cancelarInvitacion.isPending} onClick={() => handleCancelarInvitacion(inv.id)} className="relative cursor-pointer font-semibold text-red-600 before:absolute before:-inset-x-2 before:-inset-y-3.5 before:content-['']">
                          {cancelarInvitacion.isPending ? 'Cancelando...' : 'Sí, cancelar'}
                        </button>
                      </span>
                    ) : (
                      <span className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          disabled={reenviarInvitacion.isPending}
                          onClick={() => reenviarInvitacion.mutate(inv.id, {
                            onSuccess: () => toast.success('Invitación reenviada'),
                            onError: () => toast.error('No se pudo reenviar'),
                          })}
                          className="relative flex cursor-pointer items-center gap-1 text-xs font-semibold text-blue-700 before:absolute before:-inset-x-2 before:-inset-y-3.5 before:content-['']"
                        >
                          <RefreshCw className="h-3 w-3" /> Reenviar
                        </button>
                        <button
                          type="button"
                          onClick={() => setCancelandoInvitacionId(inv.id)}
                          className="relative cursor-pointer text-xs font-semibold text-amber-700 before:absolute before:-inset-x-2 before:-inset-y-3.5 before:content-[''] hover:text-red-600"
                        >
                          Cancelar
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><MapPin className="h-4 w-4" /></span>
                <div className="min-w-0">
                  <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Dirección</p>
                  <p className="mt-1 truncate text-sm text-slate-700">
                    {domicilio ? [domicilio.calle, domicilio.numero, domicilio.zona].filter(Boolean).join(' ') || domicilio.ciudad_nombre : 'Dirección pendiente'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMostrarDomicilio(true)}
                className="shrink-0 cursor-pointer rounded-lg border border-blue-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
              >
                {domicilio ? 'Editar' : 'Añadir'}
              </button>
            </div>
          </section>

          {puedeEliminarPorCompleto && (
            <button
              type="button"
              onClick={() => setConfirmandoEliminar(true)}
              className="h-9 w-full cursor-pointer rounded-xl text-xs font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600"
            >
              Eliminar Casa de Paz
            </button>
          )}
        </div>
        )}
      </aside>

      <ConfirmarQuitarDialog
        open={confirmandoEliminar}
        onOpenChange={(abierto) => { setConfirmandoEliminar(abierto); if (!abierto) setOtpEliminar(''); }}
        titulo={tituloEliminar}
        descripcion="Se elimina por completo de la base de datos, junto con sus cargos asignados. No se puede deshacer."
        procesando={eliminarCdp.isPending}
        onConfirmar={() => void confirmarEliminar()}
        textoConfirmar="Sí, eliminar definitivamente"
        textoProcesando="Eliminando…"
        otpRequerido={otpRequerido}
        otp={otpEliminar}
        onOtpChange={setOtpEliminar}
      />

      <ConfirmarQuitarDialog
        open={confirmandoReactivar}
        onOpenChange={(abierto) => { setConfirmandoReactivar(abierto); if (!abierto) setOtpReactivar(''); }}
        titulo="¿Reactivar esta Casa de Paz?"
        descripcion="Vuelve a estar activa como antes de eliminarla."
        procesando={reactivarCdp.isPending}
        onConfirmar={() => void confirmarReactivar()}
        textoConfirmar="Sí, reactivar"
        textoProcesando="Reactivando…"
        otpRequerido={otpRequerido}
        otp={otpReactivar}
        onOtpChange={setOtpReactivar}
      />

      {dialogoCargo && (
        <AsignarCargoDialog
          open
          onOpenChange={(abierto) => !abierto && setDialogoCargo(null)}
          titulo={dialogoCargo.titulo}
          exclusivo={dialogoCargo.exclusivo}
          iglesiaId={iglesiaId}
          cdpId={casaDePaz.id}
          vigentes={vigentes}
          cargandoVigentes={cargandoVigentes}
          asignando={asignarCargo.isPending}
          onAsignar={(persona) => void handleAsignar(persona)}
          onQuitar={handleQuitar}
          quitando={quitarCargo.isPending}
          excluirIdsExtra={dialogoCargo.codigo === 'SUBLIDER_CDP' && lider ? [lider.id] : []}
          invitable={dialogoCargo.codigo === 'LIDER_CDP' || dialogoCargo.codigo === 'SUBLIDER_CDP'}
          invitando={invitarLider.isPending}
          onInvitar={handleInvitar}
        />
      )}

      {mostrarDomicilio && (
        <DomicilioAnfitrionDialog
          open
          onOpenChange={setMostrarDomicilio}
          cdpId={casaDePaz.id}
          iglesiaId={iglesiaId}
          domicilio={domicilio}
        />
      )}
    </>
  );
}
