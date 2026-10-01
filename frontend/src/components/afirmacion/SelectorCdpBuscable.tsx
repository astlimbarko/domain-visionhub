// KAN-488 (decisión owner 2026-10-01): picker buscable de Casa de Paz para la
// Membresía desde 0. Reemplaza el "elegir de la lista" simple. Lista las CdP
// de la iglesia Y de sus satélites/hijas, agrupadas por Red, con buscador por
// nombre/Red/iglesia (fn_listar_cdp_asistencia). Mismo patrón que BuscadorPersona
// (Input + lista filtrada en cliente; la lista es acotada por iglesia+satélites).
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { Input } from '@/components/ui/input';
import { listarCdpAsistencia, type CdpAsistencia } from '@/services/membresia-borrador.service';

interface Props {
  iglesiaId: string;
  /** casa_de_paz_id seleccionada ('' si ninguna todavía). */
  valorId: string;
  /** etiqueta de la CdP seleccionada (para mostrarla sin re-buscar). */
  valorEtiqueta: string;
  /** null = deseleccionar ("Cambiar"). */
  onSeleccionar: (cdp: CdpAsistencia | null) => void;
}

export function SelectorCdpBuscable({ iglesiaId, valorId, valorEtiqueta, onSeleccionar }: Props) {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);

  const { data: cdps = [], isLoading } = useQuery({
    queryKey: ['afirmacion', 'cdp-asistencia', iglesiaId],
    queryFn: () => listarCdpAsistencia(iglesiaId),
    enabled: !!iglesiaId,
  });

  const filtrados = useMemo(() => {
    const q = texto.trim().toLowerCase();
    if (!q) return cdps;
    return cdps.filter(
      (c) =>
        c.casa_de_paz_etiqueta.toLowerCase().includes(q) ||
        (c.red_nombre ?? '').toLowerCase().includes(q) ||
        c.iglesia_nombre.toLowerCase().includes(q),
    );
  }, [cdps, texto]);

  // Agrupadas por Red (requisito del owner: "clasificadas por Redes").
  const grupos = useMemo(() => {
    const m = new Map<string, { red: string; items: CdpAsistencia[] }>();
    for (const c of filtrados) {
      const key = c.red_id ?? '__sin_red__';
      if (!m.has(key)) m.set(key, { red: c.red_nombre ?? 'Sin Red', items: [] });
      m.get(key)!.items.push(c);
    }
    return [...m.values()];
  }, [filtrados]);

  if (valorId) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3.5 py-2.5">
        <span className="truncate text-sm font-medium">{valorEtiqueta}</span>
        <button
          type="button"
          className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => onSeleccionar(null)}
        >
          Cambiar
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className={cn('pl-8', CAMPO_ESTILO)}
          placeholder="Buscar Casa de Paz por nombre, Red o iglesia..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onFocus={() => setAbierto(true)}
          onBlur={() => setTimeout(() => setAbierto(false), 150)}
          autoComplete="off"
        />
      </div>
      {abierto && (
        <div className="absolute top-full z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-lg">
          {isLoading && <p className="px-2 py-1 text-sm text-muted-foreground">Cargando...</p>}
          {!isLoading && filtrados.length === 0 && (
            <p className="px-2 py-1 text-sm text-muted-foreground">Sin resultados.</p>
          )}
          {grupos.map((g) => (
            <div key={g.red} className="mb-1 last:mb-0">
              <p className="px-2 py-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                {g.red}
              </p>
              {g.items.map((c) => (
                <button
                  key={c.casa_de_paz_id}
                  type="button"
                  onMouseDown={() => {
                    onSeleccionar(c);
                    setTexto('');
                    setAbierto(false);
                  }}
                  className="flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <span>{c.casa_de_paz_etiqueta}</span>
                  {c.es_satelite && (
                    <span className="text-[11px] text-muted-foreground">{c.iglesia_nombre} · satélite</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
