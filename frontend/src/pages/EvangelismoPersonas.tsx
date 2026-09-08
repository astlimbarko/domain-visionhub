// VisionHub -- KAN-335 (pedido explícito del owner, 2026-09-06): "necesitamos
// que en evangelismo tambien... un boton en la barra lateral... que ahi se
// visualice toda la gente ganada y que tenga filtros arriba... paginado...
// que ahi recien haya la opcion de descargar". Mismo patrón que
// AfirmacionPersonas.tsx (KAN-216): tabla con filtros arriba + paginación +
// exportar CSV, click en fila abre la ficha completa. Para Supervisor/Pastor/
// Departamento de Evangelismo -- el Líder de Red y el Líder/Sublíder de CdP
// ya tienen su propio listado acotado en los paneles existentes.
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, FileText, MessageCircle, Search, SlidersHorizontal, Users, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KpiChip } from '@/components/dashboard/DashboardUI';
import { EVANGELISMO_COLOR } from '@/utils/evangelismo-colores';
import { DEPARTAMENTO_META } from '@/utils/departamentos';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { cn } from '@/lib/utils';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { useAuthStore } from '@/store/auth.store';
import { useCdpsIglesia, useRedes } from '@/hooks/useCasasDePaz';
import { useBuscarEvangelizados, useTiposEvangelismo } from '@/hooks/useEvangelismo';
import { buscarEvangelizados } from '@/services/evangelismo.service';
import { FichaPersonaSheet } from '@/components/personas/FichaPersonaSheet';
import { exportarPersonasEvangelizadasPdf } from '@/utils/exportarPersonasEvangelizadasPdf';
import { EvangelismoBanner } from '@/components/evangelismo/EvangelismoBanner';
import { aISO, fechaLegible, fechaLegibleConAno, inicioSemanaISO, primerDiaMesRelativo, sumarDiasISO } from '@/utils/calendario-fechas';
import { useEsMobile } from '@/hooks/useEsMobile';

// En mobile la tarjeta ocupa mucho más alto que una fila de tabla -- pedido
// explícito del owner de acortar la página a 25 en vez de 50 para que no
// haya que scrollear tanto antes de llegar al paginador.
const POR_PAGINA = 50;
const POR_PAGINA_MOBILE = 25;
// Tope razonable para una exportación completa (mismo criterio que Afirmación).
const LIMITE_EXPORTACION = 5000;

const { AZUL } = EVANGELISMO_COLOR;

// CSV con BOM (Excel en Windows no detecta UTF-8 sin esto) y comillas en
// todos los campos de texto -- mismo helper que AfirmacionPersonas.tsx.
function celdaCsv(valor: string | number | null): string {
  if (valor === null) return '';
  return `"${String(valor).replaceAll('"', '""')}"`;
}

// Inicial para el avatar de la fila mobile -- no hay foto de persona en el sistema.
function inicialDe(nombreCompleto: string): string {
  return nombreCompleto.trim().charAt(0).toUpperCase() || '?';
}

// wa.me exige solo dígitos (sin "+", espacios ni guiones).
function soloDigitos(telefono: string): string {
  return telefono.replace(/\D/g, '');
}

/** Fila de dato de la tarjeta mobile expandida: 2 columnas reales (grid, no
 * flex justify-between) -- así el valor arranca siempre en la misma
 * posición para las 4 filas, alineado a la izquierda (más fácil de leer si
 * envuelve a 2 líneas, ej. domicilios largos), en vez de quedar pegado
 * cada uno al borde derecho según su propio largo. Mismo tamaño que la
 * fecha de arriba (`text-xs`), con "Sin registrar" cuando el valor falta
 * (no se oculta la fila). */
function FilaDato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] items-baseline gap-x-3 text-xs">
      <span className="truncate text-muted-foreground">{etiqueta}</span>
      <span className="text-foreground">{valor || <span className="text-muted-foreground italic">Sin registrar</span>}</span>
    </div>
  );
}

function filasACsv(filas: { nombre_completo: string; fecha: string; red_nombre: string | null; casa_de_paz_etiqueta: string; tipo_evangelismo_nombre: string | null; telefono_principal: string | null; domicilio: string | null; evangelizado_por_nombre: string | null }[]): string {
  const encabezados = ['Nombre', 'Fecha', 'Red', 'Casa de Paz', 'Tipo', 'Teléfono', 'Domicilio', 'Evangelizado por'];
  const lineas = filas.map((e) =>
    [
      celdaCsv(e.nombre_completo),
      celdaCsv(e.fecha),
      celdaCsv(e.red_nombre),
      celdaCsv(e.casa_de_paz_etiqueta),
      celdaCsv(e.tipo_evangelismo_nombre),
      celdaCsv(e.telefono_principal),
      celdaCsv(e.domicilio),
      celdaCsv(e.evangelizado_por_nombre),
    ].join(',')
  );
  return ['﻿' + encabezados.join(','), ...lineas].join('\r\n');
}

