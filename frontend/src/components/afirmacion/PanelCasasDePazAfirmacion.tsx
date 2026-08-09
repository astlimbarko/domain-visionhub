/**
 * KAN-127: Afirmación debe ver TODAS las Casas de Paz de su iglesia,
 * organizadas por Red -- no solo el subconjunto con líder de CdP vigente
 * que ya cubren PanelUrlsAfirmacion (administración de URLs) y
 * SelectorLiderCdp (registro interno). Es de solo lectura, mismo patrón
 * visual de agrupado/colapsable por Red que PanelUrlsAfirmacion para que
 * el módulo se sienta consistente.
 */
import { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useCasasDePazAfirmacion } from '@/hooks/useAfirmacion';
import type { CasaDePazAfirmacion } from '@/types/afirmacion.types';

function coincide(cdp: CasaDePazAfirmacion, texto: string) {
  const t = texto.trim().toLowerCase();
  if (!t) return true;
  return [cdp.casa_de_paz_etiqueta, cdp.red_nombre ?? '', cdp.lider_red_nombre ?? '']
    .join(' ')
    .toLowerCase()
    .includes(t);
}

interface Grupo {
  clave: string;
  redNombre: string;
  liderRedNombre: string | null;
  items: CasaDePazAfirmacion[];
}

function agruparPorRed(items: CasaDePazAfirmacion[]): Grupo[] {
  const mapa = new Map<string, Grupo>();
  for (const c of items) {
    const clave = c.red_id ?? '__sin_red__';
    if (!mapa.has(clave)) {
      mapa.set(clave, { clave, redNombre: c.red_nombre ?? 'Sin red asignada', liderRedNombre: c.lider_red_nombre, items: [] });
    }
    mapa.get(clave)!.items.push(c);
  }
  return [...mapa.values()].sort((a, b) => a.redNombre.localeCompare(b.redNombre));
}

interface Props {
  iglesiaId: string;
}

export function PanelCasasDePazAfirmacion({ iglesiaId }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [colapsadas, setColapsadas] = useState<Set<string>>(new Set());

  const { data: casas = [], isLoading } = useCasasDePazAfirmacion(iglesiaId);

  const filtradas = useMemo(() => casas.filter((c) => coincide(c, busqueda)), [casas, busqueda]);
  const grupos = useMemo(() => agruparPorRed(filtradas), [filtradas]);

  function toggleGrupo(clave: string) {
    setColapsadas((prev) => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave);
      else next.add(clave);
      return next;
    });
  }

  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Buscar por Casa de Paz o Red..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-3">
        {grupos.length === 0 && (
          <p className="rounded-2xl border border-border/50 bg-card/60 px-4 py-6 text-center text-sm text-muted-foreground">
            {casas.length === 0 ? 'Esta iglesia todavía no tiene Casas de Paz.' : 'Sin resultados para esa búsqueda.'}
          </p>
        )}

        {grupos.map((grupo) => {
          const colapsado = colapsadas.has(grupo.clave);
          return (
            <div key={grupo.clave} className="overflow-hidden rounded-2xl border border-border/50 bg-card/40">
              <button
                type="button"
                onClick={() => toggleGrupo(grupo.clave)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60"
              >
                <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', colapsado && '-rotate-90')} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{grupo.redNombre}</p>
                  {grupo.liderRedNombre && <p className="truncate text-xs text-muted-foreground">Líder de Red: {grupo.liderRedNombre}</p>}
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                  {grupo.items.length}
                </span>
              </button>

              {!colapsado && (
                <div className="flex flex-col gap-2 border-t border-border/50 p-2.5">
                  {grupo.items.map((c) => (
                    <div
                      key={c.casa_de_paz_id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-border/40 bg-background/60 px-3.5 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="truncate text-sm font-semibold">{c.casa_de_paz_etiqueta}</span>
                        {!c.activo && <span className="ml-2 text-[11px] text-muted-foreground">(inactiva)</span>}
                      </div>
                      {c.tiene_lider_vigente ? (
                        <Badge variant="outline" className="shrink-0 border-border/60 text-[11px] font-medium text-muted-foreground">
                          {c.lider_cdp_nombre}
                        </Badge>
                      ) : (
                        <Badge className="shrink-0 bg-[var(--chart-3)] text-[11px] font-bold text-white">Sin líder vigente</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
