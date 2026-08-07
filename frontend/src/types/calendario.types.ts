export interface TipoEvento {
  id: string;
  codigo: string;
  nombre: string;
  color: string;
  icono: string | null;
}

export interface Evento {
  id: string;
  titulo: string;
  descripcion: string | null;
  tipo_codigo: string;
  tipo_nombre: string;
  color: string;
  icono: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  es_multi_dia: boolean;
  ambito: 'CDP' | 'RED';
}

export interface Cumpleanos {
  persona_id: string;
  nombre: string;
  fecha_cumpleanos: string;
  edad_cumple: number;
}

export interface Proximo {
  clase: 'EVENTO' | 'CUMPLEANOS';
  titulo: string;
  fecha: string;
  dias_faltantes: number;
}

/** Iglesia hija/satélite directa de la iglesia activa (fn_mis_iglesias_hijas) -- el Padre puede ver/crear su calendario. */
export interface IglesiaHija {
  id: string;
  nombre: string;
  tipo: 'HIJA' | 'SATELITE';
}

/** `casa_de_paz_id` xor `red_id` -- mismo par mutuamente excluyente que la
 * constraint `chk_evento_ambito` en la tabla `evento` (13_calendario.sql). Un
 * evento "de la Red" (creado por su Líder) no cuelga de ninguna CdP puntual;
 * ya se ve en todas las suyas vía el OR de `fn_eventos_cdp`. */
export interface NuevoEvento {
  casa_de_paz_id?: string;
  red_id?: string;
  tipo_evento_id: string;
  titulo: string;
  descripcion?: string;
  fecha_inicio: string;
  fecha_fin?: string;
  hora_inicio?: string;
  hora_fin?: string;
  iglesia_id: string;
}

export interface CasaDePazPropia {
  casa_de_paz_id: string;
  nombre: string;
}
