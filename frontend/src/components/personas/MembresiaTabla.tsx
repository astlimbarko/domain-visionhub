// VisionHub -- KAN-386/389 seguimiento (2026-09-17, pedido explícito del
// owner): componente de verdad reutilizable, no una copia -- antes existían
// 2 archivos casi idénticos (AfirmacionPersonas.tsx para Supervisión,
// MembresiaCdp.tsx para Líder/Sublíder de CdP). Este componente es la ÚNICA
// UI real; ambas páginas quedan como wrappers finos. Un cambio visual acá
// (columna nueva, estilo distinto) se ve en las dos pantallas sin tener que
// tocar 2 archivos.
//
// `casaDePazId` es lo que decide el modo:
// - Sin `casaDePazId` (Supervisión/Pastor/Super Admin, vía AfirmacionPersonas):
//   selector de Red/CdP, columnas Red/Casa de Paz, KPIs "Por URL"/"Por
//   formulario" (fn_afirmacion_estadisticas_registro, no está scoped a CdP).
// - Con `casaDePazId` (Líder/Sublíder de CdP, vía MembresiaCdp): todo eso se
//   oculta (redundante o no soportado a nivel CdP), el filtro queda fijo a
//   esa CdP.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Armchair,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Baby,
  BookOpen,
  Briefcase,
  Cake,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Compass,
  Download,
  Eye,
  FileText,
  GraduationCap,
  Heart,
  type LucideIcon,
  Maximize2,
  Megaphone,
  Minimize2,
  Search,
  Shield,
  Sparkles,
  Star,
  User,
  Users,
  UserCheck,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AZUL, MORADO, TEAL, VERDE } from '@/components/dashboard/DashboardUI';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { CeldaTelefono } from '@/components/shared/CeldaTelefono';
import { cn } from '@/lib/utils';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { useRedes, useCdpsIglesia } from '@/hooks/useCasasDePaz';
import { useBuscarMembresiaAfirmacion, useEstados, useEstadisticasPersonasAfirmacion } from '@/hooks/useAfirmacion';
import {
  buscarMembresiaAfirmacion,
  type CargoCensoFiltro,
  type CumpleanosPeriodo,
  type EfesioTipoFiltro,
  type FiltrosMembresiaAfirmacion,
  type RangoEdadFiltro,
} from '@/services/afirmacion.service';
import { fechaCumpleEnSemana, fechaLegibleConDia } from '@/utils/calendario-fechas';
import { FichaPersonaSheet } from '@/components/personas/FichaPersonaSheet';
import { obtenerFicha } from '@/services/persona.service';
import { ESTADO_CIVIL_LABELS, type EstadoCivil } from '@/types/persona.types';
import { OPCIONES_EFESIO, OPCIONES_RANGO_MIEMBRO } from '@/types/membresia-extendida.types';
import type { MembresiaResultadoBusqueda } from '@/types/persona.types';
import { exportarMembresiaAfirmacionPdf, type FilaMembresiaPdf } from '@/utils/exportarMembresiaAfirmacionPdf';

const POR_PAGINA = 50;
const LIMITE_EXPORTACION = 5000;
const TODAS_LAS_REDES = '__todas__';
const TODAS_LAS_CDP = '__todas__';
const TODOS_LOS_ESTADOS = '__todos__';

const SELECT_ENCABEZADO =
  'h-auto w-full min-w-0 justify-start gap-1 border-none bg-transparent p-0 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase shadow-none hover:text-foreground focus-visible:ring-0 data-[state=open]:text-foreground [&>span]:truncate';

// KAN-404 seguimiento (2026-09-19, pedido explícito del owner): la columna
// Cumpleaños pasa a 2 filas -- "Cumpleaños" fijo arriba (como el resto de
// encabezados) y el período (Día/Semana/Mes/Todos) abajo, con estilo
// distinto a propósito para que se note que la 2da fila es el filtro
// interactivo y la 1ra es solo el nombre de columna.
const SELECT_ENCABEZADO_PERIODO =
  'h-auto w-full min-w-0 justify-start gap-1 border-none bg-transparent p-0 text-xs font-medium normal-case text-foreground shadow-none hover:text-primary focus-visible:ring-0 data-[state=open]:text-primary [&>span]:truncate';

type ColumnaOrden = 'nombre_completo' | 'sexo' | 'edad' | 'membresia_completada';
type DireccionOrden = 'asc' | 'desc';

const VIA_REGISTRO_LABEL: Record<'URL' | 'FORMULARIO', string> = {
  URL: 'URL',
  FORMULARIO: 'Formulario',
};

const RANGO_MIEMBRO_LABEL: Record<string, string> = Object.fromEntries(OPCIONES_RANGO_MIEMBRO.map((o) => [o.value, o.label]));

// KAN-403 seguimiento (2026-09-19, aclaración explícita del owner): de los
// 4 estados SSVA solo Simpatizante y Creyente son de Afirmación -- Nuevo
// Convertido y Reconciliado son etapas del embudo de Evangelismo, no van acá
// como chip (siguen filtrables desde el select "Estado" del encabezado de
// la tabla, que sí lista los 4).
const ESTADO_LABEL: Record<string, string> = {
  SIM: 'Simpatizantes',
  CRE: 'Creyentes',
};

