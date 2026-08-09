import { useEffect, useState } from 'react';
import { Search, UserRound, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CampoOtp } from '@/components/shared/CampoOtp';
import { ConfirmarQuitarDialog } from '@/components/shared/ConfirmarQuitarDialog';
import { useInvitarUsuario } from '@/hooks/useAdmin';
import {
  useAsignarPastorEstructura,
  useAsignarSupervisorEstructura,
  useBuscarPersonasEstructura,
  useQuitarPastorEstructura,
  useQuitarSupervisorEstructura,
} from './useEstructuraOrganizacional';
import { notificarAsignacionCargoPrincipal } from './estructura.service';
import type { PersonaEstructura, PersonaOpcionEstructura } from './types';

type ModoAsignacion = 'base' | 'correo';
export type TipoPrincipalEstructura = 'PASTOR' | 'SUPERVISOR';

const TEXTOS: Record<TipoPrincipalEstructura, { etiqueta: string; rolInvitacion: 'PASTOR' | 'SUPERVISOR_VISION_ACCION' }> = {
  PASTOR: { etiqueta: 'Pastor', rolInvitacion: 'PASTOR' },
  SUPERVISOR: { etiqueta: 'Supervisor', rolInvitacion: 'SUPERVISOR_VISION_ACCION' },
};

interface Props {
  tipo: TipoPrincipalEstructura;
  iglesiaId: string;
  actuales: PersonaEstructura[];
  otpRequerido: boolean;
  onClose: () => void;
}

