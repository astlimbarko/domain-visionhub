import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useHistorialProcesoAfirmacion } from '@/hooks/useAfirmacion';
import { fechaLegible } from '@/utils/calendario-fechas';
import { EliminarRegistroProceso } from '@/components/afirmacion/EliminarRegistroProceso';
import { IndicadorCruceProceso } from '@/components/afirmacion/IndicadorCruceProceso';
import { ResumenProcesoAfirmacion } from '@/components/afirmacion/ResumenProcesoAfirmacion';
import { useFichaPersonaStore } from '@/store/ficha-persona.store';

interface Props {
  iglesiaId: string;
  /** Al tocar una persona, en la puerta de Membresía se vuelve al formulario
   * "Nuevo" precargado y en modo edición (reemplaza al modal). Si no se pasa
   * (ej. el panel AfirmacionPersonas, que no tiene form inline) se abre la
   * ficha completa como antes. */
  onEditar?: (personaId: string) => void;
}

/**
 * KAN-497 paso 7: pestaña "Registro" del formulario de membresía de nuevos.
 * Lista las personas cargadas desde ese formulario, con el colaborador que las
 * tomó. Desde 2026-10-03 todos los que pueden gestionar Afirmación (incluidos
 * los colaboradores) ven TODOS los registros de la iglesia. Cada fila tiene
 * botón para eliminar duplicados.
 *
 * Pedido del owner (2026-10-03): como bautismo y membresía van parejo pero se
 * dan en momentos distintos, cada fila muestra si esa persona YA tiene su
 * BAUTIZO registrado (cruce frontend con el historial de Bautismo).
 */
export function RegistroMembresiaNuevos({ iglesiaId, onEditar }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const { data: registros = [], isLoading } = useHistorialProcesoAfirmacion(iglesiaId, 'MEMBRESIA_NUEVOS');
  const { data: historialBautismo = [] } = useHistorialProcesoAfirmacion(iglesiaId, 'BAUTISMO');
  const conBautizo = useMemo(() => new Set(historialBautismo.map((r) => r.persona_id)), [historialBautismo]);
  const abrirFicha = useFichaPersonaStore((s) => s.abrir);
  const abrirPersona = (id: string) => (onEditar ? onEditar(id) : abrirFicha(id, { permitirEdicionExtra: true }));

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return registros;
    return registros.filter((r) => r.nombre_completo.toLowerCase().includes(q));
  }, [registros, busqueda]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Input placeholder="Buscar en el registro..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      {filtrados.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Todavía no hay personas registradas desde este formulario.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {filtrados.map((r, i) => (
            <li key={r.id} className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 hover:bg-muted/40">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground tabular-nums">
                {i + 1}
              </span>
              {/* Click → precarga en "Nuevo" en modo edición (bloqueado hasta
               * tocar "Editar"), sin duplicar la persona. */}
              <button
                type="button"
                onClick={() => abrirPersona(r.persona_id)}
                className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                    {r.nombre_completo}
                    <IndicadorCruceProceso presente={conBautizo.has(r.persona_id)} etiqueta="Bautizo" />
                  </p>
                  <p className="text-[11px] text-muted-foreground">Registrado el {fechaLegible(r.fecha)}</p>
                </div>
                <p className="shrink-0 text-right text-[12px] text-muted-foreground">
                  Tomó el dato: <span className="font-medium text-foreground">{r.registrado_por_nombre}</span>
                </p>
              </button>
              <EliminarRegistroProceso registroId={r.id} nombre={r.nombre_completo} procesoCodigo="MEMBRESIA_NUEVOS" />
            </li>
          ))}
        </ul>
      )}

      <ResumenProcesoAfirmacion
        registros={filtrados}
        etiqueta="Membresía"
        extra={filtrados.length > 0 ? `Con bautizo registrado: ${filtrados.filter((r) => conBautizo.has(r.persona_id)).length} de ${filtrados.length}.` : undefined}
      />
    </div>
  );
}
