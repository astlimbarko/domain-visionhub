import { useEffect, useState } from 'react';
import { Home, Mail, Palette, Search, UserRound, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CampoOtp } from '@/components/shared/CampoOtp';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useCancelarInvitacionLider,
  useCorregirCorreoInvitacionLider,
  useInvitarLider,
  useReenviarInvitacionLider,
} from '@/hooks/useInvitacionLider';
import { textoLegibleSobre } from './contraste';
import {
  useActualizarRedEstructura,
  useAsignarCargoRedEstructura,
  useBuscarPersonasEstructura,
  useCrearCasaDePazEstructura,
  useCrearRedEstructura,
  useQuitarCargoRedEstructura,
} from './useEstructuraOrganizacional';
import type {
  CargoRedEstructura,
  PersonaEstructura,
  PersonaOpcionEstructura,
  RedEstructura,
} from './types';

const PALETA_RED = ['#2563EB', '#DC2626', '#059669', '#F59E0B', '#0891B2', '#EA580C', '#7C3AED', '#DB2777'];

type ModoPanel = 'crear' | 'editar';
type ModoAsignacion = 'base' | 'correo';

interface Props {
  iglesiaId: string;
  modo: ModoPanel;
  red: RedEstructura | null;
  redesExistentes: RedEstructura[];
  otpRequerido: boolean;
  onClose: () => void;
}

interface CargoProps {
  titulo: string;
  responsable?: PersonaEstructura;
  onAbrir: () => void;
  onQuitar: () => void;
  onReenviar: (invitacionId: string) => void;
  onCorregirCorreo: (invitacionId: string, correoNuevo: string) => void;
  onCancelarInvitacion: (invitacionId: string) => void;
  procesando: boolean;
}

