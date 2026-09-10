import { supabase } from './supabase';
import { comprimirImagenExacta } from '@/utils/comprimirImagen';

const BUCKET_FOTOS_PERFIL = 'fotos-perfil';
/** 1:1, fijo -- ver harness/18-fotos-perfil/technical-design.md. */
const LADO_AVATAR = 250;

/**
 * Sube (o reemplaza) la foto de perfil de una persona -- path determinístico
 * {iglesiaId}/{personaId}.jpg con upsert:true, así nunca queda un archivo
 * huérfano al cambiar de foto (KAN-210). Comprime siempre a 250x250 JPG
 * calidad 80% antes de subir (KAN-207, recorte "cover" -- la imagen de
 * entrada ya viene recortada 1:1 por el usuario en el editor de KAN-209).
 * Actualiza `persona.foto_perfil_path` al final para que quede visible.
 */
export async function subirFotoPerfil(iglesiaId: string, personaId: string, archivo: File | Blob): Promise<string> {
  const comprimida = await comprimirImagenExacta(archivo, { ancho: LADO_AVATAR, alto: LADO_AVATAR });
  const path = `${iglesiaId}/${personaId}.jpg`;
  const { error: errorSubida } = await supabase.storage.from(BUCKET_FOTOS_PERFIL).upload(path, comprimida, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (errorSubida) throw errorSubida;

  const { error: errorPersona } = await supabase.from('persona').update({ foto_perfil_path: path }).eq('id', personaId);
  if (errorPersona) throw errorPersona;

  return path;
}

/**
 * `.download()` en vez de `.createSignedUrl()` -- ambas respetan el mismo RLS
 * de storage.objects, pero createSignedUrl exige 2 viajes de red en cadena
 * (firmar, después bajar); download() lo resuelve en 1 solo, autenticado con
 * la sesión del usuario. Medido en vivo (2026-09-09): cortó ~700ms de demora
 * por foto. El object URL vive mientras dure la pestaña -- no se revoca (el
 * volumen de fotos por sesión es bajo, no vale la complejidad del cleanup).
 */
export async function obtenerUrlFotoPerfil(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET_FOTOS_PERFIL).download(path);
  if (error) throw error;
  return data ? URL.createObjectURL(data) : null;
}

export async function eliminarFotoPerfil(personaId: string, path: string): Promise<void> {
  const { error: errorPersona } = await supabase.from('persona').update({ foto_perfil_path: null }).eq('id', personaId);
  if (errorPersona) throw errorPersona;

  const { error: errorStorage } = await supabase.storage.from(BUCKET_FOTOS_PERFIL).remove([path]);
  if (errorStorage) throw errorStorage;
}