const EFESIO_LABEL: Record<string, string> = Object.fromEntries(OPCIONES_EFESIO.map((o) => [o.value, o.label]));

// KAN-401 seguimiento (2026-09-20, pedido explícito del owner): Efesios,
// Ministerios, Cargos de censo (Ministro/Anciano/Diácono -- NO los cargos
// operativos de CdP/Red, esos ya tienen su propio filtro) y rango de Edad,
// mismos 5 cortes que ya usa ComposicionEdadChart.tsx en el dashboard.
const EFESIO_ICONO: Record<EfesioTipoFiltro, LucideIcon> = {
  APOSTOL: Compass,
  PROFETA: Eye,
  PASTOR: Shield,
  EVANGELISTA: Megaphone,
  MAESTRO: BookOpen,
};

const CARGO_CENSO_LABEL: Record<CargoCensoFiltro, string> = {
  MINISTRO: 'Ministro',
  ANCIANO: 'Anciano',
  DIACONO: 'Diácono',
};

const CARGO_CENSO_ICONO: Record<CargoCensoFiltro, LucideIcon> = {
  MINISTRO: Star,
  ANCIANO: UserCheck,
  DIACONO: Wrench,
};

const RANGO_EDAD_LABEL: Record<RangoEdadFiltro, string> = {
  NINOS: 'Niños',
  ADOLESCENTES: 'Adolescentes',
  JOVENES: 'Jóvenes',
  ADULTOS: 'Adultos',
  MAYORES: 'Adultos mayores',
};

const RANGO_EDAD_ICONO: Record<RangoEdadFiltro, LucideIcon> = {
  NINOS: Baby,
  ADOLESCENTES: GraduationCap,
  JOVENES: Briefcase,
  ADULTOS: Users,
  MAYORES: Armchair,
};

const CUMPLEANOS_LABEL: Record<CumpleanosPeriodo, string> = {
  DIA: 'Cumpleaños de hoy',
  SEMANA: 'Cumpleaños de la semana',
  MES: 'Cumpleaños del mes',
};

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

function formatFechaNacimiento(fecha: string | null): string {
  if (!fecha) return '—';
  const d = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const aa = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${aa}`;
}

// KAN-401 seguimiento (2026-09-20, pedido explícito del owner): chip
// compacto de una sola línea -- antes eran 2 líneas (número arriba, label
// abajo) y con 26 chips en total (8 categorías) esa altura ya no entraba.
// Mismo patrón de color/estado activo, solo el layout cambia.
function KpiChipFiltro({
  icon: Icon,
  label,
  color,
  activo,
  cargando,
  onClick,
  children,
}: {
  icon: LucideIcon;
  label: string;
  color: string;
  activo: boolean;
  cargando?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={activo ? { backgroundColor: color } : undefined}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left shadow-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
        activo ? 'border-transparent' : 'border-border/60 bg-card hover:border-border'
      )}
    >
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
        style={
          activo
            ? { background: 'rgb(255 255 255 / 25%)', color: '#fff' }
            : { background: `color-mix(in oklab, ${color} 14%, transparent)`, color }
        }
      >
        {cargando ? <Spinner className="h-3 w-3" /> : <Icon className="h-3 w-3" strokeWidth={2.4} />}
      </span>
      <span className={cn('text-[13px] leading-none font-bold tabular-nums', activo ? 'text-white' : 'text-foreground')}>{children}</span>
      <span className={cn('text-[11px] leading-none font-medium whitespace-nowrap', activo ? 'text-white/90' : 'text-muted-foreground')}>
        {label}
      </span>
    </button>
  );
}

// KAN-401 seguimiento (2026-09-20): fila de chips agrupada por categoría,
// con su nombre chico arriba (mismo estilo que un encabezado de columna). En
// desktop/tablet siempre visible (el owner lo eligió así -- "todo siempre
// visible, por filas con etiqueta"); en celular arranca colapsada (el owner
// eligió esta opción para no ocupar toda la pantalla con 8 categorías) y se
// abre con un toque. `md:flex` en el wrapper garantiza que desde tablet para
// arriba quede visible aunque `abierta` esté en false por cualquier motivo.
function CategoriaFiltros({ titulo, defaultAbierta, children }: { titulo: string; defaultAbierta: boolean; children: ReactNode }) {
  const [abierta, setAbierta] = useState(defaultAbierta);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setAbierta((a) => !a)}
        className="flex shrink-0 items-center gap-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase hover:text-foreground md:cursor-default"
      >
        <ChevronRight className={cn('h-3 w-3 transition-transform md:hidden', abierta && 'rotate-90')} />
        {titulo}
      </button>
      <div className={abierta ? 'flex flex-wrap gap-2' : 'hidden md:flex md:flex-wrap md:gap-2'}>{children}</div>
    </div>
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

function aFilaExportacion(p: MembresiaResultadoBusqueda, i: number, scoped: boolean): FilaMembresiaPdf {
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
    via_registro: scoped ? '—' : p.via_registro ? VIA_REGISTRO_LABEL[p.via_registro as 'URL' | 'FORMULARIO'] : '—',
    membresia: p.membresia_completada ? 'Completa' : 'Incompleta',
    estado_civil: p.estado_civil ? ESTADO_CIVIL_LABELS[p.estado_civil as EstadoCivil] : '—',
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

function celdaCsv(valor: string | number | null): string {
  if (valor === null) return '';
  return `"${String(valor).replaceAll('"', '""')}"`;
}

