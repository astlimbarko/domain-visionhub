// VisionHub -- plan panel Afirmación 2026-08-20, punto 3/4 (KAN-216).
// Tabla de Membresía de la iglesia (renombrada de "Personas" -- pedido
// explícito del owner, 2026-09-10, es la membresía real): fila de KPIs
// arriba + tabla, ordenable (click en el header de columna) y filtrable
// por texto libre + Red/Casa de Paz (filtro server-side en el propio
// encabezado, mismo patrón que Evangelismo). Paginación de 50 en 50,
// exportar a CSV.
//
// KAN-358 seguimiento (2026-09-10): la tabla original solo mostraba
// identidad básica -- se sumaron campos reales del censo (estado civil,
// rango de miembro, bautizado, y Líder/Sublíder de CdP y Red INFERIDOS de
// los cargos reales, no autodeclarados) vía fn_afirmacion_buscar_membresia.
// Los campos de lista larga (discipulados, seminario/universidad, mentor,
// cónyuge, familia, ministerios) quedan para la ficha de detalle
// (FichaPersonaSheet, al hacer click en una fila) y el futuro PDF completo,
// no para esta tabla -- 25+ columnas de golpe la harían inusable.
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AZUL, KpiChip, TEAL, VERDE } from '@/components/dashboard/DashboardUI';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { CeldaTelefono } from '@/components/shared/CeldaTelefono';
import { cn } from '@/lib/utils';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { useAuthStore } from '@/store/auth.store';
import { useRedes, useCdpsIglesia } from '@/hooks/useCasasDePaz';
import { useBuscarMembresiaAfirmacion, useEstados, useEstadisticasPersonasAfirmacion, useEstadisticasRegistroAfirmacion } from '@/hooks/useAfirmacion';
import { buscarMembresiaAfirmacion } from '@/services/afirmacion.service';
import { FichaPersonaSheet } from '@/components/personas/FichaPersonaSheet';
import { ESTADO_CIVIL_LABELS, type EstadoCivil } from '@/types/persona.types';
import { OPCIONES_RANGO_MIEMBRO } from '@/types/membresia-extendida.types';
import type { MembresiaResultadoBusqueda } from '@/types/persona.types';
import { exportarMembresiaAfirmacionPdf, type FilaMembresiaPdf } from '@/utils/exportarMembresiaAfirmacionPdf';

const POR_PAGINA = 50;
// Tope razonable para una exportación completa -- una iglesia real no tiene
// decenas de miles de miembros; evita pedir un tamaño de página ilimitado.
const LIMITE_EXPORTACION = 5000;
const TODAS_LAS_REDES = '__todas__';
const TODAS_LAS_CDP = '__todas__';
const TODOS_LOS_ESTADOS = '__todos__';

// Mismo patrón "filtro en el propio encabezado" que ya usa Evangelismo
// (KAN-358 seguimiento, 2026-09-10) -- Red/Casa de Paz pasan de columna
// ordenable a columna con Select filtro, server-side (necesario porque
// la paginación es server-side, un filtro client-side solo vería la
// página actual).
const SELECT_ENCABEZADO =
  'h-auto w-full min-w-0 justify-start gap-1 border-none bg-transparent p-0 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase shadow-none hover:text-foreground focus-visible:ring-0 data-[state=open]:text-foreground [&>span]:truncate';

type ColumnaOrden =
  | 'nombre_completo'
  | 'sexo'
  | 'edad'
  | 'membresia_completada';
type DireccionOrden = 'asc' | 'desc';

const VIA_REGISTRO_LABEL: Record<'URL' | 'FORMULARIO', string> = {
  URL: 'URL',
  FORMULARIO: 'Formulario',
};

const RANGO_MIEMBRO_LABEL: Record<string, string> = Object.fromEntries(
  OPCIONES_RANGO_MIEMBRO.map((o) => [o.value, o.label])
);

const ESTADO_LABEL: Record<string, string> = {
  SIM: 'Simpatizantes',
  NC: 'Nuevos Convertidos',
  CRE: 'Creyentes',
  RE: 'Reconciliados',
};

