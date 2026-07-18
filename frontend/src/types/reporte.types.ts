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
  asistentesExistentes: { personaId: string; esMenor?: boolean }[];
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
  fecha_reunion: string;
  total_asistentes: number;
  total_menores: number;
  total_mayores: number;
}
