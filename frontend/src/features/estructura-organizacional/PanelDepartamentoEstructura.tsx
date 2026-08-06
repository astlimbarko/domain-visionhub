import { useEffect, useState } from 'react';
import { Mail, X } from 'lucide-react';
import { AsignarLiderAfirmacionDialog } from './AsignarLiderAfirmacionDialog';
import { DEPARTAMENTO_FUNCIONAL, DEPARTAMENTO_META } from '@/utils/departamentos';
import type { DepartamentoEstructura } from './types';

interface Props {
  iglesiaId: string;
  departamento: DepartamentoEstructura;
  onClose: () => void;
}

/**
 * Barra lateral de Departamento (2026-08-06, pedido explícito): antes hacer
 * clic en un Departamento abría directo el modal de "Asignar líder". Ahora
 * siempre aparece primero este panel -- hoy solo tiene el botón de Asignar
 * líder, pero es el lugar donde van a vivir más opciones a futuro que
 * todavía no existen (mismo patrón que Red y Casa de Paz).
 */
export function PanelDepartamentoEstructura({ iglesiaId, departamento, onClose }: Props) {
  const [asignando, setAsignando] = useState(false);
  const meta = DEPARTAMENTO_META[departamento.codigo];
  const esFuncional = departamento.codigo === DEPARTAMENTO_FUNCIONAL;
  const lider = departamento.lideres[0];
  const pendiente = lider?.membresiaPendiente ?? false;
  const etiqueta = lider?.nombre?.trim() || lider?.correo || 'Sin asignar';

  useEffect(() => {
    const cerrarConEscape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape' && !asignando) onClose();
    };
    window.addEventListener('keydown', cerrarConEscape);
    return () => window.removeEventListener('keydown', cerrarConEscape);
  }, [onClose, asignando]);

  return (
    <>
      <button
        type="button"
        aria-label="Cerrar panel de Departamento"
        onClick={onClose}
        className="absolute inset-0 z-20 cursor-default bg-slate-950/20 backdrop-blur-[1px]"
      />
      <aside className="absolute inset-x-0 bottom-0 z-30 max-h-[88%] overflow-y-auto rounded-t-3xl border border-slate-200 bg-slate-50 shadow-2xl sm:inset-y-4 sm:right-4 sm:left-auto sm:w-[430px] sm:max-h-none sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-lg font-bold text-slate-950">{meta?.verbo ?? departamento.nombre}</p>
            <p className="text-xs text-slate-500">Departamento</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100">
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
        />
      )}
    </>
  );
}
