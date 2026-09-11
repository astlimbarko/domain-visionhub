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
//
// Vista ampliada (2026-09-11, pedido explícito del owner): la vista
// reducida de arriba se mantiene como default -- botón "Vista ampliada"
// suma el resto del censo (discipulados, seminario/universidad, mentor,
// bautismo detallado, cónyuge, familia, ministerios, Efesio, cargos
// autodeclarados). Solo la tabla se desborda de ancho (scroll horizontal
// propio) -- KPIs/filtros/buscador quedan fuera del contenedor con
// overflow. CSV y PDF respetan la vista activa.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
  type LucideIcon,
  Maximize2,
  Minimize2,
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
import { AZUL, TEAL, VERDE } from '@/components/dashboard/DashboardUI';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { CeldaTelefono } from '@/components/shared/CeldaTelefono';
import { cn } from '@/lib/utils';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { useAuthStore } from '@/store/auth.store';
import { useRedes, useCdpsIglesia } from '@/hooks/useCasasDePaz';
import { useBuscarMembresiaAfirmacion, useEstados, useEstadisticasPersonasAfirmacion, useEstadisticasRegistroAfirmacion } from '@/hooks/useAfirmacion';
import { buscarMembresiaAfirmacion, type FiltrosMembresiaAfirmacion } from '@/services/afirmacion.service';
import { FichaPersonaSheet } from '@/components/personas/FichaPersonaSheet';
import { ESTADO_CIVIL_LABELS, type EstadoCivil } from '@/types/persona.types';
import { OPCIONES_EFESIO, OPCIONES_RANGO_MIEMBRO } from '@/types/membresia-extendida.types';
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

const EFESIO_LABEL: Record<string, string> = Object.fromEntries(OPCIONES_EFESIO.map((o) => [o.value, o.label]));

// Vista ampliada (2026-09-11): helpers para combinar los campos del censo
// que llegan sueltos de la RPC en un solo texto legible por celda -- evita
// sumar el doble de columnas (ej. fecha + "en nuestra iglesia" en una sola
// celda "Bautismo").
function formatFechaParcial(anio: number | null, mes: number | null, dia: number | null): string | null {
  if (!anio) return null;
  if (dia && mes) return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`;
  if (mes) return `${String(mes).padStart(2, '0')}/${anio}`;
  return String(anio);
}

function formatBautismo(p: MembresiaResultadoBusqueda): string {
  if (!p.bautizado) return 'No';
  const fecha = formatFechaParcial(p.bautismo_anio, p.bautismo_mes, p.bautismo_dia);
  const partes = [fecha, p.bautizado_en_nuestra_iglesia ? 'en esta iglesia' : null].filter(Boolean);
  return partes.length > 0 ? partes.join(' · ') : 'Sí';
}

function formatMentor(p: MembresiaResultadoBusqueda): string | null {
  if (!p.mentor_nombre) return null;
  return p.mentor_es_miembro ? `${p.mentor_nombre} (miembro)` : p.mentor_nombre;
}

// Pedido explícito del owner (2026-09-11): fecha de nacimiento visible en
// vista ampliada (formato corto DD/MM/AA, ej. 23/08/93) -- vista reducida
// sigue mostrando solo la Edad ya calculada, sin cambios.
function formatFechaNacimiento(fecha: string | null): string {
  if (!fecha) return '—';
  const d = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const aa = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${aa}`;
}

// Variante local de KpiChip (DashboardUI.tsx) -- clickeable, con estado
// activo (pedido explícito del owner 2026-09-11: "todos los botones de
// arriba de membresia sean botones de filtro"). No se modifica el
// KpiChip compartido para no arriesgar el resto de la app -- esta
// variante solo vive en esta página.
function KpiChipFiltro({
  icon: Icon,
  label,
  color,
  activo,
  onClick,
  children,
}: {
  icon: LucideIcon;
  label: string;
  color: string;
  activo: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={activo ? { boxShadow: `0 0 0 2px ${color}` } : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5 text-left shadow-sm transition-colors',
        activo ? 'border-transparent' : 'border-border/60 hover:border-border'
      )}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ background: `color-mix(in oklab, ${color} ${activo ? '28%' : '14%'}, transparent)`, color }}
      >
        <Icon className="h-4 w-4" strokeWidth={2.2} />
      </span>
      <div className="min-w-0">
        <div className="text-base leading-none font-bold tracking-tight tabular-nums text-foreground">{children}</div>
        <p className="mt-0.5 truncate text-[10.5px] font-medium text-muted-foreground">{label}</p>
      </div>
    </button>
  );
}

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
    fecha_nacimiento: formatFechaNacimiento(p.fecha_nacimiento),
    discipulados: p.discipulados ?? '—',
    seminario: p.seminario ? 'Sí' : 'No',
    universidad_rey_jesus: p.universidad_rey_jesus ? 'Sí' : 'No',
    bautismo_detalle: formatBautismo(p),
    mentor: formatMentor(p) ?? '—',
    conyuge: p.conyuge_nombre ?? '—',
    familiares: p.familiares ?? '—',
    ministerios: p.ministerios ?? '—',
    efesio: p.efesio_tipo ? (EFESIO_LABEL[p.efesio_tipo] ?? p.efesio_tipo) : '—',
    cargos_censo: p.cargos_censo ?? '—',
  };
}

