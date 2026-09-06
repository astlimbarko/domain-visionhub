// VisionHub -- KAN-335 (pedido explícito del owner, 2026-09-06): "necesitamos
// que en evangelismo tambien... un boton en la barra lateral... que ahi se
// visualice toda la gente ganada y que tenga filtros arriba... paginado...
// que ahi recien haya la opcion de descargar". Mismo patrón que
// AfirmacionPersonas.tsx (KAN-216): tabla con filtros arriba + paginación +
// exportar CSV, click en fila abre la ficha completa. Para Supervisor/Pastor/
// Departamento de Evangelismo -- el Líder de Red y el Líder/Sublíder de CdP
// ya tienen su propio listado acotado en los paneles existentes.
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, FileText, Search, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KpiChip } from '@/components/dashboard/DashboardUI';
import { EVANGELISMO_COLOR } from '@/utils/evangelismo-colores';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { cn } from '@/lib/utils';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { useAuthStore } from '@/store/auth.store';
import { useCdpsIglesia, useRedes } from '@/hooks/useCasasDePaz';
import { useBuscarEvangelizados, useTiposEvangelismo } from '@/hooks/useEvangelismo';
import { buscarEvangelizados } from '@/services/evangelismo.service';
import { FichaPersonaSheet } from '@/components/personas/FichaPersonaSheet';
import { exportarPersonasEvangelizadasPdf } from '@/utils/exportarPersonasEvangelizadasPdf';
import { aISO, inicioSemanaISO, primerDiaMesRelativo, sumarDiasISO } from '@/utils/calendario-fechas';

const POR_PAGINA = 50;
// Tope razonable para una exportación completa (mismo criterio que Afirmación).
const LIMITE_EXPORTACION = 5000;

const { AZUL } = EVANGELISMO_COLOR;

// CSV con BOM (Excel en Windows no detecta UTF-8 sin esto) y comillas en
// todos los campos de texto -- mismo helper que AfirmacionPersonas.tsx.
function celdaCsv(valor: string | number | null): string {
  if (valor === null) return '';
  return `"${String(valor).replaceAll('"', '""')}"`;
}

function filasACsv(filas: { nombre_completo: string; fecha: string; red_nombre: string | null; casa_de_paz_etiqueta: string; tipo_evangelismo_nombre: string | null; telefono_principal: string | null; domicilio: string | null }[]): string {
  const encabezados = ['Nombre', 'Fecha', 'Red', 'Casa de Paz', 'Tipo', 'Teléfono', 'Domicilio'];
  const lineas = filas.map((e) =>
    [
      celdaCsv(e.nombre_completo),
      celdaCsv(e.fecha),
      celdaCsv(e.red_nombre),
      celdaCsv(e.casa_de_paz_etiqueta),
      celdaCsv(e.tipo_evangelismo_nombre),
      celdaCsv(e.telefono_principal),
      celdaCsv(e.domicilio),
    ].join(',')
  );
  return ['﻿' + encabezados.join(','), ...lineas].join('\r\n');
}

const TODAS_LAS_REDES = '__todas__';
const TODAS_LAS_CDP = '__todas__';
const TODOS_LOS_TIPOS = '__todos__';

// Filtro rápido de fechas (pedido explícito del owner, 2026-09-06) -- calcula
// desde/hasta a partir de hoy, sin tocar el resto de filtros. "Esta semana"
// y "Este mes" van hasta hoy (no hasta fin de semana/mes) para no incluir
// días futuros vacíos.
function rangoDeAtajo(atajo: string): { desde: string; hasta: string } {
  const hoy = aISO(new Date());
  switch (atajo) {
    case 'hoy':
      return { desde: hoy, hasta: hoy };
    case 'ayer': {
      const ayer = sumarDiasISO(hoy, -1);
      return { desde: ayer, hasta: ayer };
    }
    case 'semana':
      return { desde: inicioSemanaISO(hoy), hasta: hoy };
    case 'mes':
      return { desde: primerDiaMesRelativo(hoy, 0), hasta: hoy };
    default:
      return { desde: '', hasta: '' };
  }
}

const ATAJOS_FECHA: { valor: string; etiqueta: string }[] = [
  { valor: 'hoy', etiqueta: 'Hoy' },
  { valor: 'ayer', etiqueta: 'Ayer' },
  { valor: 'semana', etiqueta: 'Esta semana' },
  { valor: 'mes', etiqueta: 'Este mes' },
];

