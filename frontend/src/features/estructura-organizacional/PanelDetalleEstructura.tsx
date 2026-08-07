import { useEffect } from 'react';
import { Building2, Home, Network, ShieldCheck, UserRound, X } from 'lucide-react';
import type { DatosNodoEstructura } from './types';

interface Props {
  nodo: DatosNodoEstructura;
  onClose: () => void;
}

const ICONOS = {
  PASTOR_SLOT: UserRound,
  SUPERVISOR_SLOT: ShieldCheck,
  GRUPO_DEPARTAMENTOS: Building2,
  DEPARTAMENTO: Building2,
  GRUPO_REDES: Network,
  RED: Network,
  CASA_DE_PAZ: Home,
} as const;

export function PanelDetalleEstructura({ nodo, onClose }: Props) {
  useEffect(() => {
    const cerrarConEscape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', cerrarConEscape);
    return () => window.removeEventListener('keydown', cerrarConEscape);
  }, [onClose]);

  const Icono = ICONOS[nodo.tipo];
  const color = nodo.color ?? '#2563eb';

  return (
    <>
      <button
        type="button"
        aria-label="Cerrar detalle"
        onClick={onClose}
        className="absolute inset-0 z-20 cursor-default bg-slate-950/15 backdrop-blur-[1px]"
      />
      <aside
        aria-label={`Detalle de ${nodo.titulo}`}
        className="absolute inset-x-0 bottom-0 z-30 max-h-[90%] overflow-y-auto rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:inset-y-4 sm:right-4 sm:left-auto sm:w-[380px] sm:max-h-none sm:rounded-3xl"
      >
        <div className="flex justify-center pt-2 pb-1 sm:hidden">
          <div className="h-1.5 w-10 rounded-full bg-slate-300" />
        </div>
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Detalle</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">
          <div className="flex items-start gap-4">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
              style={{ color, backgroundColor: `color-mix(in oklab, ${color} 12%, white)` }}
            >
              <Icono className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-950">{nodo.titulo}</h2>
              {nodo.subtitulo && <p className="mt-1 text-sm text-slate-500">{nodo.subtitulo}</p>}
            </div>
          </div>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold text-slate-500">Estado organizacional</p>
            <p className="mt-1 text-sm text-slate-700">
              Seleccionado para consultar o administrar sin abandonar el organigrama.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
