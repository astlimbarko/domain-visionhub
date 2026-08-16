// VisionHub -- KAN-101: Sistema de anuncios por roles y redes.
// Espejo de la migracion 20260808290000_anuncios_sistema_base.sql.

/** Roles que pueden ser destinatarios de un anuncio (T4/T9). 'MIEMBRO' esta
 * preparado desde ya en el modelo (T9) pero todavia no matchea a nadie real
 * -- no existe acceso de Miembro a VisionHub. */
export type RolDestinatarioAnuncio = 'LIDER_RED' | 'SUBLIDER_RED' | 'LIDER_CDP' | 'SUBLIDER_CDP' | 'MIEMBRO';

export type OrientacionImagenAnuncio = 'CUADRADA' | 'VERTICAL';

/** Alcance de un anuncio (2026-08-15, KAN-102/103): reemplaza a la vieja
 * columna unica red_id -- IGLESIA no lleva redIds/cdpIds, RED y CDP exigen
 * al menos un id. */
export type AlcanceTipoAnuncio = 'IGLESIA' | 'RED' | 'CDP';

/** Resultado de fn_anuncio_mi_capacidad: que puede crear el usuario actual. */
export interface CapacidadAnuncio {
  puede_iglesia: boolean;
  /** Puede designar/quitar Encargados de Anuncios (Supervisor/Pastor/Super Admin). */
  puede_designar_encargados: boolean;
  redes: { id: string; nombre: string; color: string; es_sublider: boolean }[];
  /** Casas de Paz de las Redes que administra (para alcance CDP puntual).
   * Sin nombre propio (ya no se usa) -- se identifican por su Líder y la
   * zona del anfitrión, igual que el resto de VisionHub. */
  casas_de_paz: { id: string; red_id: string; lider_nombre: string | null; zona: string | null }[];
}

/** Fila de fn_anuncio_previsualizar_destinatarios: quién vería de verdad un
 * anuncio con este alcance+roles, antes de guardarlo. */
export interface PersonaDestinataria {
  persona_id: string;
  nombre: string;
}

/** Fila de fn_mis_anuncios_gestion (T3, pantalla de gestion). */
export interface AnuncioGestion {
  id: string;
  alcance_tipo: AlcanceTipoAnuncio;
  redes: { id: string; nombre: string }[];
  casas_de_paz: { id: string; lider_nombre: string | null; zona: string | null }[];
  titulo: string;
  mensaje: string | null;
  imagen_path: string;
  imagen_orientacion: OrientacionImagenAnuncio;
  roles_destinatarios: RolDestinatarioAnuncio[];
  activo: boolean;
  es_borrador: boolean;
  prioridad: number;
  fecha_publicacion: string;
  fecha_fin: string | null;
  autor_nombre: string | null;
  fecha_creacion: string;
}

/** Fila de fn_anuncio_listar_encargados. */
export interface EncargadoAnuncio {
  id: string;
  persona_id: string;
  nombre: string;
}

/** Fila de fn_anuncios_pendientes (T5/T6, cola del modal al ingresar). */
export interface AnuncioPendiente {
  id: string;
  iglesia_id: string;
  red_id: string | null;
  titulo: string;
  mensaje: string | null;
  imagen_path: string;
  imagen_orientacion: OrientacionImagenAnuncio;
  prioridad: number;
  fecha_publicacion: string;
}

export interface DatosNuevoAnuncio {
  iglesiaId: string;
  alcanceTipo: AlcanceTipoAnuncio;
  redIds: string[];
  cdpIds: string[];
  titulo: string;
  mensaje: string | null;
  imagenPath: string;
  imagenOrientacion: OrientacionImagenAnuncio;
  rolesDestinatarios: RolDestinatarioAnuncio[];
  fechaPublicacion?: string | null;
  fechaFin?: string | null;
  esBorrador: boolean;
}

export type DatosEditarAnuncio = Omit<DatosNuevoAnuncio, 'iglesiaId' | 'esBorrador'> & {
  anuncioId: string;
  /** SS29 anuncios.txt: al editar un anuncio ya publicado, elegir entre
   * mantener las visualizaciones existentes o mostrarlo de nuevo a todos. */
  mostrarNuevamente: boolean;
};