function filasACsv(filas: MembresiaResultadoBusqueda[], vistaAmpliada: boolean, scoped: boolean): string {
  const encabezados = [
    '#',
    'Nombre',
    'Sexo',
    'Edad',
    'CI',
    'Correo',
    ...(scoped ? [] : ['Red', 'Casa de Paz']),
    'Estado',
    'Teléfono',
    ...(scoped ? [] : ['Vía']),
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
      ...(scoped ? [] : [celdaCsv(p.red_nombre), celdaCsv(p.casa_de_paz_etiqueta)]),
      celdaCsv(p.estado_sigla),
      celdaCsv(p.telefono_principal),
      ...(scoped ? [] : [celdaCsv(p.via_registro ? VIA_REGISTRO_LABEL[p.via_registro as 'URL' | 'FORMULARIO'] : null)]),
      celdaCsv(p.membresia_completada ? 'Completa' : 'Incompleta'),
      celdaCsv(p.estado_civil ? ESTADO_CIVIL_LABELS[p.estado_civil as EstadoCivil] : null),
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

interface Props {
  iglesiaId: string | undefined;
  /** Si se pasa: vista scoped a esta CdP (Líder/Sublíder de CdP vía
   * MembresiaCdp). Sin esto: vista completa de la iglesia (Supervisión/
   * Pastor/Super Admin vía AfirmacionPersonas). */
  casaDePazId?: string;
  /** Solo se usa en modo scoped, para el encabezado del PDF exportado
   * (en modo completo se usa el nombre de la iglesia). */
  casaDePazEtiqueta?: string;
  iglesiaNombre: string;
  titulo?: string;
  descripcion?: string;
}

export function MembresiaTabla({ iglesiaId, casaDePazId, casaDePazEtiqueta, iglesiaNombre, titulo = 'Membresía', descripcion }: Props) {
  const scoped = !!casaDePazId;
  const queryClient = useQueryClient();
  const [textoInput, setTextoInput] = useState('');
  const [texto, setTexto] = useState('');
  const [redId, setRedId] = useState<string>(TODAS_LAS_REDES);
  const [casaDePazIdFiltroUi, setCasaDePazIdFiltroUi] = useState<string>(TODAS_LAS_CDP);
  const [estadoId, setEstadoId] = useState<string>(TODOS_LOS_ESTADOS);
  const [sexoFiltro, setSexoFiltro] = useState<'M' | 'F'>();
  const [conProfesionFiltro, setConProfesionFiltro] = useState<boolean>();
  const [estadoCivilFiltro, setEstadoCivilFiltro] = useState<EstadoCivil>();
  const [bautizadoFiltro, setBautizadoFiltro] = useState<boolean>();
  // KAN-401 seguimiento (2026-09-20, pedido explícito del owner): categorías
  // nuevas de filtro (Efesios, Ministerios, Cargos, Edad).
  const [efesioFiltro, setEfesioFiltro] = useState<EfesioTipoFiltro>();
  const [conMinisterioFiltro, setConMinisterioFiltro] = useState<boolean>();
  const [cargoCensoFiltro, setCargoCensoFiltro] = useState<CargoCensoFiltro>();
  const [rangoEdadFiltro, setRangoEdadFiltro] = useState<RangoEdadFiltro>();
  const [pagina, setPagina] = useState(1);
  const [orden, setOrden] = useState<{ columna: ColumnaOrden; direccion: DireccionOrden } | null>(null);
  const [personaSeleccionadaId, setPersonaSeleccionadaId] = useState<string>();
  const [exportando, setExportando] = useState(false);
  const [exportandoPdf, setExportandoPdf] = useState(false);
  const [vistaAmpliada, setVistaAmpliada] = useState(false);
  const [filtroEnCurso, setFiltroEnCurso] = useState<string | null>(null);
  // KAN-401 seguimiento (2026-09-19, pedido explícito del owner): a
  // diferencia de Red/CdP/Estado, este filtro NO tiene una opción "todos"
  // en la lista -- "cumpleaños de todo el año" no tiene sentido como
  // filtro útil acá. Pero sí arranca SIN filtrar (undefined, sin período
  // elegido) para no ocultar de entrada a la mayoría de las personas --
  // recién filtra cuando el usuario elige Día/Semana/Mes a propósito.
  const [cumpleanosFiltro, setCumpleanosFiltro] = useState<CumpleanosPeriodo | undefined>(undefined);
  // KAN-401 seguimiento (2026-09-20): el tooltip del ícono de torta es
  // controlado en todos los dispositivos (antes solo en táctil) -- así el
  // clic también lo abre en PC, además del hover que ya andaba bien.
  const [tortaAbiertaId, setTortaAbiertaId] = useState<string | null>(null);
  // Bug real encontrado al verificar en vivo (2026-09-20): un clic de mouse
  // real siempre dispara hover ANTES que el click -- si el onClick alterna
  // (toggle), el hover ya lo había abierto, y el click lo cerraba de
  // inmediato (el ícono "parpadeaba" en vez de quedarse abierto). En
  // táctil no hay hover, ahí el tap sigue alternando como siempre.
  const [esTactil] = useState(() => window.matchMedia('(hover: none) and (pointer: coarse)').matches);
  // KAN-401 seguimiento (2026-09-20): las categorías de filtro arrancan
  // colapsadas en celular (pedido explícito del owner), siempre abiertas
  // desde tablet -- mismo umbral md (768px) que ya usa el resto del layout.
  const [esMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);

  // KAN-404 (pedido explícito del owner, 2026-09-19): la tabla es ancha y
  // antes solo tenía el scroll horizontal nativo al fondo -- para
  // scrollear había que bajar hasta el final. Esta barra fina de arriba
  // (mismo ancho que la tabla real) se sincroniza en las 2 direcciones con
  // el scroll real de la tabla, así se puede mover desde arriba sin bajar.
  const scrollArribaRef = useRef<HTMLDivElement>(null);
  const scrollTablaRef = useRef<HTMLDivElement>(null);
  const sincronizandoScroll = useRef(false);

  function sincronizarDesdeArriba() {
    if (sincronizandoScroll.current || !scrollArribaRef.current || !scrollTablaRef.current) return;
    sincronizandoScroll.current = true;
    scrollTablaRef.current.scrollLeft = scrollArribaRef.current.scrollLeft;
    sincronizandoScroll.current = false;
  }

  function sincronizarDesdeTabla() {
    if (sincronizandoScroll.current || !scrollArribaRef.current || !scrollTablaRef.current) return;
    sincronizandoScroll.current = true;
    scrollArribaRef.current.scrollLeft = scrollTablaRef.current.scrollLeft;
    sincronizandoScroll.current = false;
  }

  const { data: redes = [] } = useRedes(scoped ? undefined : iglesiaId);
  const { data: cdps = [] } = useCdpsIglesia(scoped ? undefined : iglesiaId);
  const { data: estados = [] } = useEstados();

  useEffect(() => {
    const t = setTimeout(() => setTexto(textoInput), 300);
    return () => clearTimeout(t);
  }, [textoInput]);
  useEffect(
    () => setPagina(1),
    [
      texto,
      redId,
      casaDePazIdFiltroUi,
      estadoId,
      sexoFiltro,
      conProfesionFiltro,
      estadoCivilFiltro,
      bautizadoFiltro,
      cumpleanosFiltro,
      efesioFiltro,
      conMinisterioFiltro,
      cargoCensoFiltro,
      rangoEdadFiltro,
    ]
  );

  const redIdFiltro = scoped ? undefined : redId === TODAS_LAS_REDES ? undefined : redId;
  const casaDePazIdFiltro = scoped ? casaDePazId : casaDePazIdFiltroUi === TODAS_LAS_CDP ? undefined : casaDePazIdFiltroUi;
  const estadoIdFiltro = estadoId === TODOS_LOS_ESTADOS ? undefined : estadoId;

  const filtros: FiltrosMembresiaAfirmacion = useMemo(
    () => ({
      redId: redIdFiltro,
      casaDePazId: casaDePazIdFiltro,
      estadoId: estadoIdFiltro,
      sexo: sexoFiltro,
      conProfesion: conProfesionFiltro,
      estadoCivil: estadoCivilFiltro,
      bautizado: bautizadoFiltro,
      cumpleanosPeriodo: cumpleanosFiltro,
      efesioTipo: efesioFiltro,
      conMinisterio: conMinisterioFiltro,
      cargoCenso: cargoCensoFiltro,
      rangoEdad: rangoEdadFiltro,
    }),
    [
      redIdFiltro,
      casaDePazIdFiltro,
      estadoIdFiltro,
      sexoFiltro,
      conProfesionFiltro,
      estadoCivilFiltro,
      bautizadoFiltro,
      cumpleanosFiltro,
      efesioFiltro,
      conMinisterioFiltro,
      cargoCensoFiltro,
      rangoEdadFiltro,
    ]
  );

  const sinFiltros =
    !redIdFiltro &&
    (scoped || !casaDePazIdFiltro) &&
    !estadoIdFiltro &&
    !sexoFiltro &&
    !conProfesionFiltro &&
    !estadoCivilFiltro &&
    !bautizadoFiltro &&
    !cumpleanosFiltro &&
    !efesioFiltro &&
    !conMinisterioFiltro &&
    !cargoCensoFiltro &&
    !rangoEdadFiltro;

  function limpiarFiltros() {
    setRedId(TODAS_LAS_REDES);
    setCasaDePazIdFiltroUi(TODAS_LAS_CDP);
    setEstadoId(TODOS_LOS_ESTADOS);
    setSexoFiltro(undefined);
    setConProfesionFiltro(undefined);
    setEstadoCivilFiltro(undefined);
    setBautizadoFiltro(undefined);
    setCumpleanosFiltro(undefined);
    setEfesioFiltro(undefined);
    setConMinisterioFiltro(undefined);
    setCargoCensoFiltro(undefined);
    setRangoEdadFiltro(undefined);
  }

  function alternarEstadoPorSigla(sigla: string) {
    const estado = estados.find((e) => e.sigla === sigla);
    if (!estado) return;
    setEstadoId((actual) => (actual === estado.id ? TODOS_LOS_ESTADOS : estado.id));
  }

  const { data: estadisticas, isLoading: cargandoEstadisticas } = useEstadisticasPersonasAfirmacion(iglesiaId, casaDePazId);
  const { data, isLoading, isFetching } = useBuscarMembresiaAfirmacion(iglesiaId, texto, pagina, POR_PAGINA, filtros);

  useEffect(() => {
    if (!isFetching) setFiltroEnCurso(null);
  }, [isFetching]);

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

  // KAN-403: el modal de ficha ya está montado siempre (React Query lo
  // muestra desde caché al instante en reaperturas) -- la demora real que
  // sentía el owner es el PRIMER fetch de cada persona nueva (un round-trip
  // real de red, no optimizable de raíz). Precargar el modal vacío al
  // cargar la página no ayuda porque no se sabe a quién van a abrir; en
  // cambio, adelantar el fetch apenas el mouse entra a la fila (antes del
  // clic real) hace que el dato ya esté en caché cuando de verdad hacen
  // clic, sin tocar el mecanismo de carga del modal.
  function precargarFicha(personaId: string) {
    void queryClient.prefetchQuery({ queryKey: ['personas', 'ficha', personaId], queryFn: () => obtenerFicha(personaId) });
  }

  async function exportarCsv() {
    if (!iglesiaId) return;
    setExportando(true);
    try {
      const { resultados: todas } = await buscarMembresiaAfirmacion(iglesiaId, texto, 1, LIMITE_EXPORTACION, filtros);
      const csv = filasACsv(todas, vistaAmpliada, scoped);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `${scoped ? 'membresia' : 'personas'}-${new Date().toISOString().slice(0, 10)}.csv`;
      enlace.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('No se pudo exportar el CSV');
    } finally {
      setExportando(false);
    }
  }

  const filtroDescripcion = [
    texto.trim() && `"${texto.trim()}"`,
    redIdFiltro && redes.find((r) => r.id === redIdFiltro)?.nombre,
    !scoped && casaDePazIdFiltro && cdps.find((c) => c.id === casaDePazIdFiltro)?.etiqueta,
    estadoIdFiltro && estados.find((e) => e.id === estadoIdFiltro)?.nombre,
    sexoFiltro && (sexoFiltro === 'M' ? 'Hombres' : 'Mujeres'),
    conProfesionFiltro && 'Con profesión',
    estadoCivilFiltro && ESTADO_CIVIL_LABELS[estadoCivilFiltro],
    bautizadoFiltro && 'Bautizados',
    cumpleanosFiltro && CUMPLEANOS_LABEL[cumpleanosFiltro],
    efesioFiltro && EFESIO_LABEL[efesioFiltro],
    conMinisterioFiltro && 'Con ministerio',
    cargoCensoFiltro && CARGO_CENSO_LABEL[cargoCensoFiltro],
    rangoEdadFiltro && RANGO_EDAD_LABEL[rangoEdadFiltro],
  ]
    .filter(Boolean)
    .join(' · ');

  async function exportarPdf() {
    if (!iglesiaId) return;
    setExportandoPdf(true);
    try {
      const { resultados: todas } = await buscarMembresiaAfirmacion(iglesiaId, texto, 1, LIMITE_EXPORTACION, filtros);
      await exportarMembresiaAfirmacionPdf(
        todas.map((p, i) => aFilaExportacion(p, i, scoped)),
        { iglesiaNombre: scoped ? (casaDePazEtiqueta ?? 'tu Casa de Paz') : iglesiaNombre, filtroDescripcion, vistaAmpliada }
      );
    } catch {
      toast.error('No se pudo exportar el PDF');
    } finally {
      setExportandoPdf(false);
    }
  }

  const porEstado = estadisticas?.por_estado ?? {};
  const porEstadoCivil = estadisticas?.por_estado_civil ?? {};
  const porEfesio = estadisticas?.por_efesio ?? {};
  const porEdad = estadisticas?.por_edad ?? {};

  // KAN-404: mismo ancho para la tabla real y la barra de scroll fantasma
  // de arriba -- si difirieran, el scroll superior no llegaría al mismo
  // punto final que el de abajo.
  const anchoTabla = vistaAmpliada ? (scoped ? 'min-w-[2400px]' : 'min-w-[2800px]') : scoped ? 'min-w-[1100px]' : 'min-w-[1400px]';

  return (
    <div className="flex flex-col gap-6">
      {/* KAN-401 seguimiento (2026-09-20, pedido explícito del owner):
          8 categorías de filtro en filas compactas -- se sacó "Por
          URL"/"Por formulario" (ya no hacían falta) y se sumaron Efesios,
          Ministerios, Cargos de censo y Edad. Chips de una sola línea
          (antes 2) para que entren las 26 en total sin ocupar demasiado. */}
      {cargandoEstadisticas ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: scoped ? 5 : 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[52px] w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <CategoriaFiltros titulo="General" defaultAbierta={!esMobile}>
            <KpiChipFiltro
              icon={Users}
              label="Total"
              color={AZUL}
              activo={sinFiltros}
              cargando={filtroEnCurso === 'total' && isFetching}
              onClick={() => {
                setFiltroEnCurso('total');
                limpiarFiltros();
              }}
            >
              {estadisticas?.total ?? 0}
            </KpiChipFiltro>
            <KpiChipFiltro
              icon={User}
              label="Hombres"
              color={AZUL}
              activo={sexoFiltro === 'M'}
              cargando={filtroEnCurso === 'hombres' && isFetching}
              onClick={() => {
                setFiltroEnCurso('hombres');
                setSexoFiltro((actual) => (actual === 'M' ? undefined : 'M'));
              }}
            >
              {estadisticas?.hombres ?? 0}
            </KpiChipFiltro>
            <KpiChipFiltro
              icon={User}
              label="Mujeres"
              color={TEAL}
              activo={sexoFiltro === 'F'}
              cargando={filtroEnCurso === 'mujeres' && isFetching}
              onClick={() => {
                setFiltroEnCurso('mujeres');
                setSexoFiltro((actual) => (actual === 'F' ? undefined : 'F'));
              }}
            >
              {estadisticas?.mujeres ?? 0}
            </KpiChipFiltro>
          </CategoriaFiltros>

          {/* KAN-403 seguimiento 2026-09-19: solo SIM y CRE -- NC y RE son
              de Evangelismo, no de Afirmación (aclaración explícita del
              owner). Siguen filtrables desde el select "Estado" del
              encabezado de la tabla si hace falta. */}
          <CategoriaFiltros titulo="Estado espiritual" defaultAbierta={!esMobile}>
            {(['SIM', 'CRE'] as const).map((sigla) => (
              <KpiChipFiltro
                key={sigla}
                icon={Users}
                label={ESTADO_LABEL[sigla]}
                color={AZUL}
                activo={estadoIdFiltro === estados.find((e) => e.sigla === sigla)?.id}
                cargando={filtroEnCurso === `estado-${sigla}` && isFetching}
                onClick={() => {
                  setFiltroEnCurso(`estado-${sigla}`);
                  alternarEstadoPorSigla(sigla);
                }}
              >
                {porEstado[sigla] ?? 0}
              </KpiChipFiltro>
            ))}
          </CategoriaFiltros>

          <CategoriaFiltros titulo="Estado civil" defaultAbierta={!esMobile}>
            {(Object.keys(ESTADO_CIVIL_LABELS) as EstadoCivil[]).map((codigo) => (
              <KpiChipFiltro
                key={codigo}
                icon={Heart}
                label={ESTADO_CIVIL_LABELS[codigo]}
                color={AZUL}
                activo={estadoCivilFiltro === codigo}
                cargando={filtroEnCurso === `estado-civil-${codigo}` && isFetching}
                onClick={() => {
                  setFiltroEnCurso(`estado-civil-${codigo}`);
                  setEstadoCivilFiltro((actual) => (actual === codigo ? undefined : codigo));
                }}
              >
                {porEstadoCivil[codigo] ?? 0}
              </KpiChipFiltro>
            ))}
          </CategoriaFiltros>

          <CategoriaFiltros titulo="Datos personales" defaultAbierta={!esMobile}>
            <KpiChipFiltro
              icon={Briefcase}
              label="Con profesión"
              color={TEAL}
              activo={conProfesionFiltro === true}
              cargando={filtroEnCurso === 'con-profesion' && isFetching}
              onClick={() => {
                setFiltroEnCurso('con-profesion');
                setConProfesionFiltro((actual) => (actual ? undefined : true));
              }}
            >
              {estadisticas?.con_profesion ?? 0}
            </KpiChipFiltro>
            <KpiChipFiltro
              icon={CircleCheck}
              label="Bautizados"
              color={VERDE}
              activo={bautizadoFiltro === true}
              cargando={filtroEnCurso === 'bautizados' && isFetching}
              onClick={() => {
                setFiltroEnCurso('bautizados');
                setBautizadoFiltro((actual) => (actual ? undefined : true));
              }}
            >
              {estadisticas?.bautizados ?? 0}
            </KpiChipFiltro>
          </CategoriaFiltros>

          <CategoriaFiltros titulo="Efesios" defaultAbierta={!esMobile}>
            {OPCIONES_EFESIO.map(({ value, label }) => (
              <KpiChipFiltro
                key={value}
                icon={EFESIO_ICONO[value as EfesioTipoFiltro]}
                label={label}
                color={MORADO}
                activo={efesioFiltro === value}
                cargando={filtroEnCurso === `efesio-${value}` && isFetching}
                onClick={() => {
                  setFiltroEnCurso(`efesio-${value}`);
                  setEfesioFiltro((actual) => (actual === value ? undefined : (value as EfesioTipoFiltro)));
                }}
              >
                {porEfesio[value] ?? 0}
              </KpiChipFiltro>
            ))}
          </CategoriaFiltros>

          <CategoriaFiltros titulo="Ministerios" defaultAbierta={!esMobile}>
            <KpiChipFiltro
              icon={Sparkles}
              label="Con ministerio"
              color={MORADO}
              activo={conMinisterioFiltro === true}
              cargando={filtroEnCurso === 'con-ministerio' && isFetching}
              onClick={() => {
                setFiltroEnCurso('con-ministerio');
                setConMinisterioFiltro((actual) => (actual ? undefined : true));
              }}
            >
              {estadisticas?.con_ministerio ?? 0}
            </KpiChipFiltro>
          </CategoriaFiltros>

          <CategoriaFiltros titulo="Cargos" defaultAbierta={!esMobile}>
            {(['MINISTRO', 'ANCIANO', 'DIACONO'] as const).map((codigo) => (
              <KpiChipFiltro
                key={codigo}
                icon={CARGO_CENSO_ICONO[codigo]}
                label={CARGO_CENSO_LABEL[codigo]}
                color={TEAL}
                activo={cargoCensoFiltro === codigo}
                cargando={filtroEnCurso === `cargo-${codigo}` && isFetching}
                onClick={() => {
                  setFiltroEnCurso(`cargo-${codigo}`);
                  setCargoCensoFiltro((actual) => (actual === codigo ? undefined : codigo));
                }}
              >
                {codigo === 'MINISTRO'
                  ? (estadisticas?.cargo_ministro ?? 0)
                  : codigo === 'ANCIANO'
                    ? (estadisticas?.cargo_anciano ?? 0)
                    : (estadisticas?.cargo_diacono ?? 0)}
              </KpiChipFiltro>
            ))}
          </CategoriaFiltros>

          <CategoriaFiltros titulo="Edad" defaultAbierta={!esMobile}>
            {(['NINOS', 'ADOLESCENTES', 'JOVENES', 'ADULTOS', 'MAYORES'] as const).map((rango) => (
              <KpiChipFiltro
                key={rango}
                icon={RANGO_EDAD_ICONO[rango]}
                label={RANGO_EDAD_LABEL[rango]}
                color={VERDE}
                activo={rangoEdadFiltro === rango}
                cargando={filtroEnCurso === `edad-${rango}` && isFetching}
                onClick={() => {
                  setFiltroEnCurso(`edad-${rango}`);
                  setRangoEdadFiltro((actual) => (actual === rango ? undefined : rango));
                }}
              >
                {porEdad[rango] ?? 0}
              </KpiChipFiltro>
            ))}
          </CategoriaFiltros>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader
          icon={Users}
          color={AZUL}
          titulo={titulo}
          descripcion={descripcion ?? 'Datos principales -- click en una fila para ver la ficha completa.'}
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className={cn('pl-8', CAMPO_ESTILO)}
                placeholder="Buscar por nombre, CI o correo..."
                value={textoInput}
                onChange={(e) => setTextoInput(e.target.value)}
              />
            </div>

            {/* Pedido explícito del owner (2026-09-20): conteo de resultados
                pegado a la barra de búsqueda (misma fila en desktop, se cae
                debajo en mobile) -- para que se note de un vistazo cuántas
                personas coinciden con los filtros aplicados. Solo después de
                la primera carga (isLoading) -- mientras carga se ve el
                Skeleton, no un "0 personas encontradas" engañoso. */}
            {!isLoading && (
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground tabular-nums">{total}</span>{' '}
                {total === 1 ? 'persona encontrada' : 'personas encontradas'}
              </p>
            )}
          </div>

          {isLoading ? (
            <Skeleton className="h-96 w-full rounded-2xl" />
          ) : filasOrdenadas.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/50 bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
              <p>
                {texto.trim()
                  ? 'Sin resultados para esa búsqueda.'
                  : !sinFiltros
                    ? // KAN-401: cualquier combinación de filtros (incluido el de
                      // cumpleaños) puede dar 0 resultados -- el mensaje de "todavía
                      // no tiene miembros" quedaba engañoso en ese caso (la CdP/
                      // iglesia sí tiene gente, ninguno coincide con lo filtrado).
                      'Nadie coincide con los filtros aplicados.'
                    : scoped
                      ? 'Esta Casa de Paz todavía no tiene miembros registrados.'
                      : 'Esta iglesia todavía no tiene personas registradas.'}
              </p>
              {/* KAN-401: con 0 filas la tabla (y los selects de su encabezado,
                  incluido el de Cumpleaños) no se renderiza -- sin este botón,
                  activar un filtro que da 0 resultados dejaba a la persona sin
                  forma de volver atrás. */}
              {!sinFiltros && !texto.trim() && (
                <Button type="button" variant="outline" size="sm" onClick={limpiarFiltros}>
                  Ver a todos
                </Button>
              )}
            </div>
          ) : (
            <>
              <div ref={scrollArribaRef} onScroll={sincronizarDesdeArriba} className="overflow-x-auto">
                <div className={cn('h-px', anchoTabla)} />
              </div>
              <div
                ref={scrollTablaRef}
                onScroll={sincronizarDesdeTabla}
                className={cn('overflow-x-auto rounded-xl border border-border/60 transition-opacity', isFetching && 'opacity-60')}
              >
              <table className={cn('w-full border-collapse text-sm', anchoTabla)}>
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
                    <th className="px-2 py-2">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Cumpleaños</span>
                        <Select
                          value={cumpleanosFiltro ?? ''}
                          onValueChange={(v) => setCumpleanosFiltro(v ? (v as CumpleanosPeriodo) : undefined)}
                        >
                          <SelectTrigger size="sm" className={cn(SELECT_ENCABEZADO_PERIODO, 'justify-center')}>
                            <SelectValue placeholder="Período" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DIA">Día</SelectItem>
                            <SelectItem value="SEMANA">Semana</SelectItem>
                            <SelectItem value="MES">Mes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">CI</th>
                    {scoped ? (
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Estado</th>
                    ) : (
                      <>
                        <th className="px-2 py-2">
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
                          <Select value={casaDePazIdFiltroUi} onValueChange={setCasaDePazIdFiltroUi}>
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
                      </>
                    )}
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Teléfono</th>
                    {!scoped && (
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Vía</th>
                    )}
                    <EncabezadoOrdenable columna="membresia_completada" ordenActual={orden} onOrdenar={ordenarPor}>
                      Membresía
                    </EncabezadoOrdenable>
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
                        onMouseEnter={() => precargarFicha(p.id)}
                        className="cursor-pointer border-t border-border/50 hover:bg-muted/40"
                      >
                        <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{(pagina - 1) * POR_PAGINA + i + 1}</td>
                        <td className="px-3 py-2.5 leading-tight font-medium">
                          <p className="truncate">{nombreLinea1 || p.nombre_completo}</p>
                          {nombreLinea2 && <p className="truncate text-xs font-normal text-muted-foreground">{nombreLinea2}</p>}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{p.sexo === 'M' ? 'M' : 'F'}</td>
                        <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{p.edad ?? '—'}</td>
                        <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                          {(() => {
                            const fechaCumple = p.fecha_nacimiento ? fechaCumpleEnSemana(p.fecha_nacimiento) : null;
                            if (!fechaCumple) return null;
                            return (
                              // KAN-401 seguimiento (2026-09-20, pedido explícito del
                              // owner): antes el clic solo abría/cerraba en táctil (sin
                              // hover) -- ahora también funciona en PC, además del hover
                              // que ya andaba bien, sin duración especial: se abre/cierra
                              // igual que ya lo hacía el hover o el tap.
                              <Tooltip
                                open={tortaAbiertaId === p.id}
                                onOpenChange={(abierto) => setTortaAbiertaId(abierto ? p.id : null)}
                              >
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    className="inline-flex h-6 w-6 items-center justify-center"
                                    onClick={() => setTortaAbiertaId((actual) => (esTactil && actual === p.id ? null : p.id))}
                                    aria-label="Cumple años esta semana"
                                  >
                                    {/* Mismo ícono que el badge de cumpleaños del calendario de
                                        Casas de Paz (CalendarioGrid.tsx). Sin círculo ni relleno
                                        (pedido explícito del owner, 2026-09-19): solo el dibujo en
                                        líneas moradas, no un badge sólido. */}
                                    <Cake className="h-[18px] w-[18px]" style={{ color: MORADO }} />
                                  </button>
                                </TooltipTrigger>
                                {/* Fecha en 2 líneas (pedido explícito del owner, 2026-09-20). */}
                                <TooltipContent side="top" className="flex flex-col items-center text-center">
                                  <span>Cumple años el</span>
                                  <span className="font-semibold">{fechaLegibleConDia(fechaCumple)}</span>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{p.ci ?? '—'}</td>
                        {scoped ? (
                          <td className="px-3 py-2.5">
                            {p.estado_sigla ? (
                              <Badge variant="secondary" className="rounded-full text-[10px]">
                                {p.estado_sigla}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        ) : (
                          <>
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
                          </>
                        )}
                        <td className="px-3 py-2.5 text-muted-foreground">
                          <CeldaTelefono telefono={p.telefono_principal} />
                        </td>
                        {!scoped && (
                          <td className="px-3 py-2.5 text-muted-foreground">{p.via_registro ? VIA_REGISTRO_LABEL[p.via_registro as 'URL' | 'FORMULARIO'] : '—'}</td>
                        )}
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
                        <td className="px-3 py-2.5 text-muted-foreground">{p.estado_civil ? ESTADO_CIVIL_LABELS[p.estado_civil as EstadoCivil] : '—'}</td>
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
            </>
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
