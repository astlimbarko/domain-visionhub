// VisionHub -- KAN-101: Sistema de anuncios por roles y redes.
// Espejo de la migracion 20260808290000_anuncios_sistema_base.sql.

/** Roles que pueden ser destinatarios de un anuncio (T4/T9). 'MIEMBRO' esta
 * preparado desde ya en el modelo (T9) pero todavia no matchea a nadie real
 * -- no existe acceso de Miembro a VisionHub. */
export type RolDestinatarioAnuncio = 'LIDER_RED' | 'SUBLIDER_RED' | 'LIDER_CDP' | 'SUBLIDER_CDP' | 'MIEMBRO';

export type OrientacionImagenAnuncio = 'CUADRADA' | 'VERTICAL';

/** Resultado de fn_anuncio_mi_capacidad: que puede crear el usuario actual. */
export interface CapacidadAnuncio {
  puede_iglesia: boolean;
  redes: { id: string; nombre: string; color: string; es_sublider: boolean }[];
}

/** Fila de fn_mis_anuncios_gestion (T3, pantalla de gestion). */
export interface AnuncioGestion {
  id: string;
  red_id: string | null;
  red_nombre: string | null;
  titulo: string;
  mensaje: string | null;
  imagen_path: string;
  imagen_orientacion: OrientacionImagenAnuncio;
  roles_destinatarios: RolDestinatarioAnuncio[];
  activo: boolean;
  prioridad: number;
  fecha_publicacion: string;
  fecha_fin: string | null;
  autor_nombre: string | null;
  fecha_creacion: string;
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
  redId: string | null;
  titulo: string;
  mensaje: string | null;
  imagenPath: string;
  imagenOrientacion: OrientacionImagenAnuncio;
  rolesDestinatarios: RolDestinatarioAnuncio[];
  fechaPublicacion?: string | null;
  fechaFin?: string | null;
}

export type DatosEditarAnuncio = Omit<DatosNuevoAnuncio, 'iglesiaId' | 'redId'> & { anuncioId: string };