export function EvangelismoPersonas() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const iglesiaNombre = useAuthStore((s) => s.iglesias.find((i) => i.id === iglesiaActivaId)?.nombre) ?? 'Centro de Vida';
  const { data: redes = [] } = useRedes(iglesiaActivaId);
  const { data: cdps = [] } = useCdpsIglesia(iglesiaActivaId);
  const { data: tipos = [] } = useTiposEvangelismo(iglesiaActivaId);

  const [textoInput, setTextoInput] = useState('');
  const [texto, setTexto] = useState('');
  const [redId, setRedId] = useState<string>(TODAS_LAS_REDES);
  const [casaDePazId, setCasaDePazId] = useState<string>(TODAS_LAS_CDP);
  const [tipoId, setTipoId] = useState<string>(TODOS_LOS_TIPOS);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [rangoRapido, setRangoRapido] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const [personaSeleccionadaId, setPersonaSeleccionadaId] = useState<string>();
  const [exportando, setExportando] = useState(false);
  const [exportandoPdf, setExportandoPdf] = useState(false);

  function aplicarAtajoFecha(atajo: string) {
    const { desde: d, hasta: h } = rangoDeAtajo(atajo);
    setDesde(d);
    setHasta(h);
    setRangoRapido(atajo);
  }

  useEffect(() => {
    const t = setTimeout(() => setTexto(textoInput), 300);
    return () => clearTimeout(t);
  }, [textoInput]);
  useEffect(() => setPagina(1), [texto, redId, casaDePazId, tipoId, desde, hasta]);

  const redIdFiltro = redId === TODAS_LAS_REDES ? undefined : redId;
  const casaDePazIdFiltro = casaDePazId === TODAS_LAS_CDP ? undefined : casaDePazId;
  const tipoIdFiltro = tipoId === TODOS_LOS_TIPOS ? undefined : tipoId;
  const { data, isLoading, isFetching, error } = useBuscarEvangelizados(
    iglesiaActivaId,
    redIdFiltro,
    texto,
    desde || undefined,
    hasta || undefined,
    pagina,
    POR_PAGINA,
    casaDePazIdFiltro,
    tipoIdFiltro
  );

  const resultados = useMemo(() => data?.resultados ?? [], [data]);
  const total = data?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  async function exportarCsv() {
    if (!iglesiaActivaId) return;
    setExportando(true);
    try {
      const { resultados: todas } = await buscarEvangelizados(
        iglesiaActivaId,
        redIdFiltro,
        texto,
        desde || undefined,
        hasta || undefined,
        1,
        LIMITE_EXPORTACION,
        casaDePazIdFiltro,
        tipoIdFiltro
      );
      const csv = filasACsv(todas);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `evangelizados-${new Date().toISOString().slice(0, 10)}.csv`;
      enlace.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('No se pudo exportar el CSV');
    } finally {
      setExportando(false);
    }
  }

  // Descripción corta de los filtros activos para el encabezado del PDF --
  // "Todas las Casas de Paz" si no hay ninguno puesto (pedido explícito).
  const filtroDescripcion = [
    texto.trim() && `"${texto.trim()}"`,
    redIdFiltro && redes.find((r) => r.id === redIdFiltro)?.nombre,
    casaDePazIdFiltro && cdps.find((c) => c.id === casaDePazIdFiltro)?.etiqueta,
    tipoIdFiltro && tipos.find((t) => t.id === tipoIdFiltro)?.nombre,
    desde && hasta && `${desde} a ${hasta}`,
  ]
    .filter(Boolean)
    .join(' · ');

  async function exportarPdf() {
    if (!iglesiaActivaId) return;
    setExportandoPdf(true);
    try {
      const { resultados: todas } = await buscarEvangelizados(
        iglesiaActivaId,
        redIdFiltro,
        texto,
        desde || undefined,
        hasta || undefined,
        1,
        LIMITE_EXPORTACION,
        casaDePazIdFiltro,
        tipoIdFiltro
      );
      await exportarPersonasEvangelizadasPdf(todas, { iglesiaNombre, filtroDescripcion });
    } catch {
      toast.error('No se pudo exportar el PDF');
    } finally {
      setExportandoPdf(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
        <KpiChip icon={Users} label="Total encontrados" color={AZUL}>
          {total}
        </KpiChip>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader
          icon={Users}
          color={AZUL}
          titulo="Personas evangelizadas"
          descripcion="Toda la iglesia -- click en una fila para ver la ficha completa."
          accion={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" disabled={exportandoPdf || total === 0} onClick={exportarPdf}>
                <FileText className="h-3.5 w-3.5" />
                {exportandoPdf ? 'Generando...' : 'Exportar PDF'}
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" disabled={exportando || total === 0} onClick={exportarCsv}>
                <Download className="h-3.5 w-3.5" />
                {exportando ? 'Exportando...' : 'Exportar CSV'}
              </Button>
            </div>
          }
        />
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className={cn('pl-8', CAMPO_ESTILO)}
                placeholder="Buscar por nombre..."
                value={textoInput}
                onChange={(e) => setTextoInput(e.target.value)}
              />
            </div>
            <Select value={redId} onValueChange={setRedId}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Todas las Redes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS_LAS_REDES}>Todas las Redes</SelectItem>
                {redes.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={casaDePazId} onValueChange={setCasaDePazId}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Todas las Casas de Paz" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS_LAS_CDP}>Todas las Casas de Paz</SelectItem>
                {cdps.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tipoId} onValueChange={setTipoId}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Todos los tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS_LOS_TIPOS}>Todos los tipos</SelectItem>
                {/* "Semilla" es un conteo agregado sin nombres reales -- esta
                    página siempre lo excluye (ver fn_buscar_evangelizados),
                    así que no tiene sentido ofrecerlo como filtro. */}
                {tipos.filter((t) => t.codigo !== 'SEMILLA').map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                className={cn('w-[150px]', CAMPO_ESTILO)}
                value={desde}
                onChange={(e) => {
                  setDesde(e.target.value);
                  setRangoRapido(null);
                }}
                aria-label="Desde"
              />
              <span className="text-xs text-muted-foreground">a</span>
              <Input
                type="date"
                className={cn('w-[150px]', CAMPO_ESTILO)}
                value={hasta}
                onChange={(e) => {
                  setHasta(e.target.value);
                  setRangoRapido(null);
                }}
                aria-label="Hasta"
              />
            </div>
            <div className="flex gap-1.5">
              {ATAJOS_FECHA.map((a) => (
                <button
                  key={a.valor}
                  type="button"
                  onClick={() => aplicarAtajoFecha(a.valor)}
                  className={cn(
                    'rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                    rangoRapido === a.valor ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                  )}
                >
                  {a.etiqueta}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <Skeleton className="h-96 w-full rounded-2xl" />
          ) : error ? (
            <p className="rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-10 text-center text-sm text-destructive">
              No se pudo cargar el listado. Intentá de nuevo en un momento.
            </p>
          ) : resultados.length === 0 ? (
            <p className="rounded-2xl border border-border/50 bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
              {texto.trim() || redIdFiltro || casaDePazIdFiltro || tipoIdFiltro || desde || hasta ? 'Sin resultados para ese filtro.' : 'Esta iglesia todavía no tiene evangelizados registrados.'}
            </p>
          ) : (
            <div className={cn('overflow-x-auto rounded-xl border border-border/30 transition-opacity', isFetching && 'opacity-60')}>
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">#</th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Nombre</th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Fecha</th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Red</th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Casa de Paz</th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Tipo</th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Teléfono</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {resultados.map((e, i) => (
                    <tr
                      key={e.id}
                      onClick={() => setPersonaSeleccionadaId(e.persona_id)}
                      className="cursor-pointer hover:bg-muted/40"
                    >
                      <td className="px-3 py-3 text-muted-foreground tabular-nums">{(pagina - 1) * POR_PAGINA + i + 1}</td>
                      <td className="px-3 py-3 font-medium">{e.nombre_completo}</td>
                      <td className="px-3 py-3 text-muted-foreground">{e.fecha}</td>
                      <td className="px-3 py-3 text-muted-foreground">{e.red_nombre ?? '—'}</td>
                      <td className="px-3 py-3 text-muted-foreground">{e.casa_de_paz_etiqueta}</td>
                      <td className="px-3 py-3">
                        {e.tipo_evangelismo_nombre ? (
                          <Badge variant="secondary" className="rounded-full text-[10px]" style={{ backgroundColor: e.tipo_evangelismo_color ? `color-mix(in oklab, ${e.tipo_evangelismo_color} 16%, transparent)` : undefined, color: e.tipo_evangelismo_color ?? undefined }}>
                            {e.tipo_evangelismo_nombre}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{e.telefono_principal ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!isLoading && resultados.length > 0 && totalPaginas > 1 && (
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
