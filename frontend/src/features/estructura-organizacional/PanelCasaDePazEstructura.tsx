import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MapPin, X } from 'lucide-react';
import { toast } from 'sonner';
import { AsignarCargoDialog } from '@/components/casas-de-paz/AsignarCargoDialog';
import { DomicilioAnfitrionDialog } from '@/components/casas-de-paz/DomicilioAnfitrionDialog';
import { useInvitarLider } from '@/hooks/useInvitacionLider';
import {
  useAsignarCargoCdp,
  useCargoVigenteCdp,
  useCargos,
  useDomicilioCdp,
  useQuitarCargoCdp,
} from '@/hooks/useCasasDePaz';
import type { CargoCdpCodigo, PersonaBusqueda } from '@/types/casas-de-paz.types';
import type { CasaDePazEstructura } from './types';

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

export function PanelCasaDePazEstructura({ iglesiaId, casaDePaz, onClose }: Props) {
  const queryClient = useQueryClient();
  const [dialogoCargo, setDialogoCargo] = useState<DialogoCargo | null>(null);
  const [mostrarDomicilio, setMostrarDomicilio] = useState(false);

  const { data: cargos = [] } = useCargos();
  const { data: vigentes = [], isLoading: cargandoVigentes } = useCargoVigenteCdp(
    casaDePaz.id,
    dialogoCargo?.codigo ?? 'LIDER_CDP',
  );
  const { data: domicilio } = useDomicilioCdp(casaDePaz.id);
  const asignarCargo = useAsignarCargoCdp(iglesiaId);
  const quitarCargo = useQuitarCargoCdp();
  const invitarLider = useInvitarLider();

  const lider = casaDePaz.lideres[0];
  const anfitrion = casaDePaz.anfitriones[0];

  useEffect(() => {
    if (dialogoCargo || mostrarDomicilio) return;
    const cerrarConEscape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', cerrarConEscape);
    return () => window.removeEventListener('keydown', cerrarConEscape);
  }, [onClose, dialogoCargo, mostrarDomicilio]);

  const invalidarEstructura = () => queryClient.invalidateQueries({ queryKey: ['estructura-organizacional', iglesiaId] });

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

  function handleInvitar(correo: string) {
    if (!dialogoCargo) return;
    invitarLider.mutate(
      { correo, rol: dialogoCargo.codigo as 'LIDER_CDP' | 'SUBLIDER_CDP', redId: null, casaDePazId: casaDePaz.id },
      {
        onSuccess: () => {
          toast.success(`Invitación enviada a ${correo}`);
          void invalidarEstructura();
        },
        onError: (e) => manejarErrorCargo(e, 'No se pudo invitar'),
      },
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label="Cerrar detalle de Casa de Paz"
        onClick={() => { if (!dialogoCargo && !mostrarDomicilio) onClose(); }}
        className="absolute inset-0 z-20 cursor-default bg-slate-950/15 backdrop-blur-[1px]"
      />
      <aside className="absolute inset-x-0 bottom-0 z-30 max-h-[78%] overflow-y-auto rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:inset-y-4 sm:right-4 sm:left-auto sm:w-[380px] sm:max-h-none sm:rounded-3xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Casa de Paz</p>
          <button type="button" onClick={onClose} aria-label="Cerrar panel" className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Líder</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-900">{lider?.nombre?.trim() || lider?.correo || 'Sin asignar'}</p>
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
                <p className="mt-1 truncate text-sm font-semibold text-slate-900">{anfitrion?.nombre?.trim() || anfitrion?.correo || 'Sin asignar'}</p>
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
                        {sub.nombre?.trim() || sub.correo}
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
        </div>
      </aside>

      {dialogoCargo && (
        <AsignarCargoDialog
          open
          onOpenChange={(abierto) => !abierto && setDialogoCargo(null)}
          titulo={dialogoCargo.titulo}
          exclusivo={dialogoCargo.exclusivo}
          iglesiaId={iglesiaId}
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
