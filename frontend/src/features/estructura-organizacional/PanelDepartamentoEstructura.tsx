import { useEffect, useState } from 'react';
import { Mail, RefreshCw, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ConfirmarQuitarDialog } from '@/components/shared/ConfirmarQuitarDialog';
import { useCargoVigenteDepartamento, useQuitarCargoDepartamento } from '@/hooks/usePanelSupervisor';
import { useCancelarInvitacionLider, useInvitacionesDepartamento, useReenviarInvitacionLider } from '@/hooks/useInvitacionLider';
import { AsignarLiderAfirmacionDialog } from './AsignarLiderAfirmacionDialog';
import { mensajeError } from './estructura.service';
import { DEPARTAMENTO_FUNCIONAL, DEPARTAMENTO_META } from '@/utils/departamentos';
import type { DepartamentoEstructura } from './types';

interface Props {
  iglesiaId: string;
  departamento: DepartamentoEstructura;
  otpRequerido: boolean;
  onClose: () => void;
}

/**
 * Barra lateral de Departamento (2026-08-06, pedido explícito): antes hacer
 * clic en un Departamento abría directo el modal de "Asignar líder". Ahora
 * siempre aparece primero este panel -- hoy solo tiene el botón de Asignar
 * líder, pero es el lugar donde van a vivir más opciones a futuro que
 * todavía no existen (mismo patrón que Red y Casa de Paz).
 */
