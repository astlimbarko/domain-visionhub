// VisionHub -- plan panel Afirmación 2026-08-20, punto 3/4 (KAN-216).
// Tabla de todas las personas de la iglesia, no un dashboard: fila de KPIs
// arriba + tabla con los datos principales, ordenable (click en el header
// de columna) y filtrable por texto libre. Reusa fn_buscar_personas (ya
// existe, ahora con red_nombre y via_registro) via el hook compartido
// useBuscarPersonas -- mismo camino que ya usa pages/Personas.tsx para el
// resto de los roles.
//
// Pedido explícito del owner (2026-08-21): la tabla se queda con los datos
// principales (si mostrás todo en una sola hoja se vuelve pesado) -- click
// en una fila abre la ficha completa (FichaPersonaSheet, ya existe y se usa
// en pages/Personas.tsx). Paginación de 50 en 50, exportar a CSV, y más
// indicadores en la fila de KPIs.
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Heart,
  QrCode,
  Search,
  User,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AZUL, KpiChip, TEAL } from '@/components/dashboard/DashboardUI';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { cn } from '@/lib/utils';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { useAuthStore } from '@/store/auth.store';
import { useBuscarPersonas } from '@/hooks/usePersonas';
import { buscarPersonas } from '@/services/persona.service';
import { useEstadisticasPersonasAfirmacion, useEstadisticasRegistroAfirmacion } from '@/hooks/useAfirmacion';
import { FichaPersonaSheet } from '@/components/personas/FichaPersonaSheet';
import { ESTADO_CIVIL_LABELS, type EstadoCivil } from '@/types/persona.types';
import type { PersonaResultadoBusqueda } from '@/types/persona.types';

const POR_PAGINA = 50;
// Tope razonable para una exportación completa -- una iglesia real no tiene
// decenas de miles de miembros; evita pedir un tamaño de página ilimitado.
const LIMITE_EXPORTACION = 5000;

type ColumnaOrden = 'nombre_completo' | 'sexo' | 'edad' | 'red_nombre' | 'casa_de_paz_etiqueta' | 'estado_sigla';
type DireccionOrden = 'asc' | 'desc';

const VIA_REGISTRO_LABEL: Record<'URL' | 'FORMULARIO', string> = {
  URL: 'URL',
  FORMULARIO: 'Formulario',
};