function comparar(a: MembresiaResultadoBusqueda, b: MembresiaResultadoBusqueda, columna: ColumnaOrden) {
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

// Mismo mapper que Evangelismo (aFilaExportacion) -- valores ya formateados
// para el PDF, índice real (respeta la posición dentro del total exportado,
// no solo de la página actual).
function aFilaExportacion(p: MembresiaResultadoBusqueda, i: number): FilaMembresiaPdf {
  return {
    numero: i + 1,
    nombre_completo: p.nombre_completo,
    sexo: p.sexo === 'M' ? 'M' : 'F',
    edad: p.edad != null ? String(p.edad) : '—',
    ci: p.ci ?? '—',
    red_nombre: p.red_nombre ?? '—',
    casa_de_paz_etiqueta: p.casa_de_paz_etiqueta ?? '—',
    estado_sigla: p.estado_sigla ?? '—',
    telefono_principal: p.telefono_principal ?? '—',
    via_registro: p.via_registro ? VIA_REGISTRO_LABEL[p.via_registro] : '—',
    membresia: p.membresia_completada ? 'Completa' : 'Incompleta',
    estado_civil: p.estado_civil ? ESTADO_CIVIL_LABELS[p.estado_civil] : '—',
    rango_miembro: p.rango_miembro ? RANGO_MIEMBRO_LABEL[p.rango_miembro] : '—',
    bautizado: p.bautizado ? 'Sí' : 'No',
    cargo_cdp: p.es_lider_cdp ? 'Líder' : p.es_sublider_cdp ? 'Sublíder' : '—',
    cargo_red: p.es_lider_red ? 'Líder' : p.es_sublider_red ? 'Sublíder' : '—',
  };
}

// CSV con BOM (Excel en Windows no detecta UTF-8 sin esto -- tildes/ñ salían
// mal) y comillas en todos los campos de texto para no romperse con comas.
function celdaCsv(valor: string | number | null): string {
  if (valor === null) return '';
  return `"${String(valor).replaceAll('"', '""')}"`;
}

function filasACsv(filas: MembresiaResultadoBusqueda[]): string {
  const encabezados = [
    '#',
    'Nombre',
    'Sexo',
    'Edad',
    'CI',
    'Correo',
    'Red',
    'Casa de Paz',
    'Estado',
    'Teléfono',
    'Vía',
    'Membresía',
    'Estado civil',
    'Rango de miembro',
    'Bautizado',
    'Líder de CdP',
    'Sublíder de CdP',
    'Líder de Red',
    'Sublíder de Red',
  ];
  const lineas = filas.map((p, i) =>
    [
      celdaCsv(i + 1),
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
      celdaCsv(p.membresia_completada ? 'Completa' : 'Incompleta'),
      celdaCsv(p.estado_civil ? ESTADO_CIVIL_LABELS[p.estado_civil] : null),
      celdaCsv(p.rango_miembro ? RANGO_MIEMBRO_LABEL[p.rango_miembro] : null),
      celdaCsv(p.bautizado ? 'Sí' : 'No'),
      celdaCsv(p.es_lider_cdp ? 'Sí' : 'No'),
      celdaCsv(p.es_sublider_cdp ? 'Sí' : 'No'),
      celdaCsv(p.es_lider_red ? 'Sí' : 'No'),
      celdaCsv(p.es_sublider_red ? 'Sí' : 'No'),
    ].join(',')
  );
  return ['﻿' + encabezados.join(','), ...lineas].join('\r\n');
}

export function AfirmacionPersonas() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const [textoInput, setTextoInput] = useState('');
  const [texto, setTexto] = useState('');
  const [redId, setRedId] = useState<string>(TODAS_LAS_REDES);
  const [casaDePazId, setCasaDePazId] = useState<string>(TODAS_LAS_CDP);
  const [estadoId, setEstadoId] = useState<string>(TODOS_LOS_ESTADOS);
  const [pagina, setPagina] = useState(1);
  const [orden, setOrden] = useState<{ columna: ColumnaOrden; direccion: DireccionOrden } | null>(null);
  const [personaSeleccionadaId, setPersonaSeleccionadaId] = useState<string>();
  const [exportando, setExportando] = useState(false);
  const [exportandoPdf, setExportandoPdf] = useState(false);

  const iglesiaNombre = useAuthStore((s) => s.iglesias.find((i) => i.id === iglesiaActivaId)?.nombre) ?? 'Centro de Vida';

  const { data: redes = [] } = useRedes(iglesiaActivaId);
  const { data: cdps = [] } = useCdpsIglesia(iglesiaActivaId);
  const { data: estados = [] } = useEstados();

  useEffect(() => {
    const t = setTimeout(() => setTexto(textoInput), 300);
    return () => clearTimeout(t);
  }, [textoInput]);
  useEffect(() => setPagina(1), [texto, redId, casaDePazId, estadoId]);

  const redIdFiltro = redId === TODAS_LAS_REDES ? undefined : redId;
  const casaDePazIdFiltro = casaDePazId === TODAS_LAS_CDP ? undefined : casaDePazId;
  const estadoIdFiltro = estadoId === TODOS_LOS_ESTADOS ? undefined : estadoId;

  const { data: estadisticas, isLoading: cargandoEstadisticas } = useEstadisticasPersonasAfirmacion(iglesiaActivaId);
  const { data: estadisticasRegistro, isLoading: cargandoRegistro } = useEstadisticasRegistroAfirmacion(iglesiaActivaId);
  // Afirmación es membresía real -- las "Semilla" son personas de conteo de
  // Evangelismo sin datos reales (ver Personas.tsx, mismo criterio), nunca
  // deben aparecer acá sin importar el rol (KAN-358 seguimiento, 2026-09-10,
  // hallazgo del owner probando en vivo). fn_afirmacion_buscar_membresia ya
  // excluye Semillas siempre (no hace falta pasar el flag).
  const { data, isLoading, isFetching } = useBuscarMembresiaAfirmacion(
    iglesiaActivaId,
    texto,
    pagina,
    POR_PAGINA,
    redIdFiltro,
    casaDePazIdFiltro,
    estadoIdFiltro
  );

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
      const { resultados: todas } = await buscarMembresiaAfirmacion(iglesiaActivaId, texto, 1, LIMITE_EXPORTACION, redIdFiltro, casaDePazIdFiltro, estadoIdFiltro);
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

  // Mismo criterio que Evangelismo: descripción corta de los filtros activos
  // para el encabezado del PDF.
  const filtroDescripcion = [
    texto.trim() && `"${texto.trim()}"`,
    redIdFiltro && redes.find((r) => r.id === redIdFiltro)?.nombre,
    casaDePazIdFiltro && cdps.find((c) => c.id === casaDePazIdFiltro)?.etiqueta,
    estadoIdFiltro && estados.find((e) => e.id === estadoIdFiltro)?.nombre,
  ]
    .filter(Boolean)
    .join(' · ');

  async function exportarPdf() {
    if (!iglesiaActivaId) return;
    setExportandoPdf(true);
    try {
      const { resultados: todas } = await buscarMembresiaAfirmacion(iglesiaActivaId, texto, 1, LIMITE_EXPORTACION, redIdFiltro, casaDePazIdFiltro, estadoIdFiltro);
      await exportarMembresiaAfirmacionPdf(todas.map(aFilaExportacion), { iglesiaNombre, filtroDescripcion });
    } catch {
      toast.error('No se pudo exportar el PDF');
    } finally {
      setExportandoPdf(false);
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
          titulo="Membresía"
          descripcion="Datos principales -- click en una fila para ver la ficha completa."
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
              <table className="w-full min-w-[1400px] border-collapse text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">#</th>
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
                    <th className="px-2 py-2">
                      {/* Filtro server-side en el propio encabezado (KAN-358
                          seguimiento) -- mismo patrón que Evangelismo, necesario
                          porque la paginación es server-side. */}
                      <Select value={redId} onValueChange={setRedId}>
                        <SelectTrigger size="sm" className={cn(SELECT_ENCABEZADO, 'justify-start')}>
                          <SelectValue placeholder="Red" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={TODAS_LAS_REDES}>Red</SelectItem>
                          {redes.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </th>
                    <th className="px-2 py-2">
                      <Select value={casaDePazId} onValueChange={setCasaDePazId}>
                        <SelectTrigger size="sm" className={cn(SELECT_ENCABEZADO, 'justify-start')}>
                          <SelectValue placeholder="Casa de Paz" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={TODAS_LAS_CDP}>Casa de Paz</SelectItem>
                          {cdps.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.etiqueta}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </th>
                    <th className="px-2 py-2">
                      <Select value={estadoId} onValueChange={setEstadoId}>
                        <SelectTrigger size="sm" className={cn(SELECT_ENCABEZADO, 'justify-start')}>
                          <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={TODOS_LOS_ESTADOS}>Estado</SelectItem>
                          {estados.map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Teléfono</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Vía</th>
                    <EncabezadoOrdenable columna="membresia_completada" ordenActual={orden} onOrdenar={ordenarPor}>
                      Membresía
                    </EncabezadoOrdenable>
                    {/* Campos reales del censo (KAN-358 seguimiento, pedido
                        explícito del owner: hoy solo se veían datos básicos de
                        identidad). Líder/Sublíder de CdP y Red son INFERIDOS de
                        los cargos reales (casa_de_paz_cargo/red_cargo), no
                        autodeclarados -- si alguien es Líder de CdP el sistema
                        ya lo sabe, no hace falta que lo tilde en el censo. */}
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Estado civil</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Rango</th>
                    <th className="px-3 py-2.5 text-center text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Bautizado</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Cargo CdP</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Cargo Red</th>
                  </tr>
                </thead>
                <tbody>
                  {filasOrdenadas.map((p, i) => {
                    const nombreLinea1 = [p.primer_nombre, p.segundo_nombre].filter(Boolean).join(' ');
                    const nombreLinea2 = [p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' ');
                    const cargoCdp = p.es_lider_cdp ? 'Líder' : p.es_sublider_cdp ? 'Sublíder' : null;
                    const cargoRed = p.es_lider_red ? 'Líder' : p.es_sublider_red ? 'Sublíder' : null;
                    return (
                      <tr
                        key={p.id}
                        onClick={() => setPersonaSeleccionadaId(p.id)}
                        className="cursor-pointer border-t border-border/50 hover:bg-muted/40"
                      >
                        <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{(pagina - 1) * POR_PAGINA + i + 1}</td>
                        <td className="px-3 py-2.5 leading-tight font-medium">
                          <p className="truncate">{nombreLinea1 || p.nombre_completo}</p>
                          {nombreLinea2 && <p className="truncate text-xs font-normal text-muted-foreground">{nombreLinea2}</p>}
                        </td>
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
                        <td className="px-3 py-2.5 text-muted-foreground">
                          <CeldaTelefono telefono={p.telefono_principal} />
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{p.via_registro ? VIA_REGISTRO_LABEL[p.via_registro] : '—'}</td>
                        <td className="px-3 py-2.5">
                          {p.membresia_completada ? (
                            <Badge variant="secondary" className="gap-1 rounded-full text-[10px]">
                              <CircleCheck className="h-3 w-3" style={{ color: VERDE }} />
                              Completa
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 rounded-full text-[10px] text-muted-foreground">
                              <CircleAlert className="h-3 w-3" />
                              Incompleta
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{p.estado_civil ? ESTADO_CIVIL_LABELS[p.estado_civil] : '—'}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{p.rango_miembro ? RANGO_MIEMBRO_LABEL[p.rango_miembro] : '—'}</td>
                        <td className="px-3 py-2.5 text-center">
                          {p.bautizado ? <CircleCheck className="mx-auto h-4 w-4" style={{ color: VERDE }} /> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{cargoCdp ?? '—'}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{cargoRed ?? '—'}</td>
                      </tr>
                    );
                  })}
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