const TODAS_LAS_REDES = '__todas__';
const TODAS_LAS_CDP = '__todas__';
const TODOS_LOS_TIPOS = '__todos__';

// Filtro estilo Excel en el propio encabezado de columna (pedido explícito
// del owner, 2026-09-06) -- Red/Casa de Paz/Tipo ya no van en la barra
// superior, la barra superior queda solo con buscador + fechas. El trigger
// se despoja de fondo/borde/sombra para que se vea como parte del <th>.
const SELECT_ENCABEZADO =
  'h-auto w-full min-w-0 justify-start gap-1 border-none bg-transparent p-0 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase shadow-none hover:text-foreground focus-visible:ring-0 data-[state=open]:text-foreground [&>span]:truncate';

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

/** Filtro inicial que puede llegar navegando desde otra pantalla (ej. el
 * anillo "Evangelizados por Red" del dashboard) -- `navigate(ruta, { state })`. */
interface FiltroInicial {
  desde?: string;
  hasta?: string;
  casaDePazId?: string;
}

export function EvangelismoPersonas() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const iglesiaNombre = useAuthStore((s) => s.iglesias.find((i) => i.id === iglesiaActivaId)?.nombre) ?? 'Centro de Vida';
  const { data: redes = [] } = useRedes(iglesiaActivaId);
  const { data: cdps = [] } = useCdpsIglesia(iglesiaActivaId);
  const { data: tipos = [] } = useTiposEvangelismo(iglesiaActivaId);
  const location = useLocation();
  const filtroInicial = location.state as FiltroInicial | null;

  const [textoInput, setTextoInput] = useState('');
  const [texto, setTexto] = useState('');
  const [redId, setRedId] = useState<string>(TODAS_LAS_REDES);
  const [casaDePazId, setCasaDePazId] = useState<string>(filtroInicial?.casaDePazId ?? TODAS_LAS_CDP);
  const [tipoId, setTipoId] = useState<string>(TODOS_LOS_TIPOS);
  const [desde, setDesde] = useState(filtroInicial?.desde ?? '');
  const [hasta, setHasta] = useState(filtroInicial?.hasta ?? '');
  const [rangoRapido, setRangoRapido] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const [personaSeleccionadaId, setPersonaSeleccionadaId] = useState<string>();
  // Tarjeta expandida en la vista mobile -- un solo id (no un Set): pedido
  // explícito del owner de que solo pueda haber una tarjeta abierta a la vez.
  const [expandidoId, setExpandidoId] = useState<string>();
  const [exportando, setExportando] = useState(false);
  const [exportandoPdf, setExportandoPdf] = useState(false);
  const esMobile = useEsMobile();
  const porPagina = esMobile ? POR_PAGINA_MOBILE : POR_PAGINA;

  function aplicarAtajoFecha(atajo: string) {
    const { desde: d, hasta: h } = rangoDeAtajo(atajo);
    setDesde(d);
    setHasta(h);
    setRangoRapido(atajo);
  }

  // Deselecciona el atajo activo y limpia las fechas -- sin esto, una vez
  // presionado "Hoy"/etc. no había forma de volver a "sin filtro de fecha"
  // salvo borrar los inputs a mano (pedido explícito del owner).
  function limpiarFecha() {
    setDesde('');
    setHasta('');
    setRangoRapido(null);
  }

  useEffect(() => {
    const t = setTimeout(() => setTexto(textoInput), 300);
    return () => clearTimeout(t);
  }, [textoInput]);
  useEffect(() => setPagina(1), [texto, redId, casaDePazId, tipoId, desde, hasta, porPagina]);

  const redIdFiltro = redId === TODAS_LAS_REDES ? undefined : redId;
  const casaDePazIdFiltro = casaDePazId === TODAS_LAS_CDP ? undefined : casaDePazId;
  const tipoIdFiltro = tipoId === TODOS_LOS_TIPOS ? undefined : tipoId;
  // Para el badge del botón "Filtros" en mobile.
  const filtrosActivosCount = [redIdFiltro, casaDePazIdFiltro, tipoIdFiltro].filter(Boolean).length;
  const { data, isLoading, isFetching, error } = useBuscarEvangelizados(
    iglesiaActivaId,
    redIdFiltro,
    texto,
    desde || undefined,
    hasta || undefined,
    pagina,
    porPagina,
    casaDePazIdFiltro,
    tipoIdFiltro
  );

  const resultados = useMemo(() => data?.resultados ?? [], [data]);
  const total = data?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));

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
      {/* Mismo banner del dashboard principal (pedido explícito del owner,
          2026-09-06) -- ver EvangelismoBanner.tsx. */}
      <EvangelismoBanner />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
        <KpiChip icon={Users} label="Total encontrados" color={AZUL}>
          {total}
        </KpiChip>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader
          icon={Users}
          color={DEPARTAMENTO_META.EVANGELISMO.color}
          titulo="Personas evangelizadas"
          descripcion="Toda la iglesia -- click en una fila para ver la ficha completa."
          intensidad={16}
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
        <div className="flex flex-col gap-4 p-3 sm:p-5">
          <div className="flex flex-col gap-3">
            {/* Buscador + rango de fechas -- fila propia, ancho estable. Los
                atajos van en su PROPIA fila de abajo (no en esta misma línea
                con flex-wrap): el botón "quitar filtro" (X) aparece/desaparece
                según haya fecha puesta, y compartiendo fila con flex-wrap ese
                cambio de ancho hacía que el grupo de atajos saltara a una
                segunda línea al hacer clic -- pedido explícito del owner de
                que la fila de arriba no se mueva nunca. */}
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
              <div className="flex flex-wrap items-center gap-1.5 sm:flex-nowrap">
                <Input
                  type="date"
                  className={cn('w-[150px] px-2', CAMPO_ESTILO)}
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
                  className={cn('w-[150px] px-2', CAMPO_ESTILO)}
                  value={hasta}
                  onChange={(e) => {
                    setHasta(e.target.value);
                    setRangoRapido(null);
                  }}
                  aria-label="Hasta"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
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
              {(desde || hasta) && (
                <button
                  type="button"
                  onClick={limpiarFecha}
                  className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Quitar filtro de fecha"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {/* Filtros de Red/Casa de Paz/Tipo -- en desktop viven en el propio
                encabezado de la tabla (estilo Excel). En mobile NO van 3
                selects apretados en una fila (el menú desplegado de uno
                terminaba superpuesto sobre el trigger del siguiente, en
                390px cada columna queda en ~124px) -- ahora es un solo botón
                "Filtros" que abre una hoja con los 3 selects apilados, cada
                uno con su propio espacio. Mismos estados/opciones de siempre. */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="w-fit gap-1.5 sm:hidden">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filtros
                  {filtrosActivosCount > 0 && (
                    <Badge variant="secondary" className="rounded-full px-1.5 text-[10px]">
                      {filtrosActivosCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="sm:hidden">
                <SheetHeader>
                  <SheetTitle>Filtros</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-4 px-4 pb-6">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Red</span>
                    <Select value={redId} onValueChange={setRedId}>
                      <SelectTrigger className={cn('w-full', CAMPO_ESTILO)}>
                        <SelectValue placeholder="Red" />
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
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Casa de Paz</span>
                    <Select value={casaDePazId} onValueChange={setCasaDePazId}>
                      <SelectTrigger className={cn('w-full', CAMPO_ESTILO)}>
                        <SelectValue placeholder="Casa de Paz" />
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
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Tipo</span>
                    <Select value={tipoId} onValueChange={setTipoId}>
                      <SelectTrigger className={cn('w-full', CAMPO_ESTILO)}>
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={TODOS_LOS_TIPOS}>Todos los tipos</SelectItem>
                        {tipos.filter((t) => t.codigo !== 'SEMILLA').map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Antes el único indicador de "está cargando la página/filtro
              nuevo" era bajar la opacidad de la tabla al 60% -- muy sutil,
              se sentía como que la pantalla no respondía (reporte real del
              owner, 2026-09-08). Este spinner explícito es el mismo patrón
              que ya usa Evangelismo.tsx junto al mes. */}
          {isFetching && !isLoading && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Spinner className="h-3.5 w-3.5" />
              Actualizando...
            </div>
          )}

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
            <>
            <div className={cn('hidden overflow-x-auto rounded-xl border border-border/30 transition-opacity sm:block', isFetching && 'opacity-60')}>
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">#</th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Nombre</th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Fecha</th>
                    <th className="px-3 py-2">
                      <Select value={redId} onValueChange={setRedId}>
                        <SelectTrigger size="sm" className={SELECT_ENCABEZADO}>
                          <SelectValue placeholder="Red" />
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
                    </th>
                    <th className="px-3 py-2">
                      <Select value={casaDePazId} onValueChange={setCasaDePazId}>
                        <SelectTrigger size="sm" className={SELECT_ENCABEZADO}>
                          <SelectValue placeholder="Casa de Paz" />
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
                    </th>
                    <th className="px-3 py-2">
                      <Select value={tipoId} onValueChange={setTipoId}>
                        <SelectTrigger size="sm" className={SELECT_ENCABEZADO}>
                          <SelectValue placeholder="Tipo" />
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
                    </th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Teléfono</th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Evangelizado por</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {resultados.map((e, i) => (
                    <tr
                      key={e.id}
                      onClick={() => setPersonaSeleccionadaId(e.persona_id)}
                      className="cursor-pointer hover:bg-muted/40"
                    >
                      <td className="px-3 py-3 text-muted-foreground tabular-nums">{(pagina - 1) * porPagina + i + 1}</td>
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
                      <td className="px-3 py-3 text-muted-foreground">{e.evangelizado_por_nombre ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Vista mobile (< sm): la tabla de arriba obliga a scroll horizontal
                en un teléfono (min-w-[900px], 8 columnas). Acá cada persona es
                una tarjeta: arriba lo más importante siempre visible (nombre,
                fecha, teléfono como botón de WhatsApp) -- abajo el resto
                (Red/CdP/Domicilio/Evangelizado por/Tipo) contraído por
                defecto, se despliega al tocar la tarjeta. Solo una tarjeta
                puede estar desplegada a la vez (pedido explícito del owner,
                para que la lista no quede sobrecargada). Tablet/desktop (sm+)
                siguen usando la tabla de arriba sin cambios. */}
            <div className={cn('divide-y divide-border/20 rounded-xl border border-border/30 transition-opacity sm:hidden', isFetching && 'opacity-60')}>
              {resultados.map((e) => {
                const expandida = expandidoId === e.id;
                return (
                  <div key={e.id}>
                    <button
                      type="button"
                      onClick={() => setExpandidoId(expandida ? undefined : e.id)}
                      className="flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-muted/40"
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full px-0.5 text-center text-[9px] leading-none font-bold text-white"
                        style={{ backgroundColor: e.tipo_evangelismo_color ?? DEPARTAMENTO_META.EVANGELISMO.color }}
                      >
                        {e.tipo_evangelismo_nombre ?? inicialDe(e.nombre_completo)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-bold text-foreground">{e.nombre_completo}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Evangelizado: {fechaLegible(e.fecha)}</p>
                        {/* Siempre se muestra la fila de WhatsApp, con o sin teléfono -- mismo
                            criterio que "Sin registrar" en el resto de los campos: que la
                            ausencia se note, y de paso todas las filas quedan a la misma
                            altura (antes las sin teléfono tenían 2 líneas y las con teléfono 3,
                            se sentían desparejas). Sin teléfono no es clickeable ni verde. */}
                        {e.telefono_principal ? (
                          <a
                            href={`https://wa.me/${soloDigitos(e.telefono_principal)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(ev) => ev.stopPropagation()}
                            className="mt-1 flex w-fit max-w-full items-center gap-1 rounded-full bg-[#25D366]/15 px-2 py-0.5 text-xs font-semibold text-[#128C4A]"
                          >
                            <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{e.telefono_principal}</span>
                          </a>
                        ) : (
                          <span className="mt-1 flex w-fit items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground italic">
                            <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                            (vacío)
                          </span>
                        )}
                      </div>
                      {expandida ? (
                        <ChevronUp className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                    {expandida && (
                      <div className="flex flex-col gap-1.5 px-3 pb-3 pl-[3.75rem]">
                        {/* Una sola lista, mismo tratamiento visual en todas las filas
                            (etiqueta a la izquierda, valor a la derecha) -- pedido explícito
                            del owner. Todo lo que pide el formulario se muestra SIEMPRE, con
                            "Sin registrar" si falta -- que la ausencia se note, no desaparezca
                            en silencio. El tipo de evangelismo ya se ve en el avatar de
                            arriba, no se repite acá. */}
                        <FilaDato etiqueta="Domicilio" valor={e.domicilio} />
                        <FilaDato etiqueta="Sexo" valor={e.sexo === 'M' ? 'Masculino' : e.sexo === 'F' ? 'Femenino' : null} />
                        <FilaDato etiqueta="Nacimiento" valor={e.fecha_nacimiento ? fechaLegibleConAno(e.fecha_nacimiento) : null} />
                        <FilaDato etiqueta="Evangelizado por" valor={e.evangelizado_por_nombre} />
                        <FilaDato etiqueta="Red" valor={e.red_nombre} />
                        <FilaDato etiqueta="Casa de Paz" valor={e.casa_de_paz_etiqueta} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            </>
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
                Mostrando {(pagina - 1) * porPagina + 1}–{Math.min(pagina * porPagina, total)}{' '}
                <span className="text-muted-foreground/60">de {total}</span>
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