export function PanelPrincipalEstructura({ tipo, iglesiaId, actuales, otpRequerido, onClose }: Props) {
  const queryClient = useQueryClient();
  const asignarPastor = useAsignarPastorEstructura(iglesiaId);
  const asignarSupervisor = useAsignarSupervisorEstructura(iglesiaId);
  const asignar = tipo === 'PASTOR' ? asignarPastor : asignarSupervisor;
  const quitarPastor = useQuitarPastorEstructura(iglesiaId);
  const quitarSupervisor = useQuitarSupervisorEstructura(iglesiaId);
  const quitar = tipo === 'PASTOR' ? quitarPastor : quitarSupervisor;
  const invitar = useInvitarUsuario();
  const { etiqueta, rolInvitacion } = TEXTOS[tipo];

  const [mostrarAsignar, setMostrarAsignar] = useState(false);
  const [modo, setModo] = useState<ModoAsignacion>('base');
  const [busqueda, setBusqueda] = useState('');
  const [correo, setCorreo] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmandoQuitar, setConfirmandoQuitar] = useState<PersonaEstructura | null>(null);
  const [otpQuitar, setOtpQuitar] = useState('');
  const { data: personas = [], isFetching } = useBuscarPersonasEstructura(iglesiaId, busqueda);
  const datosSinGuardar = mostrarAsignar && (busqueda.trim().length > 0 || correo.trim().length > 0 || otp.trim().length > 0);
  // Pastor admite hasta 2 (pareja pastoral: "Pastor" y "Pastora", mismo
  // cargo del sistema) -- el boton se deshabilita al llegar a 2. Supervisor
  // de la Vision en Accion admite varios, siempre disponible (pedido del
  // owner, 2026-08-07).
  const puedeAsignarNuevo = tipo === 'SUPERVISOR' || actuales.length < 2;
  const textoBotonAsignar =
    tipo === 'SUPERVISOR'
      ? actuales.length === 0 ? 'Asignar Supervisor' : 'Designar otro Supervisor'
      : actuales.length === 0 ? 'Asignar Pastor' : 'Asignar Pastora';

  useEffect(() => {
    const cerrarConEscape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape' && !datosSinGuardar) onClose();
    };
    window.addEventListener('keydown', cerrarConEscape);
    return () => window.removeEventListener('keydown', cerrarConEscape);
  }, [onClose, datosSinGuardar]);

  const procesando = asignar.isPending || invitar.isPending;
  const codigoCompleto = /^\d{6}$/.test(otp);
  // Vía BD usa la RPC propia del constructor: respeta el switch del módulo.
  const otpValidoBase = !otpRequerido || codigoCompleto;
  // Vía correo reusa invitar-usuario (regla global): Super Admin siempre exige OTP.
  const otpValidoCorreo = codigoCompleto;

  const invalidarEstructura = async () => {
    await queryClient.invalidateQueries({ queryKey: ['estructura-organizacional', iglesiaId] });
  };

  const seleccionarPersona = async (persona: PersonaOpcionEstructura) => {
    if (!otpValidoBase) return;
    try {
      await asignar.mutateAsync({ personaId: persona.id, otp });
      toast.success(`${etiqueta} asignado`);
      // KAN-117: aviso por correo, igual que ya hace el mismo flujo para Red
      // (notificarAsignacionCargoRed) -- no bloquea si falla, el cargo ya
      // quedo asignado.
      notificarAsignacionCargoPrincipal(iglesiaId, persona.id, tipo).catch((error) =>
        console.error('No se pudo avisar por correo de la designación', error),
      );
      setOtp('');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `No se pudo asignar al ${etiqueta}`);
    }
  };

  const confirmarQuitar = async () => {
    if (!confirmandoQuitar) return;
    if (otpRequerido && !/^\d{6}$/.test(otpQuitar)) return;
    try {
      await quitar.mutateAsync({ personaId: confirmandoQuitar.id, otp: otpQuitar || null });
      toast.success(`${etiqueta} quitado`);
      setConfirmandoQuitar(null);
      setOtpQuitar('');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `No se pudo quitar al ${etiqueta}`);
    }
  };

  const cancelarAsignar = () => {
    setMostrarAsignar(false);
    setModo('base');
    setBusqueda('');
    setCorreo('');
    setOtp('');
  };

  const invitarPorCorreo = async () => {
    if (!correo.trim().includes('@') || !otpValidoCorreo) return;
    try {
      const resultado = await invitar.mutateAsync({
        correo: correo.trim().toLowerCase(),
        rol: rolInvitacion,
        iglesiaId,
        pin: otp,
      });
      if (resultado.error) {
        toast.warning(resultado.error);
      } else {
        await invalidarEstructura();
        toast.success('Designación enviada por correo');
        onClose();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo enviar la designación');
    } finally {
      setOtp('');
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label={`Cerrar panel de ${etiqueta}`}
        onClick={() => { if (!datosSinGuardar) onClose(); }}
        className="absolute inset-0 z-20 cursor-default bg-slate-950/20 backdrop-blur-[1px]"
      />
      <aside className="absolute inset-x-0 bottom-0 z-30 max-h-[94%] overflow-y-auto rounded-t-3xl border border-slate-200 bg-slate-50 shadow-2xl sm:inset-y-4 sm:right-4 sm:left-auto sm:w-[430px] sm:max-h-none sm:rounded-3xl">
        <div className="flex justify-center pt-2 pb-1 sm:hidden">
          <div className="h-1.5 w-10 rounded-full bg-slate-300" />
        </div>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-lg font-bold text-slate-950">{etiqueta}</p>
            <p className="text-xs text-slate-500">Solo Super Admin puede modificar al {etiqueta}.</p>
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
          {actuales.map((persona) => (
            <section key={persona.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">{etiqueta} actual</p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-900">{persona.nombre?.trim() || persona.correo}</p>
                  {persona.correo && persona.nombre && <p className="truncate text-xs text-slate-500">{persona.correo}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmandoQuitar(persona)}
                  className="relative shrink-0 cursor-pointer text-xs font-semibold text-slate-500 before:absolute before:-inset-x-2 before:-inset-y-3.5 before:content-[''] hover:text-red-600"
                >
                  Quitar cargo
                </button>
              </div>
            </section>
          ))}

          {!mostrarAsignar ? (
            <button
              type="button"
              disabled={!puedeAsignarNuevo}
              title={!puedeAsignarNuevo ? 'Ya hay 2 personas asignadas como Pastor. Quita un cargo actual antes de asignar otro.' : undefined}
              onClick={() => setMostrarAsignar(true)}
              className="h-10 w-full cursor-pointer rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              {textoBotonAsignar}
            </button>
          ) : (
            <>
              <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setModo('base')}
                  className={`cursor-pointer rounded-lg px-2 py-2 ${modo === 'base' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}
                >
                  Desde base de datos
                </button>
                <button
                  type="button"
                  onClick={() => setModo('correo')}
                  className={`cursor-pointer rounded-lg px-2 py-2 ${modo === 'correo' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}
                >
                  Por correo electrónico
                </button>
              </div>

              {modo === 'base' ? (
                <div>
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={busqueda}
                      onChange={(evento) => setBusqueda(evento.target.value)}
                      placeholder="Escribe nombre, apellido o correo"
                      className="h-10 w-full rounded-xl border border-slate-200 pr-3 pl-9 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  {busqueda.trim().length >= 2 && (
                    <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-slate-200 p-1.5">
                      {isFetching && <p className="px-2 py-2 text-xs text-slate-500">Buscando…</p>}
                      {!isFetching && personas.length === 0 && <p className="px-2 py-2 text-xs text-slate-500">No se encontraron personas.</p>}
                      {personas.map((persona) => (
                        <button
                          key={persona.id}
                          type="button"
                          disabled={procesando || !otpValidoBase}
                          onClick={() => void seleccionarPersona(persona)}
                          className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700"><UserRound className="h-4 w-4" /></span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-slate-900">{persona.nombre}</span>
                            <span className="block truncate text-xs text-slate-500">{persona.correo || 'Sin correo registrado'}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label htmlFor="estructura-principal-correo" className="text-xs font-semibold text-slate-700">Correo electrónico</label>
                    <input
                      id="estructura-principal-correo"
                      type="email"
                      value={correo}
                      onChange={(evento) => setCorreo(evento.target.value)}
                      placeholder={`${etiqueta.toLowerCase()}@correo.com`}
                      className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={procesando || !correo.trim().includes('@') || !otpValidoCorreo}
                    onClick={() => void invitarPorCorreo()}
                    className="h-10 w-full cursor-pointer rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {invitar.isPending ? 'Enviando…' : 'Invitar y asignar'}
                  </button>
                </div>
              )}

              {(otpRequerido || modo === 'correo') && <CampoOtp value={otp} onChange={setOtp} />}

              <button
                type="button"
                onClick={cancelarAsignar}
                className="h-9 w-full cursor-pointer rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100"
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      </aside>

      <ConfirmarQuitarDialog
        open={!!confirmandoQuitar}
        onOpenChange={(abierto) => { if (!abierto) { setConfirmandoQuitar(null); setOtpQuitar(''); } }}
        titulo={`¿Quitar a ${confirmandoQuitar?.nombre?.trim() || confirmandoQuitar?.correo || 'esta persona'} de ${etiqueta}?`}
        descripcion="Deja de tener acceso de inmediato. El cargo queda sin asignar."
        procesando={quitar.isPending}
        onConfirmar={() => void confirmarQuitar()}
        otpRequerido={otpRequerido}
        otp={otpQuitar}
        onOtpChange={setOtpQuitar}
      />
    </>
  );
}
