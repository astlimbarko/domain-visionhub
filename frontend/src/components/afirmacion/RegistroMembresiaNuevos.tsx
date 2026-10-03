import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useHistorialProcesoAfirmacion } from '@/hooks/useAfirmacion';
import { fechaLegible } from '@/utils/calendario-fechas';
import { useFichaPersonaStore } from '@/store/ficha-persona.store';
import { EliminarRegistroProceso } from '@/components/afirmacion/EliminarRegistroProceso';

interface Props {
  iglesiaId: string;
}

/**
 * KAN-497 paso 7: pestaña "Registro" del formulario de membresía de nuevos.
 * Lista las personas cargadas desde ese formulario, con el colaborador que las
 * tomó. Desde 2026-10-03 todos los que pueden gestionar Afirmación (incluidos
 * los colaboradores) ven TODOS los registros de la iglesia -- el backend ya no
 * restringe al colaborador a lo suyo. Cada fila tiene botón para eliminar
 * duplicados, igual que las pestañas Registro de Altar/Bautismo/RSIL.
 */
export function RegistroMembresiaNuevos({ iglesiaId }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const { data: registros = [], isLoading } = useHistorialProcesoAfirmacion(iglesiaId, 'MEMBRESIA_NUEVOS');
  const abrirFicha = useFichaPersonaStore((s) => s.abrir);

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
        <ul className="flex flex-col gap-2">
          {filtrados.map((r) => (
            <li key={r.id} className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card px-4 py-3 hover:bg-muted/40">
              {/* KAN-497 paso 9: abre la ficha completa con los datos
               * bloqueados -- "Editar" la habilita para esta misma persona,
               * sin duplicar -- ver ficha-persona.store.ts. */}
              <button
                type="button"
                onClick={() => abrirFicha(r.persona_id, { permitirEdicionExtra: true })}
                className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{r.nombre_completo}</p>
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
    </div>
  );
}
