import { supabase } from './supabase';
import type {
  AnuncioGestion,
  AnuncioPendiente,
  CapacidadAnuncio,
  DatosEditarAnuncio,
  DatosNuevoAnuncio,
  OrientacionImagenAnuncio,
  RolDestinatarioAnuncio,
} from '@/types/anuncio.types';

const BUCKET_ANUNCIOS = 'anuncios';
/** Debe coincidir con el CHECK/allowed_mime_types de la migracion. */
export const TIPOS_IMAGEN_ANUNCIO_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];
export const TAMANIO_MAXIMO_IMAGEN_ANUNCIO = 5 * 1024 * 1024; // 5MB

export async function obtenerCapacidadAnuncio(iglesiaId: string): Promise<CapacidadAnuncio> {
  const { data, error } = await supabase.rpc('fn_anuncio_mi_capacidad', { p_iglesia_id: iglesiaId });
  if (error) throw error;
  return data as CapacidadAnuncio;
}

export async function obtenerRolesDisponiblesAnuncio(
  iglesiaId: string,
  redId: string | null
): Promise<RolDestinatarioAnuncio[]> {
  const { data, error } = await supabase.rpc('fn_anuncio_roles_disponibles', {
    p_iglesia_id: iglesiaId,
    p_red_id: redId,
  });
  if (error) throw error;
  return (data ?? []) as RolDestinatarioAnuncio[];
}

export async function obtenerMisAnunciosGestion(iglesiaId: string, redId?: string | null): Promise<AnuncioGestion[]> {
  const { data, error } = await supabase.rpc('fn_mis_anuncios_gestion', {
    p_iglesia_id: iglesiaId,
    p_red_id: redId ?? null,
  });
  if (error) throw error;
  return (data ?? []) as AnuncioGestion[];
}

/**
 * Sube la imagen a Storage ANTES de crear la fila `anuncio` -- convencion de
 * path {iglesiaId}/{uuid}.{ext} (ver politicas de storage.objects en la
 * migracion): la policy de INSERT solo exige permiso de "crear algun anuncio
 * en esa iglesia", el alcance fino (propia Red) lo valida recien
 * fn_anuncio_crear/actualizar. Devuelve el path relativo (imagen_path), no
 * una URL -- la lectura tambien pasa por RLS de storage.objects.
 */
export async function subirImagenAnuncio(iglesiaId: string, archivo: File): Promise<string> {
  const extension = archivo.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${iglesiaId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(BUCKET_ANUNCIOS).upload(path, archivo, {
    contentType: archivo.type,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function obtenerUrlFirmadaAnuncio(imagenPath: string, expiraSegundos = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET_ANUNCIOS).createSignedUrl(imagenPath, expiraSegundos);
  if (error) throw error;
  return data?.signedUrl ?? null;
}

export async function eliminarImagenAnuncio(imagenPath: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET_ANUNCIOS).remove([imagenPath]);
  if (error) throw error;
}

export async function crearAnuncio(datos: DatosNuevoAnuncio): Promise<string> {
  const { data, error } = await supabase.rpc('fn_anuncio_crear', {
    p_iglesia_id: datos.iglesiaId,
    p_red_id: datos.redId,
    p_titulo: datos.titulo,
    p_mensaje: datos.mensaje,
    p_imagen_path: datos.imagenPath,
    p_imagen_orientacion: datos.imagenOrientacion,
    p_roles_destinatarios: datos.rolesDestinatarios,
    p_fecha_publicacion: datos.fechaPublicacion ?? undefined,
    p_fecha_fin: datos.fechaFin ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function actualizarAnuncio(datos: DatosEditarAnuncio): Promise<string> {
  const { data, error } = await supabase.rpc('fn_anuncio_actualizar', {
    p_anuncio_id: datos.anuncioId,
    p_titulo: datos.titulo,
    p_mensaje: datos.mensaje,
    p_imagen_path: datos.imagenPath,
    p_imagen_orientacion: datos.imagenOrientacion,
    p_roles_destinatarios: datos.rolesDestinatarios,
    p_fecha_publicacion: datos.fechaPublicacion ?? null,
    p_fecha_fin: datos.fechaFin ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function toggleActivoAnuncio(anuncioId: string, activo: boolean): Promise<void> {
  const { error } = await supabase.rpc('fn_anuncio_toggle_activo', { p_anuncio_id: anuncioId, p_activo: activo });
  if (error) throw error;
}

export async function eliminarAnuncio(anuncioId: string): Promise<void> {
  const { error } = await supabase.rpc('fn_anuncio_eliminar', { p_anuncio_id: anuncioId });
  if (error) throw error;
}

// ---- T5/T6/T7: cola de pendientes + registro de visualizacion ----------
// Estas funciones son la base de datos que consume useAnunciosPendientes()
// (hook reusable, ver src/hooks/useAnunciosPendientes.ts) y <ModalAnuncios />
// (componente listo, sin montar -- ver comentario en KAN-106/KAN-107).

export async function obtenerAnunciosPendientes(): Promise<AnuncioPendiente[]> {
  const { data, error } = await supabase.rpc('fn_anuncios_pendientes');
  if (error) throw error;
  return (data ?? []) as AnuncioPendiente[];
}

export async function marcarAnuncioMostrado(anuncioId: string): Promise<void> {
  const { error } = await supabase.rpc('fn_anuncio_marcar_mostrado', { p_anuncio_id: anuncioId });
  if (error) throw error;
}

export async function cerrarAnuncio(anuncioId: string): Promise<void> {
  const { error } = await supabase.rpc('fn_anuncio_cerrar', { p_anuncio_id: anuncioId });
  if (error) throw error;
}

export function validarImagenAnuncio(archivo: File): string | null {
  if (!TIPOS_IMAGEN_ANUNCIO_PERMITIDOS.includes(archivo.type)) {
    return 'La imagen debe ser JPG, PNG o WEBP.';
  }
  if (archivo.size > TAMANIO_MAXIMO_IMAGEN_ANUNCIO) {
    return 'La imagen no puede superar los 5MB.';
  }
  return null;
}

/** Cuadrada (1:1, tolerancia 5%) o vertical (alto > ancho) -- ver regla en
 * la descripcion del epico. Rechaza horizontal explicitamente. */
export function detectarOrientacionImagen(ancho: number, alto: number): OrientacionImagenAnuncio | null {
  const ratio = ancho / alto;
  if (ratio >= 0.95 && ratio <= 1.05) return 'CUADRADA';
  if (alto > ancho) return 'VERTICAL';
  return null;
}