export function PanelDepartamentoEstructura({ iglesiaId, departamento, otpRequerido, onClose }: Props) {
  const queryClient = useQueryClient();
  const [asignando, setAsignando] = useState(false);
  const [confirmandoQuitar, setConfirmandoQuitar] = useState(false);
  const [otpQuitar, setOtpQuitar] = useState('');
  const meta = DEPARTAMENTO_META[departamento.codigo];
  const esFuncional = departamento.codigo === DEPARTAMENTO_FUNCIONAL;
  const lider = departamento.lideres[0];
  const pendiente = lider?.membresiaPendiente ?? false;
  const etiqueta = lider?.etiqueta ?? 'Sin asignar';

  const { data: vigentes = [] } = useCargoVigenteDepartamento(esFuncional ? departamento.id : undefined);
  const vigente = vigentes[0];
  const quitarCargo = useQuitarCargoDepartamento(departamento.id);

  const { data: invitaciones = [] } = useInvitacionesDepartamento(esFuncional ? iglesiaId : undefined);
  const invitacionPendiente = invitaciones.find((i) => i.departamento_id === departamento.id && i.estado === 'PENDIENTE');
  const reenviarInvitacion = useReenviarInvitacionLider();
  const cancelarInvitacion = useCancelarInvitacionLider();
  const [cancelandoInvitacion, setCancelandoInvitacion] = useState(false);

  function handleCancelarInvitacion() {
    if (!invitacionPendiente) return;
    cancelarInvitacion.mutate(invitacionPendiente.id, {
      onSuccess: () => {
        toast.success('Invitación cancelada');
        setCancelandoInvitacion(false);
        void queryClient.invalidateQueries({ queryKey: ['estructura', 'invitaciones-departamento'] });
      },
      onError: (e) => { toast.error(mensajeError(e, 'No se pudo cancelar')); setCancelandoInvitacion(false); },
    });
  }

  useEffect(() => {
    const cerrarConEscape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape' && !asignando && !confirmandoQuitar) onClose();
    };
    window.addEventListener('keydown', cerrarConEscape);
    return () => window.removeEventListener('keydown', cerrarConEscape);
  }, [onClose, asignando, confirmandoQuitar]);

  async function confirmarQuitarLider() {
    if (!vigente) return;
    try {
      await quitarCargo.mutateAsync({ id: vigente.id, pin: otpQuitar });
      await queryClient.invalidateQueries({ queryKey: ['estructura-organizacional', iglesiaId] });
      toast.success('Líder quitado del departamento');
      setConfirmandoQuitar(false);
      setOtpQuitar('');
    } catch (error) {
      toast.error(mensajeError(error, 'No se pudo quitar el líder'));
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Cerrar panel de Departamento"
        onClick={() => { if (!asignando && !confirmandoQuitar) onClose(); }}
        className="absolute inset-0 z-20 cursor-default bg-slate-950/20 backdrop-blur-[1px]"
      />
      <aside className="absolute inset-x-0 bottom-0 z-30 max-h-[94%] overflow-y-auto rounded-t-3xl border border-slate-200 bg-slate-50 shadow-2xl sm:inset-y-4 sm:right-4 sm:left-auto sm:w-[430px] sm:max-h-none sm:rounded-3xl">
        <div className="flex justify-center pt-2 pb-1 sm:hidden">
          <div className="h-1.5 w-10 rounded-full bg-slate-300" />
        </div>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-lg font-bold text-slate-950">{meta?.verbo ?? departamento.nombre}</p>
            <p className="text-xs text-slate-500">Departamento</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel"
            // KAN-63: h-9 w-9 (36px) queda bajo el minimo tactil de 44x44
            // (REQ-MOB-3) -- antes:absolute expande el area de toque real
            // sin agrandar el icono visible, mismo patron ya usado en los
            // botones de zoom/centrar del lienzo (EstructuraOrganizacional.tsx).
            className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-slate-500 before:absolute before:-inset-1 before:content-[''] hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Líder</p>
                <div className="mt-2 flex min-w-0 items-center gap-2.5">
                  <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                    {lider?.nombre ? lider.nombre.trim().slice(0, 1).toUpperCase() : <Mail className="h-4 w-4" />}
                    {lider && (
                      <span
                        className="absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-white"
                        style={{ backgroundColor: pendiente ? '#94a3b8' : '#22c55e' }}
                      />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span title={etiqueta} className="block truncate text-sm font-semibold text-slate-900">{etiqueta}</span>
                    {lider?.correo && lider.nombre && (
                      <span title={lider.correo} className="block truncate text-xs text-slate-500">{lider.correo}</span>
                    )}
                    {lider && (
                      <span className="block text-[11px] text-slate-500">
                        {pendiente ? 'Confirmación pendiente' : 'Cuenta confirmada'}
                      </span>
                    )}
                  </span>
                </div>
              </div>
              {esFuncional ? (
                <button
                  type="button"
                  onClick={() => setAsignando(true)}
                  className="shrink-0 cursor-pointer rounded-lg border border-blue-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                >
                  {lider ? 'Cambiar' : 'Asignar'}
                </button>
              ) : (
                <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-500">Próximamente</span>
              )}
            </div>
            {esFuncional && lider && vigente && (
              <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setConfirmandoQuitar(true)}
                  className="relative cursor-pointer text-xs font-semibold text-slate-500 before:absolute before:-inset-x-2 before:-inset-y-3.5 before:content-[''] hover:text-red-600"
                >
                  Quitar cargo
                </button>
              </div>
            )}
            {esFuncional && invitacionPendiente && (
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-500">Invitación pendiente: {invitacionPendiente.correo}</span>
                {cancelandoInvitacion ? (
                  <span className="flex shrink-0 items-center gap-2 text-xs">
                    <button type="button" onClick={() => setCancelandoInvitacion(false)} className="relative cursor-pointer font-semibold text-slate-500 before:absolute before:-inset-x-2 before:-inset-y-3.5 before:content-['']">No</button>
                    <button type="button" disabled={cancelarInvitacion.isPending} onClick={handleCancelarInvitacion} className="relative cursor-pointer font-semibold text-red-600 before:absolute before:-inset-x-2 before:-inset-y-3.5 before:content-['']">
                      {cancelarInvitacion.isPending ? 'Cancelando...' : 'Sí, cancelar'}
                    </button>
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      disabled={reenviarInvitacion.isPending}
                      onClick={() => reenviarInvitacion.mutate(invitacionPendiente.id, {
                        onSuccess: () => toast.success('Invitación reenviada'),
                        onError: () => toast.error('No se pudo reenviar'),
                      })}
                      className="relative flex cursor-pointer items-center gap-1 text-xs font-semibold text-blue-700 before:absolute before:-inset-x-2 before:-inset-y-3.5 before:content-['']"
                    >
                      <RefreshCw className="h-3 w-3" /> Reenviar
                    </button>
                    <button
                      type="button"
                      onClick={() => setCancelandoInvitacion(true)}
                      className="relative cursor-pointer text-xs font-semibold text-slate-500 before:absolute before:-inset-x-2 before:-inset-y-3.5 before:content-[''] hover:text-red-600"
                    >
                      Cancelar
                    </button>
                  </span>
                )}
              </div>
            )}
          </section>
        </div>
      </aside>

      {esFuncional && (
        <AsignarLiderAfirmacionDialog
          open={asignando}
          onOpenChange={setAsignando}
          departamentoId={departamento.id}
          departamentoNombre={meta?.verbo ?? departamento.nombre}
          iglesiaId={iglesiaId}
          otpRequerido={otpRequerido}
        />
      )}

      <ConfirmarQuitarDialog
        open={confirmandoQuitar}
        onOpenChange={(abierto) => { setConfirmandoQuitar(abierto); if (!abierto) setOtpQuitar(''); }}
        titulo={`¿Quitar a ${etiqueta} de Líder de ${meta?.verbo ?? departamento.nombre}?`}
        descripcion="Deja de tener acceso al panel del departamento de inmediato."
        procesando={quitarCargo.isPending}
        onConfirmar={() => void confirmarQuitarLider()}
        otpRequerido={otpRequerido}
        otp={otpQuitar}
        onOtpChange={setOtpQuitar}
      />
    </>
  );
}
