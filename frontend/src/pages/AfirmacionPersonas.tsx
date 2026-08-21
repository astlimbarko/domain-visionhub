// VisionHub -- plan panel Afirmación 2026-08-20, punto 3/4 (KAN-216).
// Tabla de todas las personas de la iglesia, no un dashboard: fila de KPIs
// arriba + tabla ordenable (click en el header de columna) y filtrable por
// texto libre. Reusa fn_buscar_personas (ya existe, ahora con red_nombre y
// via_registro) via el hook compartido useBuscarPersonas -- mismo camino que
// ya usa pages/Personas.tsx para el resto de los roles.
import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, FileText, QrCode, Search, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AZUL, MARINO, KpiMosaico, VERDE } from '@/components/dashboard/DashboardUI';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { cn } from '@/lib/utils';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { useAuthStore } from '@/store/auth.store';
import { useBuscarPersonas } from '@/hooks/usePersonas';
import { useEstadisticasPersonasAfirmacion, useEstadisticasRegistroAfirmacion } from '@/hooks/useAfirmacion';
import type { PersonaResultadoBusqueda } from '@/types/persona.types';

const POR_PAGINA = 20;

type ColumnaOrden = 'nombre_completo' | 'edad' | 'red_nombre' | 'casa_de_paz_etiqueta' | 'estado_sigla';
type DireccionOrden = 'asc' | 'desc';

const VIA_REGISTRO_LABEL: Record<'URL' | 'FORMULARIO', string> = {
  URL: 'URL',
  FORMULARIO: 'Formulario',
};

function comparar(a: PersonaResultadoBusqueda, b: PersonaResultadoBusqueda, columna: ColumnaOrden) {
  const va = a[columna];
  const vb = b[columna];
  if (va === null) return vb === null ? 0 : 1;
  if (vb === null) return -1;
  if (typeof va === 'number' && typeof vb === 'number') return va - vb;
  return String(va).localeCompare(String(vb));
}