const ESTADO_LABEL: Record<string, string> = {
  SIM: 'Simpatizantes',
  NC: 'Nuevos Convertidos',
  CRE: 'Creyentes',
  RE: 'Reconciliados',
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

// CSV con BOM (Excel en Windows no detecta UTF-8 sin esto -- tildes/ñ salían
// mal) y comillas en todos los campos de texto para no romperse con comas.
function celdaCsv(valor: string | number | null): string {
  if (valor === null) return '';
  return `"${String(valor).replaceAll('"', '""')}"`;
}

function filasACsv(filas: PersonaResultadoBusqueda[]): string {
  const encabezados = ['Nombre', 'Sexo', 'Edad', 'CI', 'Correo', 'Red', 'Casa de Paz', 'Estado', 'Teléfono', 'Vía'];
  const lineas = filas.map((p) =>
    [
      celdaCsv(p.nombre_completo),
      celdaCsv(p.sexo === 'M' ? 'Masculino' : 'Femenino'),
      celdaCsv(p.edad),
      celdaCsv(p.ci),
      celdaCsv(p.correo),
      celdaCsv(p.red_nombre),
      celdaCsv(p.casa_de_paz_etiqueta),
      celdaCsv(p.estado_sigla),
      celdaCsv(p.telefono_principal),
      celdaCsv(p.via_registro ? VIA_REGISTRO_LABEL[p.via_registro] : null),
    ].join(',')
  );
  return ['﻿' + encabezados.join(','), ...lineas].join('\r\n');
}

export function AfirmacionPersonas() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const [textoInput, setTextoInput] = useState('');
  const [texto, setTexto] = useState('');
  const [pagina, setPagina] = useState(1);
  const [orden, setOrden] = useState<{ columna: ColumnaOrden; direccion: DireccionOrden } | null>(null);
  const [personaSeleccionadaId, setPersonaSeleccionadaId] = useState<string>();
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTexto(textoInput), 300);
    return () => clearTimeout(t);
  }, [textoInput]);
  useEffect(() => setPagina(1), [texto]);

  const { data: estadisticas, isLoading: cargandoEstadisticas } = useEstadisticasPersonasAfirmacion(iglesiaActivaId);
  const { data: estadisticasRegistro, isLoading: cargandoRegistro } = useEstadisticasRegistroAfirmacion(iglesiaActivaId);
  const { data, isLoading, isFetching } = useBuscarPersonas(iglesiaActivaId, texto, false, false, pagina, POR_PAGINA);

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

  async function exportarCsv() {
    if (!iglesiaActivaId) return;
    setExportando(true);
    try {
      const { resultados: todas } = await buscarPersonas(iglesiaActivaId, texto, false, false, 1, LIMITE_EXPORTACION);
      const csv = filasACsv(todas);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `personas-${new Date().toISOString().slice(0, 10)}.csv`;
      enlace.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('No se pudo exportar el CSV');
    } finally {
      setExportando(false);
    }
  }

  const porEstado = estadisticas?.por_estado ?? {};
  const porEstadoCivil = estadisticas?.por_estado_civil ?? {};

  return (
    <div className="flex flex-col gap-6">
      {cargandoEstadisticas || cargandoRegistro ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 14 }).map((_, i) => (
            <Skeleton key={i} className="h-[54px] w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          <KpiChip icon={Users} label="Total" color={AZUL}>
            {estadisticas?.total ?? 0}
          </KpiChip>
          <KpiChip icon={User} label="Hombres" color={AZUL}>
            {estadisticas?.hombres ?? 0}
          </KpiChip>
          <KpiChip icon={User} label="Mujeres" color={TEAL}>
            {estadisticas?.mujeres ?? 0}
          </KpiChip>
          <KpiChip icon={QrCode} label="Por URL" color={AZUL}>
            {estadisticasRegistro?.por_url ?? 0}
          </KpiChip>
          <KpiChip icon={FileText} label="Por formulario" color={TEAL}>
            {estadisticasRegistro?.por_formulario ?? 0}
          </KpiChip>
          {(['SIM', 'NC', 'CRE', 'RE'] as const).map((sigla) => (
            <KpiChip key={sigla} icon={Users} label={ESTADO_LABEL[sigla]} color={AZUL}>
              {porEstado[sigla] ?? 0}
            </KpiChip>
          ))}
          <KpiChip icon={Briefcase} label="Con profesión" color={TEAL}>
            {estadisticas?.con_profesion ?? 0}
          </KpiChip>
          {(Object.keys(ESTADO_CIVIL_LABELS) as EstadoCivil[]).map((codigo) => (
            <KpiChip key={codigo} icon={Heart} label={ESTADO_CIVIL_LABELS[codigo]} color={AZUL}>
              {porEstadoCivil[codigo] ?? 0}
            </KpiChip>
          ))}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader
          icon={Users}
          color={AZUL}
          titulo="Personas"
          descripcion="Datos principales -- click en una fila para ver la ficha completa."
          accion={
            <Button variant="outline" size="sm" className="gap-1.5" disabled={exportando || total === 0} onClick={exportarCsv}>
              <Download className="h-3.5 w-3.5" />
              {exportando ? 'Exportando...' : 'Exportar CSV'}
            </Button>
          }
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
                    <EncabezadoOrdenable columna="sexo" ordenActual={orden} onOrdenar={ordenarPor}>
                      Sexo
                    </EncabezadoOrdenable>
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
                    <tr
                      key={p.id}
                      onClick={() => setPersonaSeleccionadaId(p.id)}
                      className="cursor-pointer border-t border-border/50 hover:bg-muted/40"
                    >
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

      <FichaPersonaSheet personaId={personaSeleccionadaId} onOpenChange={(open) => !open && setPersonaSeleccionadaId(undefined)} />
    </div>
  );
}
