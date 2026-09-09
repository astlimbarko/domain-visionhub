import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { eliminarFotoPerfil, obtenerUrlFotoPerfil, subirFotoPerfil } from '@/services/persona-foto.service';

async function obtenerFotoPerfilPath(personaId: string): Promise<string | null> {
  const { data, error } = await supabase.from('persona').select('foto_perfil_path').eq('id', personaId).single();
  if (error) throw error;
  return data.foto_perfil_path;
}

export function useFotoPerfilPath(personaId: string | undefined) {
  return useQuery({
    queryKey: ['persona', 'foto-perfil-path', personaId],
    queryFn: () => obtenerFotoPerfilPath(personaId as string),
    enabled: !!personaId,
  });
}

export function useUrlFotoPerfil(path: string | null | undefined) {
  return useQuery({
    queryKey: ['persona', 'foto-perfil-url', path],
    queryFn: () => obtenerUrlFotoPerfil(path as string),
    enabled: !!path,
    staleTime: 1000 * 60 * 30,
  });
}

export function useSubirFotoPerfil() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ iglesiaId, personaId, archivo }: { iglesiaId: string; personaId: string; archivo: File | Blob }) =>
      subirFotoPerfil(iglesiaId, personaId, archivo),
    onSuccess: (_path, { personaId }) =>
      queryClient.invalidateQueries({ queryKey: ['persona', 'foto-perfil-path', personaId] }),
  });
}

export function useEliminarFotoPerfil() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ personaId, path }: { personaId: string; path: string }) => eliminarFotoPerfil(personaId, path),
    onSuccess: (_data, { personaId }) =>
      queryClient.invalidateQueries({ queryKey: ['persona', 'foto-perfil-path', personaId] }),
  });
}
