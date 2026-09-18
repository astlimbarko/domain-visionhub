export type AvanceTipo = 'EN_CURSO' | 'TERMINADO' | 'CORRECCION';

export interface Avance {
  id: string;
  tipo: AvanceTipo;
  area: string | null;
  titulo: string;
  descripcion: string;
  alcance_codigo: string;
  alcance_nombre: string;
  fecha_publicacion: string;
}
