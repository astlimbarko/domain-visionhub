export type TipoNotificacion = 'REPORTE_SUBLIDER' | 'SOLICITUD_ESTRUCTURA' | 'SOLICITUD_RESUELTA';

export interface Notificacion {
  id: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  entidad_tipo: string | null;
  entidad_id: string | null;
  leida: boolean;
  fecha_creacion: string;
}
