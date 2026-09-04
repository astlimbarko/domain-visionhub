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
  segundo_nombre?: string;
  primer_apellido?: string;
  segundo_apellido?: string;
  sexo?: 'M' | 'F';
  domicilio?: string;
  /** Ambos opcionales: la persona recién evangelizada puede no querer o no poder darlos todavía. */
  telefono?: string;
  fecha_nacimiento?: string;
  /** Tipo de evangelismo elegido (1+1, Elite, Semilla...) -- puede quedar sin
   * elegir al agregarla y completarse después (ver EvangelismoPendientePanel). */
  tipo_evangelismo_id?: string;
  tipo_evangelismo_nombre?: string;
  tipo_evangelismo_color?: string;
  /** Presente cuando esta entrada vino de "Asistentes nuevos" (persona que no
   * está en el sistema, agregada ahí) -- apunta a la `clave` de la NuevaVisita
   * correspondiente en vez de crear una persona aparte: al enviar el reporte,
   * se linkea al mismo persona_id que ya se creó como asistente en vez de
   * duplicar el alta. */
  visitaNuevaClave?: string;
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
  /** id temporal del lado del cliente -- permite linkear con el EvangelizadoPendiente
   * espejo (ver visitaNuevaClave) y hace estable la key de React al quitar de la lista. */
  clave: string;
  primer_nombre: string;
  /** Segundo nombre -- opcional, no todas las personas tienen o dan uno. */
  segundo_nombre?: string;
  primer_apellido: string;
  /** Apellido materno -- opcional, no todas las personas lo tienen o lo quieren dar. */
  segundo_apellido?: string;
  sexo: 'M' | 'F';
  es_menor?: boolean;
  telefono?: string;
  /** Mismo campo que el formulario de Evangelismo (en vez de preguntar
   * "es menor" aparte) -- si viene, es_menor se calcula a partir de esto. */
  fecha_nacimiento?: string;
}

/**
 * Una línea de diezmo del reporte de CdP: un diezmante con su monto. Puede ser
 * una persona ya existente (personaId) o una tecleada a mano (sin personaId,
 * con los datos para crear la persona "lead" + celular opcional, igual que las
 * visitas). El total de diezmos es la suma de las líneas.
 */
export interface DiezmoLinea {
  /** id temporal del lado del cliente, solo para la key de React. */
  clave: string;
  /** Presente si el diezmante ya existe en la BD (seleccionado del buscador). */
  personaId?: string;
  /** Nombre para mostrar (de la persona existente, o compuesto del alta manual). */
  nombre_completo: string;
  /** Solo para diezmante nuevo (sin personaId): datos para crear la persona lead. */
  primer_nombre?: string;
  primer_apellido?: string;
  sexo?: 'M' | 'F';
  telefono?: string;
  monto: number;
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
  /** Diezmos por persona (nombre + monto + celular opcional). El total es la suma. */
  diezmos: DiezmoLinea[];
  monedaId: string;
}

export interface ResultadoReporte {
  reporteId: string;
  totalMenores: number;
  totalMayores: number;
  totalAsistentes: number;
  /** Persona creada por cada NuevaVisita enviada, alineado por `clave` -- para
   * linkear a Evangelismo (fn_registrar_evangelizado con persona_id) sin
   * crear una segunda persona para la misma visita nueva. */
  visitasNuevasCreadas: { clave: string; personaId: string }[];
}

/** KAN-271: datos de un reporte ya enviado, para precargar el formulario en modo edición. */
export interface ReporteExistente {
  id: string;
  casa_de_paz_id: string;
  iglesia_id: string;
  fecha_reunion: string;
  libro_id: string | null;
  tema_id: string | null;
  tema_especial_txt: string | null;
  disertador_id: string | null;
  disertador_nombre: string | null;
  salio_evangelizar: boolean;
  evangelizados_declarados: number | null;
  testimonios: string | null;
  comentarios: string | null;
  totalOfrendas: number;
  /** Diezmos por persona ya guardados (siempre con personaId + nombre). */
  diezmos: DiezmoLinea[];
  monedaId: string | null;
  asistentes: { personaId: string; esVisita: boolean; esMenor?: boolean }[];
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
  /** KAN-31: VERDE (a tiempo) / NARANJA (con retraso), calculado en el servidor
   * (v_reporte_totales) contra el plazo configurable de la iglesia -- ya no se
   * recalcula en el cliente. */
  estado_carga: 'VERDE' | 'NARANJA';
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
