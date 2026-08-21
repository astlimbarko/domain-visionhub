/**
 * Administracion de casa_paz_url (14-afirmacion, Requisito 5). Solo URLs de
 * lideres de CdP vigentes (ya filtrado por el backend). Agrupado por Red,
 * colapsable/expandible (pedido del owner, 2026-07-26). Acciones
 * individuales y masivas via fn_set_estado_casa_paz_url -- idempotente y con
 * resultados parciales, el frontend solo muestra el resumen que devuelve.
 */
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, Copy, ExternalLink, Network, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { AZUL } from '@/components/dashboard/DashboardUI';
import { cn } from '@/lib/utils';
import { rutaRegistroPublico } from '@/utils/constants';
import { obtenerUrlBase } from '@/utils/app-url';
import { useSetEstadoUrlsAfirmacion, useUrlsAfirmacion } from '@/hooks/useAfirmacion';
import type { CasaPazUrlAfirmacion, EstadoUrl } from '@/types/afirmacion.types';

// Contraste alto a proposito (fondo solido, no el bg/10 sutil de <Badge>):
// el estado de una URL es la decision operativa central de este panel.
const ESTADO_ESTILO: Record<EstadoUrl, string> = {
  ACTIVO: 'bg-[var(--chart-2)] text-white',
  INACTIVO: 'bg-muted text-muted-foreground border border-border',
  SUSPENDIDO: 'bg-destructive text-white',
};

function coincide(url: CasaPazUrlAfirmacion, texto: string) {
  const t = texto.trim().toLowerCase();
  if (!t) return true;
  return [url.lider_cdp_nombre, url.casa_de_paz_etiqueta, url.red_nombre ?? '', url.lider_red_nombre ?? '']
    .join(' ')
    .toLowerCase()
    .includes(t);
}

function mostrarResultado(resultado: { actualizadas: number; omitidas: { motivo: string }[] }) {
  if (resultado.omitidas.length === 0) {
    toast.success(`${resultado.actualizadas} URL(s) actualizada(s).`);
  } else {
    toast.warning(`${resultado.actualizadas} actualizada(s), ${resultado.omitidas.length} omitida(s) (sin permiso o líder no vigente).`);
  }
}

interface Grupo {
  clave: string;
  redNombre: string;
  liderRedNombre: string | null;
  items: CasaPazUrlAfirmacion[];
}

function agruparPorRed(urls: CasaPazUrlAfirmacion[]): Grupo[] {
  const mapa = new Map<string, Grupo>();
  for (const u of urls) {
    const clave = u.red_id ?? '__sin_red__';
    if (!mapa.has(clave)) {
      mapa.set(clave, { clave, redNombre: u.red_nombre ?? 'Sin red asignada', liderRedNombre: u.lider_red_nombre, items: [] });
    }
    mapa.get(clave)!.items.push(u);
  }
  return [...mapa.values()].sort((a, b) => a.redNombre.localeCompare(b.redNombre));
}

interface Props {
  iglesiaId: string;
}