// CSV con BOM (Excel en Windows no detecta UTF-8 sin esto -- tildes/ñ salían
// mal) y comillas en todos los campos de texto para no romperse con comas.
function celdaCsv(valor: string | number | null): string {
  if (valor === null) return '';
  return `"${String(valor).replaceAll('"', '""')}"`;
}

function filasACsv(filas: MembresiaResultadoBusqueda[], vistaAmpliada: boolean): string {
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
    ...(vistaAmpliada
      ? [
          'Nacimiento',
          'Discipulados',
          'Seminario',
          'Universidad Rey Jesús',
          'Bautismo (detalle)',
          'Mentor',
          'Cónyuge',
          'Familiares',
          'Ministerios',
          'Efesio',
          'Cargos (censo)',
        ]
      : []),
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
      ...(vistaAmpliada
        ? [
            celdaCsv(formatFechaNacimiento(p.fecha_nacimiento)),
            celdaCsv(p.discipulados),
            celdaCsv(p.seminario ? 'Sí' : 'No'),
            celdaCsv(p.universidad_rey_jesus ? 'Sí' : 'No'),
            celdaCsv(formatBautismo(p)),
            celdaCsv(formatMentor(p)),
            celdaCsv(p.conyuge_nombre),
            celdaCsv(p.familiares),
            celdaCsv(p.ministerios),
            celdaCsv(p.efesio_tipo ? (EFESIO_LABEL[p.efesio_tipo] ?? p.efesio_tipo) : null),
            celdaCsv(p.cargos_censo),
          ]
        : []),
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
  // KAN seguimiento (2026-09-11): tarjetas de KPI convertidas en botones de
  // filtro -- cada una alterna su propio estado (toggle: click de nuevo lo
  // apaga), combinable con Red/Casa de Paz/Estado del encabezado.
  const [sexoFiltro, setSexoFiltro] = useState<'M' | 'F'>();
  const [viaFiltro, setViaFiltro] = useState<'URL' | 'FORMULARIO'>();
  const [conProfesionFiltro, setConProfesionFiltro] = useState<boolean>();
  const [estadoCivilFiltro, setEstadoCivilFiltro] = useState<EstadoCivil>();
  const [bautizadoFiltro, setBautizadoFiltro] = useState<boolean>();
  const [pagina, setPagina] = useState(1);
  const [orden, setOrden] = useState<{ columna: ColumnaOrden; direccion: DireccionOrden } | null>(null);
  const [personaSeleccionadaId, setPersonaSeleccionadaId] = useState<string>();
  const [exportando, setExportando] = useState(false);
  const [exportandoPdf, setExportandoPdf] = useState(false);
  // Vista ampliada (2026-09-11, pedido explícito del owner): vista reducida
  // (default) muestra los datos principales; ampliada suma TODO el censo --
  // se espera que la tabla se desborde de ancho (scroll horizontal propio,
  // no afecta a los KPIs/filtros/buscador de arriba). CSV/PDF respetan la
  // vista activa.
  const [vistaAmpliada, setVistaAmpliada] = useState(false);

  const iglesiaNombre = useAuthStore((s) => s.iglesias.find((i) => i.id === iglesiaActivaId)?.nombre) ?? 'Centro de Vida';

  const { data: redes = [] } = useRedes(iglesiaActivaId);
  const { data: cdps = [] } = useCdpsIglesia(iglesiaActivaId);
  const { data: estados = [] } = useEstados();

  useEffect(() => {
    const t = setTimeout(() => setTexto(textoInput), 300);
    return () => clearTimeout(t);
  }, [textoInput]);
  useEffect(
    () => setPagina(1),
    [texto, redId, casaDePazId, estadoId, sexoFiltro, viaFiltro, conProfesionFiltro, estadoCivilFiltro, bautizadoFiltro]
  );

  const redIdFiltro = redId === TODAS_LAS_REDES ? undefined : redId;
  const casaDePazIdFiltro = casaDePazId === TODAS_LAS_CDP ? undefined : casaDePazId;
  const estadoIdFiltro = estadoId === TODOS_LOS_ESTADOS ? undefined : estadoId;

  const filtros: FiltrosMembresiaAfirmacion = useMemo(
    () => ({
      redId: redIdFiltro,
      casaDePazId: casaDePazIdFiltro,
      estadoId: estadoIdFiltro,
      sexo: sexoFiltro,
      viaRegistro: viaFiltro,
      conProfesion: conProfesionFiltro,
      estadoCivil: estadoCivilFiltro,
      bautizado: bautizadoFiltro,
    }),
    [redIdFiltro, casaDePazIdFiltro, estadoIdFiltro, sexoFiltro, viaFiltro, conProfesionFiltro, estadoCivilFiltro, bautizadoFiltro]
  );

  const sinFiltros =
    !redIdFiltro &&
    !casaDePazIdFiltro &&
    !estadoIdFiltro &&
    !sexoFiltro &&
    !viaFiltro &&
    !conProfesionFiltro &&
    !estadoCivilFiltro &&
    !bautizadoFiltro;

  function limpiarFiltros() {
    setRedId(TODAS_LAS_REDES);
    setCasaDePazId(TODAS_LAS_CDP);
    setEstadoId(TODOS_LOS_ESTADOS);
    setSexoFiltro(undefined);
    setViaFiltro(undefined);
    setConProfesionFiltro(undefined);
    setEstadoCivilFiltro(undefined);
    setBautizadoFiltro(undefined);
  }

  function alternarEstadoPorSigla(sigla: string) {
    const estado = estados.find((e) => e.sigla === sigla);
    if (!estado) return;
    setEstadoId((actual) => (actual === estado.id ? TODOS_LOS_ESTADOS : estado.id));
  }

  const { data: estadisticas, isLoading: cargandoEstadisticas } = useEstadisticasPersonasAfirmacion(iglesiaActivaId);
  const { data: estadisticasRegistro, isLoading: cargandoRegistro } = useEstadisticasRegistroAfirmacion(iglesiaActivaId);
  // Afirmación es membresía real -- las "Semilla" son personas de conteo de
  // Evangelismo sin datos reales (ver Personas.tsx, mismo criterio), nunca
  // deben aparecer acá sin importar el rol (KAN-358 seguimiento, 2026-09-10,
  // hallazgo del owner probando en vivo). fn_afirmacion_buscar_membresia ya
  // excluye Semillas siempre (no hace falta pasar el flag).
  const { data, isLoading, isFetching } = useBuscarMembresiaAfirmacion(iglesiaActivaId, texto, pagina, POR_PAGINA, filtros);

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
      const { resultados: todas } = await buscarMembresiaAfirmacion(iglesiaActivaId, texto, 1, LIMITE_EXPORTACION, filtros);
      const csv = filasACsv(todas, vistaAmpliada);
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
    sexoFiltro && (sexoFiltro === 'M' ? 'Hombres' : 'Mujeres'),
    viaFiltro && VIA_REGISTRO_LABEL[viaFiltro],
    conProfesionFiltro && 'Con profesión',
    estadoCivilFiltro && ESTADO_CIVIL_LABELS[estadoCivilFiltro],
    bautizadoFiltro && 'Bautizados',
  ]
    .filter(Boolean)
    .join(' · ');

  async function exportarPdf() {
    if (!iglesiaActivaId) return;
    setExportandoPdf(true);
    try {
      const { resultados: todas } = await buscarMembresiaAfirmacion(iglesiaActivaId, texto, 1, LIMITE_EXPORTACION, filtros);
      await exportarMembresiaAfirmacionPdf(todas.map(aFilaExportacion), { iglesiaNombre, filtroDescripcion, vistaAmpliada });
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
          {Array.from({ length: 15 }).map((_, i) => (
            <Skeleton key={i} className="h-[54px] w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          <KpiChipFiltro icon={Users} label="Total" color={AZUL} activo={sinFiltros} onClick={limpiarFiltros}>
            {estadisticas?.total ?? 0}
          </KpiChipFiltro>
          <KpiChipFiltro
            icon={User}
            label="Hombres"
            color={AZUL}
            activo={sexoFiltro === 'M'}
            onClick={() => setSexoFiltro((actual) => (actual === 'M' ? undefined : 'M'))}
          >
            {estadisticas?.hombres ?? 0}
          </KpiChipFiltro>
          <KpiChipFiltro
            icon={User}
            label="Mujeres"
            color={TEAL}
            activo={sexoFiltro === 'F'}
            onClick={() => setSexoFiltro((actual) => (actual === 'F' ? undefined : 'F'))}
          >
            {estadisticas?.mujeres ?? 0}
          </KpiChipFiltro>
          <KpiChipFiltro
            icon={QrCode}
            label="Por URL"
            color={AZUL}
            activo={viaFiltro === 'URL'}
            onClick={() => setViaFiltro((actual) => (actual === 'URL' ? undefined : 'URL'))}
          >
            {estadisticasRegistro?.por_url ?? 0}
          </KpiChipFiltro>
          <KpiChipFiltro
            icon={FileText}
            label="Por formulario"
            color={TEAL}
            activo={viaFiltro === 'FORMULARIO'}
            onClick={() => setViaFiltro((actual) => (actual === 'FORMULARIO' ? undefined : 'FORMULARIO'))}
          >
            {estadisticasRegistro?.por_formulario ?? 0}
          </KpiChipFiltro>
          {(['SIM', 'NC', 'CRE', 'RE'] as const).map((sigla) => (
            <KpiChipFiltro
              key={sigla}
              icon={Users}
              label={ESTADO_LABEL[sigla]}
              color={AZUL}
              activo={estadoIdFiltro === estados.find((e) => e.sigla === sigla)?.id}
              onClick={() => alternarEstadoPorSigla(sigla)}
            >
              {porEstado[sigla] ?? 0}
            </KpiChipFiltro>
          ))}
          <KpiChipFiltro
            icon={Briefcase}
            label="Con profesión"
            color={TEAL}
            activo={conProfesionFiltro === true}
            onClick={() => setConProfesionFiltro((actual) => (actual ? undefined : true))}
          >
            {estadisticas?.con_profesion ?? 0}
          </KpiChipFiltro>
          {(Object.keys(ESTADO_CIVIL_LABELS) as EstadoCivil[]).map((codigo) => (
            <KpiChipFiltro
              key={codigo}
              icon={Heart}
              label={ESTADO_CIVIL_LABELS[codigo]}
              color={AZUL}
              activo={estadoCivilFiltro === codigo}
              onClick={() => setEstadoCivilFiltro((actual) => (actual === codigo ? undefined : codigo))}
            >
              {porEstadoCivil[codigo] ?? 0}
            </KpiChipFiltro>
          ))}
          {/* Auditoría de categorías faltantes (pedido 2026-09-11): de los
              campos del censo, "bautizado" es la única que suma como
              tarjeta nueva sin ambigüedad -- rango_miembro tiene un valor
              "Creyente" que colisiona con el Estado "Creyente" (CRE) de
              arriba (dos conceptos distintos, mismo nombre en pantalla) y
              los cargos de CdP/Red ya se ven como columna en la tabla, no
              hace falta duplicarlos acá. */}
          <KpiChipFiltro
            icon={CircleCheck}
            label="Bautizados"
            color={VERDE}
            activo={bautizadoFiltro === true}
            onClick={() => setBautizadoFiltro((actual) => (actual ? undefined : true))}
          >
            {estadisticas?.bautizados ?? 0}
          </KpiChipFiltro>
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
              <Button
                variant={vistaAmpliada ? 'default' : 'outline'}
                size="sm"
                className="gap-1.5"
                onClick={() => setVistaAmpliada((v) => !v)}
              >
                {vistaAmpliada ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                {vistaAmpliada ? 'Vista reducida' : 'Vista ampliada'}
              </Button>
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
              <table className={cn('w-full border-collapse text-sm', vistaAmpliada ? 'min-w-[2800px]' : 'min-w-[1400px]')}>
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
                    {vistaAmpliada && (
                      <>
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Nacimiento</th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Discipulados</th>
                        <th className="px-3 py-2.5 text-center text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Seminario</th>
                        <th className="px-3 py-2.5 text-center text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Univ. Rey Jesús</th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Bautismo</th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Mentor</th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Cónyuge</th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Familiares</th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Ministerios</th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Efesio</th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Cargos (censo)</th>
                      </>
                    )}
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
                        {vistaAmpliada && (
                          <>
                            <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{formatFechaNacimiento(p.fecha_nacimiento)}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">{p.discipulados ?? '—'}</td>
                            <td className="px-3 py-2.5 text-center">
                              {p.seminario ? <CircleCheck className="mx-auto h-4 w-4" style={{ color: VERDE }} /> : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {p.universidad_rey_jesus ? <CircleCheck className="mx-auto h-4 w-4" style={{ color: VERDE }} /> : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">{formatBautismo(p)}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">{formatMentor(p) ?? '—'}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">{p.conyuge_nombre ?? '—'}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">{p.familiares ?? '—'}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">{p.ministerios ?? '—'}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">{p.efesio_tipo ? (EFESIO_LABEL[p.efesio_tipo] ?? p.efesio_tipo) : '—'}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">{p.cargos_censo ?? '—'}</td>
                          </>
                        )}
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