function EncabezadoOrdenable({
  columna,
  ordenActual,
  onOrdenar,
  className,
  children,
}: {
  columna: ColumnaOrden;
  ordenActual: { columna: ColumnaOrden; direccion: DireccionOrden } | null;
  onOrdenar: (columna: ColumnaOrden) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const activa = ordenActual?.columna === columna;
  const Icono = activa ? (ordenActual!.direccion === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className={cn('px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase', className)}>
      <button type="button" onClick={() => onOrdenar(columna)} className="flex items-center gap-1 hover:text-foreground">
        {children}
        <Icono className={cn('h-3 w-3', activa ? 'text-foreground' : 'text-muted-foreground/50')} />
      </button>
    </th>
  );
}

export function AfirmacionPersonas() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const [textoInput, setTextoInput] = useState('');
  const [texto, setTexto] = useState('');
  const [pagina, setPagina] = useState(1);
  const [orden, setOrden] = useState<{ columna: ColumnaOrden; direccion: DireccionOrden } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setTexto(textoInput), 300);
    return () => clearTimeout(t);
  }, [textoInput]);
  useEffect(() => setPagina(1), [texto]);

  const { data: estadisticas, isLoading: cargandoEstadisticas } = useEstadisticasPersonasAfirmacion(iglesiaActivaId);
  const { data: estadisticasRegistro, isLoading: cargandoRegistro } = useEstadisticasRegistroAfirmacion(iglesiaActivaId);
  const { data, isLoading, isFetching } = useBuscarPersonas(iglesiaActivaId, texto, false, false, pagina);

  const resultados = useMemo(() => data?.resultados ?? [], [data]);
  const total = data?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const filasOrdenadas = useMemo(() => {
    if (!orden) return resultados;
    const signo = orden.direccion === 'asc' ? 1 : -1;
    return [...resultados].sort((a, b) => signo * comparar(a, b, orden.columna));
  }, [resultados, orden]);

  function ordenarPor(columna: ColumnaOrden) {
    setOrden((actual) => {
      if (actual?.columna !== columna) return { columna, direccion: 'asc' };
      return { columna, direccion: actual.direccion === 'asc' ? 'desc' : 'asc' };
    });
  }

  const porEstado = estadisticas?.por_estado ?? {};

  return (
    <div className="flex flex-col gap-6">
      {cargandoEstadisticas || cargandoRegistro ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiMosaico icon={Users} label="Total de personas" color={AZUL} compact>
            {estadisticas?.total ?? 0}
          </KpiMosaico>
          <KpiMosaico icon={QrCode} label="Por URL" color={MARINO} compact>
            {estadisticasRegistro?.por_url ?? 0}
          </KpiMosaico>
          <KpiMosaico icon={FileText} label="Por formulario" color={VERDE} compact>
            {estadisticasRegistro?.por_formulario ?? 0}
          </KpiMosaico>
          <KpiMosaico icon={Users} label="Creyentes" color="var(--chart-3)" compact>
            {porEstado.CRE ?? 0}
          </KpiMosaico>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader
          icon={Users}
          color={AZUL}
          titulo="Personas"
          descripcion="Todas las personas de la iglesia, ordenables y filtrables."
        />
        <div className="flex flex-col gap-4 p-5">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className={cn('pl-8', CAMPO_ESTILO)}
              placeholder="Buscar por nombre, CI o correo..."
              value={textoInput}
              onChange={(e) => setTextoInput(e.target.value)}
            />
          </div>

          {isLoading ? (
            <Skeleton className="h-96 w-full rounded-2xl" />
          ) : filasOrdenadas.length === 0 ? (
            <p className="rounded-2xl border border-border/50 bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
              {texto.trim() ? 'Sin resultados para esa búsqueda.' : 'Esta iglesia todavía no tiene personas registradas.'}
            </p>
          ) : (
            <div className={cn('overflow-x-auto rounded-xl border border-border/60 transition-opacity', isFetching && 'opacity-60')}>
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <EncabezadoOrdenable columna="nombre_completo" ordenActual={orden} onOrdenar={ordenarPor}>
                      Nombre
                    </EncabezadoOrdenable>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Sexo</th>
                    <EncabezadoOrdenable columna="edad" ordenActual={orden} onOrdenar={ordenarPor}>
                      Edad
                    </EncabezadoOrdenable>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">CI</th>
                    <EncabezadoOrdenable columna="red_nombre" ordenActual={orden} onOrdenar={ordenarPor}>
                      Red
                    </EncabezadoOrdenable>
                    <EncabezadoOrdenable columna="casa_de_paz_etiqueta" ordenActual={orden} onOrdenar={ordenarPor}>
                      Casa de Paz
                    </EncabezadoOrdenable>
                    <EncabezadoOrdenable columna="estado_sigla" ordenActual={orden} onOrdenar={ordenarPor}>
                      Estado
                    </EncabezadoOrdenable>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Teléfono</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Vía</th>
                  </tr>
                </thead>
                <tbody>
                  {filasOrdenadas.map((p) => (
                    <tr key={p.id} className="border-t border-border/50 hover:bg-muted/30">
                      <td className="px-3 py-2.5 font-medium">{p.nombre_completo}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{p.sexo === 'M' ? 'M' : 'F'}</td>
                      <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{p.edad ?? '—'}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{p.ci ?? '—'}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{p.red_nombre ?? '—'}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{p.casa_de_paz_etiqueta ?? '—'}</td>
                      <td className="px-3 py-2.5">
                        {p.estado_sigla ? (
                          <Badge variant="secondary" className="rounded-full text-[10px]">
                            {p.estado_sigla}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{p.telefono_principal ?? '—'}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{p.via_registro ? VIA_REGISTRO_LABEL[p.via_registro] : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!isLoading && filasOrdenadas.length > 0 && totalPaginas > 1 && (
            <div className="flex items-center justify-center gap-3 text-[13px]">
              <Button
                variant="outline"
                size="icon"
                className="rounded-xl"
                disabled={pagina <= 1}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                aria-label="Página anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-medium text-muted-foreground">
                {pagina} <span className="text-muted-foreground/60">de {totalPaginas}</span>
              </span>
              <Button
                variant="outline"
                size="icon"
                className="rounded-xl"
                disabled={pagina >= totalPaginas}
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                aria-label="Página siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