function ResumenCargo({
  titulo,
  responsable,
  onAbrir,
  onQuitar,
  onReenviar,
  onCorregirCorreo,
  onCancelarInvitacion,
  procesando,
}: CargoProps) {
  const pendiente = responsable?.membresiaPendiente ?? false;
  const etiqueta = responsable?.nombre?.trim() || responsable?.correo || 'Sin asignar';
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [correoNuevo, setCorreoNuevo] = useState('');

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">{titulo}</p>
          <div className="mt-2 flex min-w-0 items-center gap-2.5">
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              {responsable?.nombre ? responsable.nombre.trim().slice(0, 1).toUpperCase() : <Mail className="h-4 w-4" />}
              {responsable && (
                <span
                  className="absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-white"
                  style={{ backgroundColor: pendiente ? '#94a3b8' : '#22c55e' }}
                />
              )}
            </span>
            <span className="min-w-0">
              <span title={etiqueta} className="block truncate text-sm font-semibold text-slate-900">{etiqueta}</span>
              {responsable?.correo && responsable.nombre && (
                <span title={responsable.correo} className="block truncate text-xs text-slate-500">{responsable.correo}</span>
              )}
              {responsable && (
                <span className="block text-[11px] text-slate-500">
                  {pendiente ? 'Confirmación pendiente' : 'Cuenta confirmada'}
                </span>
              )}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onAbrir}
          disabled={procesando}
          className="shrink-0 cursor-pointer rounded-lg border border-blue-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {responsable ? 'Cambiar' : 'Asignar'}
        </button>
      </div>
      {responsable && responsable.invitacionId && corrigiendo && (
        <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
          <input
            type="email"
            autoFocus
            value={correoNuevo}
            onChange={(evento) => setCorreoNuevo(evento.target.value)}
            placeholder="Correo correcto"
            className="h-9 flex-1 rounded-lg border border-slate-200 px-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="button"
            disabled={procesando || !correoNuevo.trim().includes('@')}
            onClick={() => {
              onCorregirCorreo(responsable.invitacionId as string, correoNuevo.trim());
              setCorrigiendo(false);
              setCorreoNuevo('');
            }}
            className="h-9 shrink-0 cursor-pointer rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Guardar
          </button>
          <button type="button" onClick={() => setCorrigiendo(false)} className="shrink-0 cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-700">
            Cancelar
          </button>
        </div>
      )}
      {responsable && (
        <div className="mt-3 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-3">
          {responsable.invitacionId ? (
            <>
              <button
                type="button"
                disabled={procesando}
                onClick={() => onReenviar(responsable.invitacionId as string)}
                className="cursor-pointer text-xs font-semibold text-blue-700 hover:text-blue-900 disabled:opacity-50"
              >
                Reenviar
              </button>
              <button
                type="button"
                disabled={procesando}
                onClick={() => setCorrigiendo((valor) => !valor)}
                className="cursor-pointer text-xs font-semibold text-blue-700 hover:text-blue-900 disabled:opacity-50"
              >
                Corregir correo
              </button>
              <button
                type="button"
                disabled={procesando}
                onClick={() => onCancelarInvitacion(responsable.invitacionId as string)}
                className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-red-600 disabled:opacity-50"
              >
                Cancelar designación
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={procesando}
              onClick={onQuitar}
              className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-red-600 disabled:opacity-50"
            >
              Quitar cargo
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export function PanelRedEstructura({ iglesiaId, modo, red, redesExistentes, otpRequerido, onClose }: Props) {
  const queryClient = useQueryClient();
  const crear = useCrearRedEstructura(iglesiaId);
  const actualizar = useActualizarRedEstructura(iglesiaId);
  const asignar = useAsignarCargoRedEstructura(iglesiaId);
  const quitar = useQuitarCargoRedEstructura(iglesiaId);
  const invitar = useInvitarLider();
  const reenviar = useReenviarInvitacionLider();
  const cancelarInvitacion = useCancelarInvitacionLider();
  const corregirCorreo = useCorregirCorreoInvitacionLider();
  const crearCdp = useCrearCasaDePazEstructura(iglesiaId);

  const [nombre, setNombre] = useState(red?.nombre ?? '');
  const [color, setColor] = useState(red?.color && red.color !== '#FFFFFF' ? red.color : PALETA_RED[0]);
  const [otp, setOtp] = useState('');
  const [cargoActivo, setCargoActivo] = useState<CargoRedEstructura | null>(null);
  const [modoAsignacion, setModoAsignacion] = useState<ModoAsignacion>('base');
  const [busqueda, setBusqueda] = useState('');
  const [correo, setCorreo] = useState('');
  const { data: personas = [], isFetching } = useBuscarPersonasEstructura(iglesiaId, busqueda);
  const [creandoCdp, setCreandoCdp] = useState(false);
  const [busquedaLiderCdp, setBusquedaLiderCdp] = useState('');
  const [liderCdpElegido, setLiderCdpElegido] = useState<PersonaOpcionEstructura | null>(null);
  const { data: personasCdp = [], isFetching: buscandoLiderCdp } = useBuscarPersonasEstructura(iglesiaId, busquedaLiderCdp);

  useEffect(() => {
    const cerrarConEscape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', cerrarConEscape);
    return () => window.removeEventListener('keydown', cerrarConEscape);
  }, [onClose]);

  useEffect(() => {
    setNombre(red?.nombre ?? '');
    setColor(red?.color && red.color !== '#FFFFFF' ? red.color : PALETA_RED[0]);
    setCargoActivo(null);
    setBusqueda('');
    setCorreo('');
    setOtp('');
    setCreandoCdp(false);
    setBusquedaLiderCdp('');
    setLiderCdpElegido(null);
  }, [red, modo]);

  const procesando = crear.isPending || actualizar.isPending || asignar.isPending
    || quitar.isPending || invitar.isPending || reenviar.isPending || crearCdp.isPending
    || cancelarInvitacion.isPending || corregirCorreo.isPending;
  const otpValido = !otpRequerido || /^\d{6}$/.test(otp);
  const formularioValido = nombre.trim().length >= 2 && /^#[0-9A-Fa-f]{6}$/.test(color) && otpValido;
  const esColorPersonalizado = !PALETA_RED.some((opcion) => opcion === color.toUpperCase());
  const redConMismoColor = redesExistentes.find(
    (otra) => otra.id !== red?.id && otra.color?.toUpperCase() === color.toUpperCase(),
  );

  const invalidar = async () => {
    await queryClient.invalidateQueries({ queryKey: ['estructura-organizacional', iglesiaId] });
  };

  const guardarRed = async () => {
    if (!formularioValido) return;
    try {
      if (modo === 'crear') {
        await crear.mutateAsync({ nombre: nombre.trim(), color, otp: otp || null });
        toast.success('Red creada');
        onClose();
      } else if (red) {
        await actualizar.mutateAsync({ redId: red.id, nombre: nombre.trim(), color, otp: otp || null });
        toast.success('Red actualizada');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la Red');
    }
  };

  const seleccionarPersona = async (persona: PersonaOpcionEstructura) => {
    if (!red || !cargoActivo || !otpValido) return;
    try {
      await asignar.mutateAsync({ redId: red.id, personaId: persona.id, codigo: cargoActivo, otp: otp || null });
      toast.success(cargoActivo === 'LIDER_RED' ? 'Líder de Red asignado' : 'Supervisor de Red asignado');
      setCargoActivo(null);
      setBusqueda('');
      setOtp('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo asignar el cargo');
    }
  };

  const invitarPorCorreo = async () => {
    if (!red || !cargoActivo || !correo.trim().includes('@') || !otpValido) return;
    try {
      await invitar.mutateAsync({
        correo: correo.trim().toLowerCase(),
        rol: cargoActivo === 'LIDER_RED' ? 'LIDER_RED' : 'SUPERVISOR_RED',
        redId: red.id,
        casaDePazId: null,
        pin: otp || undefined,
      });
      await invalidar();
      toast.success('Designación enviada por correo');
      setCargoActivo(null);
      setCorreo('');
      setOtp('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo enviar la designación');
    }
  };

  const quitarCargo = async (codigo: CargoRedEstructura) => {
    if (!red || !otpValido) return;
    try {
      await quitar.mutateAsync({ redId: red.id, codigo, otp: otp || null });
      toast.success('Cargo retirado');
      setOtp('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo retirar el cargo');
    }
  };

  const reenviarInvitacion = async (invitacionId: string) => {
    try {
      await reenviar.mutateAsync(invitacionId);
      toast.success('Invitación reenviada');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo reenviar la invitación');
    }
  };

  const cancelarDesignacion = async (invitacionId: string) => {
    try {
      await cancelarInvitacion.mutateAsync(invitacionId);
      await invalidar();
      toast.success('Designación cancelada');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cancelar la designación');
    }
  };

  const corregirCorreoDesignacion = async (invitacionId: string, correoNuevo: string) => {
    if (!otpValido) {
      toast.error('Ingresá el código de confirmación antes de corregir el correo');
      return;
    }
    try {
      await corregirCorreo.mutateAsync({ invitacionId, correoNuevo, pin: otp || undefined });
      await invalidar();
      toast.success('Correo corregido, invitación reenviada');
      setOtp('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo corregir el correo');
    }
  };

  const abrirCargo = (codigo: CargoRedEstructura) => {
    setCargoActivo(codigo);
    setModoAsignacion('base');
    setBusqueda('');
    setCorreo('');
  };

  const crearNuevaCasaDePaz = async () => {
    if (!red || !otpValido) return;
    try {
      await crearCdp.mutateAsync({ redId: red.id, liderPersonaId: liderCdpElegido?.id ?? null, otp: otp || null });
      toast.success('Casa de Paz creada');
      setCreandoCdp(false);
      setBusquedaLiderCdp('');
      setLiderCdpElegido(null);
      setOtp('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear la Casa de Paz');
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label="Cerrar panel de Red"
        onClick={onClose}
        className="absolute inset-0 z-20 cursor-default bg-slate-950/20 backdrop-blur-[1px]"
      />
      <aside className="absolute inset-x-0 bottom-0 z-30 max-h-[88%] overflow-y-auto rounded-t-3xl border border-slate-200 bg-slate-50 shadow-2xl sm:inset-y-4 sm:right-4 sm:left-auto sm:w-[430px] sm:max-h-none sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-lg font-bold text-slate-950">{modo === 'crear' ? 'Nueva Red' : 'Gestionar Red'}</p>
            <p className="text-xs text-slate-500">
              {modo === 'crear' ? 'Define su nombre y color identificativo.' : 'Edita la Red y designa responsables.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <label htmlFor="estructura-red-nombre" className="text-xs font-semibold text-slate-700">Nombre de la Red</label>
            <input
              id="estructura-red-nombre"
              value={nombre}
              onChange={(evento) => setNombre(evento.target.value)}
              placeholder="Ej. Sion"
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <p className="mt-4 text-xs font-semibold text-slate-700">Color identificativo</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {PALETA_RED.map((opcion) => (
                <button
                  key={opcion}
                  type="button"
                  aria-label={`Usar color ${opcion}`}
                  onClick={() => setColor(opcion)}
                  className={`h-8 w-8 cursor-pointer rounded-full border-2 transition-transform hover:scale-105 ${color.toUpperCase() === opcion ? 'border-slate-900 ring-2 ring-slate-200' : 'border-white'}`}
                  style={{ backgroundColor: opcion }}
                />
              ))}
              <label
                aria-label="Elegir color personalizado desde la paleta completa"
                className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 transition-transform hover:scale-105 ${esColorPersonalizado ? 'border-slate-900 ring-2 ring-slate-200' : 'border-slate-200 bg-white'}`}
                style={esColorPersonalizado ? { backgroundColor: color } : undefined}
              >
                <Palette className="h-4 w-4" style={{ color: esColorPersonalizado ? textoLegibleSobre(color) : '#475569' }} />
                <input
                  type="color"
                  value={color}
                  onChange={(evento) => setColor(evento.target.value.toUpperCase())}
                  className="sr-only"
                />
              </label>
            </div>
            {redConMismoColor && (
              <p className="mt-2 text-xs font-medium text-amber-600">
                Este color ya lo usa la Red «{redConMismoColor.nombre}». Podés continuar, pero conviene elegir uno distinto para diferenciarlas.
              </p>
            )}
            <div
              className="mt-4 rounded-xl px-4 py-3 text-sm font-semibold"
              style={{ backgroundColor: color, color: textoLegibleSobre(color) }}
            >
              {nombre.trim() ? `Red: "${nombre.trim()}"` : 'Vista previa de la Red'}
            </div>
          </div>

          {modo === 'editar' && red && (
            <>
              <ResumenCargo
                titulo="Líder de Red"
                responsable={red.lideres[0]}
                onAbrir={() => abrirCargo('LIDER_RED')}
                onQuitar={() => void quitarCargo('LIDER_RED')}
                onReenviar={(id) => void reenviarInvitacion(id)}
                onCorregirCorreo={(id, correoNuevo) => void corregirCorreoDesignacion(id, correoNuevo)}
                onCancelarInvitacion={(id) => void cancelarDesignacion(id)}
                procesando={procesando}
              />
              <ResumenCargo
                titulo="Supervisor de Red"
                responsable={red.supervisores[0]}
                onAbrir={() => abrirCargo('SUBLIDER_RED')}
                onQuitar={() => void quitarCargo('SUBLIDER_RED')}
                onReenviar={(id) => void reenviarInvitacion(id)}
                onCorregirCorreo={(id, correoNuevo) => void corregirCorreoDesignacion(id, correoNuevo)}
                onCancelarInvitacion={(id) => void cancelarDesignacion(id)}
                procesando={procesando}
              />

              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                      <Home className="h-4 w-4" />
                    </span>
                    <p className="text-sm font-semibold text-slate-900">Casas de Paz</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCreandoCdp(true)}
                    className="shrink-0 cursor-pointer rounded-lg border border-blue-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                  >
                    + Nueva
                  </button>
                </div>
              </section>
            </>
          )}

          {otpRequerido && <CampoOtp value={otp} onChange={setOtp} />}
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <button type="button" onClick={onClose} className="h-10 cursor-pointer rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
          <button
            type="button"
            disabled={procesando || !formularioValido}
            onClick={() => void guardarRed()}
            className="h-10 cursor-pointer rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {crear.isPending || actualizar.isPending ? 'Guardando…' : modo === 'crear' ? 'Crear Red' : 'Guardar cambios'}
          </button>
        </div>
      </aside>

      <Dialog open={!!cargoActivo} onOpenChange={(abierto) => { if (!abierto) setCargoActivo(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{cargoActivo === 'LIDER_RED' ? 'Designar Líder de Red' : 'Designar Supervisor de Red'}</DialogTitle>
            <DialogDescription>El cargo aparece de inmediato; el punto será gris hasta confirmar la cuenta.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setModoAsignacion('base')}
              className={`cursor-pointer rounded-lg px-2 py-2 ${modoAsignacion === 'base' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}
            >
              Desde base de datos
            </button>
            <button
              type="button"
              onClick={() => setModoAsignacion('correo')}
              className={`cursor-pointer rounded-lg px-2 py-2 ${modoAsignacion === 'correo' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}
            >
              Por correo electrónico
            </button>
          </div>

          {modoAsignacion === 'base' ? (
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
              {otpRequerido && <div className="mt-3"><CampoOtp value={otp} onChange={setOtp} /></div>}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label htmlFor="estructura-red-correo" className="text-xs font-semibold text-slate-700">Correo electrónico</label>
                <input
                  id="estructura-red-correo"
                  type="email"
                  value={correo}
                  onChange={(evento) => setCorreo(evento.target.value)}
                  placeholder="persona@correo.com"
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              {otpRequerido && <CampoOtp value={otp} onChange={setOtp} />}
              <button
                type="button"
                disabled={procesando || !correo.trim().includes('@') || !otpValido}
                onClick={() => void invitarPorCorreo()}
                className="h-10 w-full cursor-pointer rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {invitar.isPending ? 'Enviando…' : 'Designar y enviar correo'}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={creandoCdp} onOpenChange={(abierto) => { if (!abierto) { setCreandoCdp(false); setLiderCdpElegido(null); setBusquedaLiderCdp(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Casa de Paz</DialogTitle>
            <DialogDescription>Se crea sin nombre propio. El líder es opcional y se puede asignar después.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {liderCdpElegido ? (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <span className="truncate text-slate-900">{liderCdpElegido.nombre}</span>
                <button type="button" onClick={() => setLiderCdpElegido(null)} className="cursor-pointer text-xs text-slate-500 hover:text-slate-700">
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={busquedaLiderCdp}
                  onChange={(evento) => setBusquedaLiderCdp(evento.target.value)}
                  placeholder="Líder (opcional): nombre, apellido o correo"
                  className="h-10 w-full rounded-xl border border-slate-200 pr-3 pl-9 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            )}
            {!liderCdpElegido && busquedaLiderCdp.trim().length >= 2 && (
              <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 p-1.5">
                {buscandoLiderCdp && <p className="px-2 py-2 text-xs text-slate-500">Buscando…</p>}
                {!buscandoLiderCdp && personasCdp.length === 0 && <p className="px-2 py-2 text-xs text-slate-500">No se encontraron personas.</p>}
                {personasCdp.map((persona) => (
                  <button
                    key={persona.id}
                    type="button"
                    onClick={() => { setLiderCdpElegido(persona); setBusquedaLiderCdp(''); }}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-slate-50"
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
            {otpRequerido && <CampoOtp value={otp} onChange={setOtp} />}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setCreandoCdp(false); setLiderCdpElegido(null); setBusquedaLiderCdp(''); setOtp(''); }}
                className="h-9 cursor-pointer rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={procesando || !otpValido}
                onClick={() => void crearNuevaCasaDePaz()}
                className="h-9 cursor-pointer rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {crearCdp.isPending ? 'Creando…' : 'Crear Casa de Paz'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
