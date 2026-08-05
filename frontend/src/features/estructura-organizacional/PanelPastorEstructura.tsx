import { useEffect, useState } from 'react';
import { Search, UserRound, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CampoOtp } from '@/components/shared/CampoOtp';
import { useInvitarUsuario } from '@/hooks/useAdmin';
import { useAsignarPastorEstructura, useBuscarPersonasEstructura } from './useEstructuraOrganizacional';
import type { PersonaEstructura, PersonaOpcionEstructura } from './types';

type ModoAsignacion = 'base' | 'correo';

interface Props {
  iglesiaId: string;
  pastorActual?: PersonaEstructura;
  onClose: () => void;
}

export function PanelPastorEstructura({ iglesiaId, pastorActual, onClose }: Props) {
  const queryClient = useQueryClient();
  const asignar = useAsignarPastorEstructura(iglesiaId);
  const invitar = useInvitarUsuario();

  const [modo, setModo] = useState<ModoAsignacion>('base');
  const [busqueda, setBusqueda] = useState('');
  const [correo, setCorreo] = useState('');
  const [otp, setOtp] = useState('');
  const { data: personas = [], isFetching } = useBuscarPersonasEstructura(iglesiaId, busqueda);

  useEffect(() => {
    const cerrarConEscape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', cerrarConEscape);
    return () => window.removeEventListener('keydown', cerrarConEscape);
  }, [onClose]);

  const procesando = asignar.isPending || invitar.isPending;
  const otpValido = /^\d{6}$/.test(otp);

  const invalidarEstructura = async () => {
    await queryClient.invalidateQueries({ queryKey: ['estructura-organizacional', iglesiaId] });
  };

  const seleccionarPersona = async (persona: PersonaOpcionEstructura) => {
    if (!otpValido) return;
    try {
      await asignar.mutateAsync({ personaId: persona.id, otp });
      toast.success('Pastor asignado');
      setOtp('');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo asignar al Pastor');
    }
  };

  const invitarPorCorreo = async () => {
    if (!correo.trim().includes('@') || !otpValido) return;
    try {
      const resultado = await invitar.mutateAsync({
        correo: correo.trim().toLowerCase(),
        rol: 'PASTOR',
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
        aria-label="Cerrar panel de Pastor"
        onClick={onClose}
        className="absolute inset-0 z-20 cursor-default bg-slate-950/20 backdrop-blur-[1px]"
      />
      <aside className="absolute inset-x-0 bottom-0 z-30 max-h-[88%] overflow-y-auto rounded-t-3xl border border-slate-200 bg-slate-50 shadow-2xl sm:inset-y-4 sm:right-4 sm:left-auto sm:w-[430px] sm:max-h-none sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-lg font-bold text-slate-950">{pastorActual ? 'Cambiar Pastor' : 'Asignar Pastor'}</p>
            <p className="text-xs text-slate-500">Solo Super Admin puede modificar al Pastor.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {pastorActual && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Pastor actual</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{pastorActual.nombre?.trim() || pastorActual.correo}</p>
              {pastorActual.correo && pastorActual.nombre && <p className="text-xs text-slate-500">{pastorActual.correo}</p>}
            </section>
          )}

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
                      disabled={procesando || !otpValido}
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
                <label htmlFor="estructura-pastor-correo" className="text-xs font-semibold text-slate-700">Correo electrónico</label>
                <input
                  id="estructura-pastor-correo"
                  type="email"
                  value={correo}
                  onChange={(evento) => setCorreo(evento.target.value)}
                  placeholder="pastor@correo.com"
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <button
                type="button"
                disabled={procesando || !correo.trim().includes('@') || !otpValido}
                onClick={() => void invitarPorCorreo()}
                className="h-10 w-full cursor-pointer rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {invitar.isPending ? 'Enviando…' : 'Invitar y asignar'}
              </button>
            </div>
          )}

          <CampoOtp value={otp} onChange={setOtp} />
        </div>
      </aside>
    </>
  );
}
