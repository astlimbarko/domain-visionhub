import type { Sexo } from './persona.types';

/** Fila de fn_jovenes_iglesia -- acceso global de solo lectura del Líder de Jóvenes. */
export interface JovenIglesia {
  id: string;
  nombre_completo: string;
  sexo: Sexo;
  edad: number;
  casa_de_paz_etiqueta: string | null;
  red_nombre: string | null;
  estado_sigla: string | null;
  telefono_principal: string | null;
}

/** Fila de fn_matrimonios_iglesia -- pareja como unidad (familia.tipo_relacion CONYUGE). */
export interface MatrimonioIglesia {
  persona1_id: string;
  persona1_nombre: string;
  persona1_sexo: Sexo;
  persona2_id: string;
  persona2_nombre: string;
  persona2_sexo: Sexo;
  casa_de_paz_etiqueta: string | null;
}