export function PanelUrlsAfirmacion({ iglesiaId }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());
  const [colapsadas, setColapsadas] = useState<Set<string>>(new Set());

  const { data: urls = [], isLoading } = useUrlsAfirmacion(iglesiaId);
  const mutacion = useSetEstadoUrlsAfirmacion(iglesiaId);

  const filtradas = useMemo(() => urls.filter((u) => coincide(u, busqueda)), [urls, busqueda]);
  const grupos = useMemo(() => agruparPorRed(filtradas), [filtradas]);

  function toggleSeleccion(id: string) {
    setSeleccionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGrupo(clave: string) {
    setColapsadas((prev) => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave);
      else next.add(clave);
      return next;
    });
  }

  function copiarUrl(slug: string) {
    const url = `${obtenerUrlBase()}${rutaRegistroPublico(slug)}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success('Enlace copiado.'),
      () => toast.error('No se pudo copiar el enlace.'),
    );
  }

  // Pedido explícito del owner (2026-08-21): poder navegar/probar el
  // enlace directamente en vez de tener que copiarlo y pegarlo a mano.
  function abrirUrl(slug: string) {
    window.open(`${obtenerUrlBase()}${rutaRegistroPublico(slug)}`, '_blank', 'noopener,noreferrer');
  }

  function cambiarEstado(ids: string[], estado: EstadoUrl) {
    if (ids.length === 0) return;
    mutacion.mutate(
      { ids, estado },
      {
        onSuccess: (resultado) => {
          mostrarResultado(resultado);
          setSeleccionadas(new Set());
        },
        onError: () => toast.error('No se pudo actualizar el estado de las URLs.'),
      },
    );
  }

  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por líder, red o Casa de Paz..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={mutacion.isPending || urls.length === 0}
            onClick={() => cambiarEstado(urls.map((u) => u.url_id), 'ACTIVO')}
          >
            Activar todas
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={mutacion.isPending || urls.length === 0}
            onClick={() => cambiarEstado(urls.map((u) => u.url_id), 'INACTIVO')}
          >
            Desactivar todas
          </Button>
        </div>
      </div>

      {seleccionadas.size > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5">
          <p className="text-sm font-medium">{seleccionadas.size} seleccionada(s)</p>
          <div className="ml-auto flex gap-2">
            <Button size="sm" disabled={mutacion.isPending} onClick={() => cambiarEstado([...seleccionadas], 'ACTIVO')}>
              Activar
            </Button>
            <Button size="sm" variant="outline" disabled={mutacion.isPending} onClick={() => cambiarEstado([...seleccionadas], 'INACTIVO')}>
              Desactivar
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {grupos.length === 0 && (
          <p className="rounded-2xl border border-border/50 bg-card/60 px-4 py-6 text-center text-sm text-muted-foreground">
            {urls.length === 0 ? 'No hay líderes de Casa de Paz activos con URL todavía.' : 'Sin resultados para esa búsqueda.'}
          </p>
        )}

        {grupos.map((grupo) => {
          const colapsado = colapsadas.has(grupo.clave);
          return (
            <div key={grupo.clave} className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
              <button
                type="button"
                onClick={() => toggleGrupo(grupo.clave)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', colapsado && '-rotate-90')} />
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: `color-mix(in oklab, ${AZUL} 12%, transparent)` }}
                >
                  <Network className="h-4 w-4" style={{ color: AZUL }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{grupo.redNombre}</p>
                  {grupo.liderRedNombre && <p className="truncate text-xs text-muted-foreground">Líder de Red: {grupo.liderRedNombre}</p>}
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                  {grupo.items.length}
                </span>
              </button>

              {!colapsado && (
                <div className="flex flex-col gap-2 border-t border-border/60 p-2.5">
                  {grupo.items.map((u) => {
                    // La etiqueta de CdP por defecto ES el nombre del lider (fn_etiqueta_cdp,
                    // 23_etiqueta_cdp.sql) -- solo difiere si hay nombre manual o el lider
                    // tiene 2+ CdP (desambiguacion por zona). Repetirla cuando es igual solo
                    // duplicaba el nombre en pantalla.
                    const etiquetaAporta = u.casa_de_paz_etiqueta !== u.lider_cdp_nombre;
                    return (
                      <div
                        key={u.url_id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-border/50 bg-muted/30 px-3.5 py-2 transition-all hover:border-primary/30 hover:bg-muted/50"
                      >
                        <Checkbox checked={seleccionadas.has(u.url_id)} onCheckedChange={() => toggleSeleccion(u.url_id)} />
                        <div className="flex min-w-0 flex-1 items-baseline gap-2">
                          <span className="truncate text-sm font-semibold">
                            {u.lider_cdp_nombre}
                            {etiquetaAporta && <span className="font-normal text-muted-foreground"> ({u.casa_de_paz_etiqueta})</span>}
                          </span>
                          <button
                            type="button"
                            onClick={() => copiarUrl(u.slug)}
                            className="truncate rounded-md font-mono text-[11px] text-primary/80 underline decoration-primary/30 underline-offset-2 hover:text-primary"
                            title="Click para copiar"
                          >
                            {rutaRegistroPublico(u.slug)}
                          </button>
                        </div>
                        <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide', ESTADO_ESTILO[u.estado])}>
                          {u.estado}
                        </span>
                        <Button variant="ghost" size="icon" aria-label="Copiar enlace" onClick={() => copiarUrl(u.slug)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Abrir enlace en una pestaña nueva"
                          title="Abrir para navegar/probar"
                          onClick={() => abrirUrl(u.slug)}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        {u.estado === 'ACTIVO' ? (
                          <Button size="sm" variant="outline" disabled={mutacion.isPending} onClick={() => cambiarEstado([u.url_id], 'INACTIVO')}>
                            Desactivar
                          </Button>
                        ) : (
                          <Button size="sm" disabled={mutacion.isPending} onClick={() => cambiarEstado([u.url_id], 'ACTIVO')}>
                            Activar
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
