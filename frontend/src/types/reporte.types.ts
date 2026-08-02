export interface Libro {
  id: string;
  numero: number;
  nombre: string;
}

export interface Tema {
  id: string;
  libro_id: string;
  numero: number | null;
  nombre: string;
  es_especial: boolean;
}

export interface MiembroCdp {
  persona_id: string;
  nombre_completo: string;
  tiene_fecha_nacimiento: boolean;
  edad: number | null;
}

export interface EvangelizadoPendiente {
  /** id temporal del lado del cliente, solo para la key de React y para poder quitarlo de la lista. */
  clave: string;
  persona_id?: string;
  nombre_completo: string;
  primer_nombre?: string;
  primer_apellido?: string;
  sexo?: 'M' | 'F';
  domicilio?: string;
  /** Ambos opcionales: la persona recién evangelizada puede no querer o no poder darlos todavía. */
  telefono?: string;
  fecha_nacimiento?: string;
  /** Tipo de evangelismo elegido (1+1, Elite, Semilla...) al momento de agregarla. */
  tipo_evangelismo_id?: string;
  tipo_evangelismo_nombre?: string;
  tipo_evangelismo_color?: string;
}

export interface CamposObligatoriosReporte {
  REPORTE_TEMA_OBLIGATORIO: boolean;
  REPORTE_DISERTADOR_OBLIGATORIO: boolean;
  REPORTE_TESTIMONIOS_OBLIGATORIO: boolean;
  REPORTE_COMENTARIOS_OBLIGATORIO: boolean;
  REPORTE_SALIO_EVANGELIZAR_VISIBLE: boolean;
}

export interface MegaFiestaDelDia {
  evento_id: string;
  titulo: string;
}

export interface NuevaVisita {
  primer_nombre: string;
  primer_apellido: string;
  sexo: 'M' | 'F';
  es_menor?: boolean;
  telefono?: string;
}

export interface NuevoReporte {
  casa_de_paz_id: string;
  iglesia_id: string;
  fecha_reunion: string;
  libro_id?: string;
  tema_id?: string;
  tema_especial_txt?: string;
  disertador_id?: string;
  evento_megafiesta_id?: string;
  salio_evangelizar: boolean;
  evangelizados_declarados?: number;
  testimonios?: string;
  comentarios?: string;
  asistentesExistentes: { personaId: string; esMenor?: boolean; esVisita?: boolean }[];
  visitasNuevas: NuevaVisita[];
  totalOfrendas: number;
  totalDiezmos?: number;
  monedaId: string;
}

export interface ResultadoReporte {
  reporteId: string;
  totalMenores: number;
  totalMayores: number;
  totalAsistentes: number;
}

export interface ReporteReciente {
  id: string;
  casa_de_paz_id: string;
  fecha_reunion: string;
  total_asistentes: number;
  total_menores: number;
  total_mayores: number;
}

/**
 * Fila cruda de un reporte enviado por alguna Casa de Paz de la Red, para la
 * vista supervisora "Control de Reportes" del Líder de Red. La semana ISO se
 * calcula en el cliente a partir de `fecha_reunion`.
 */
export interface ReporteRedFila {
  reporte_id: string;
  casa_de_paz_id: string;
  fecha_reunion: string;
  total_asistentes: number;
  /** Cuándo se cargó el reporte (no la fecha de la reunión) -- para distinguir a tiempo/con retraso. */
  fecha_creacion: string;
}

export interface ReunionAsistencia {
  id: string;
  fecha_reunion: string;
}

export interface MiembroAsistencia {
  persona_id: string;
  nombre_completo: string;
  sexo: 'M' | 'F';
  edad: number | null;
  /** Numero crudo tal cual esta guardado -- el link de WhatsApp se arma en el componente. */
  telefono: string | null;
  /** Alineado 1 a 1 con `HistorialAsistencia.reuniones` (mismo orden). */
  asistio: boolean[];
}

export interface HistorialAsistencia {
  /** Ultimas reuniones de la CdP, de la mas reciente a la mas vieja. */
  reuniones: ReunionAsistencia[];
  miembros: MiembroAsistencia[];
}
