import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useHistorialProcesoAfirmacion } from '@/hooks/useAfirmacion';
import { fechaLegible } from '@/utils/calendario-fechas';
import { useFichaPersonaStore } from '@/store/ficha-persona.store';

interface Props {
  iglesiaId: string;
}

/**
 * KAN-497 paso 7: pestaña "Registro" del formulario de membresía de nuevos.
 * Lista las personas cargadas desde ese formulario, con el colaborador que las
 * tomó. El permiso (Afirmación ve todo; un colaborador solo lo suyo) lo resuelve
 * el backend, igual que las pestañas Datos de Altar/Bautismo/RSIL.
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
            <li key={r.id}>
              {/* KAN-497 paso 9: abre la ficha completa con los datos
               * bloqueados -- "Editar" la habilita para esta misma persona,
               * sin duplicar. Si esta fila es visible acá, ya es del viewer
               * (colaborador) o el viewer es Afirmación (ve y edita todo) --
               * ver ficha-persona.store.ts. */}
              <button
                type="button"
                onClick={() => abrirFicha(r.persona_id, { permitirEdicionExtra: true })}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 text-left hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{r.nombre_completo}</p>
                  <p className="text-[11px] text-muted-foreground">Registrado el {fechaLegible(r.fecha)}</p>
                </div>
                <p className="shrink-0 text-right text-[12px] text-muted-foreground">
                  Tomó el dato: <span className="font-medium text-foreground">{r.registrado_por_nombre}</span>
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
