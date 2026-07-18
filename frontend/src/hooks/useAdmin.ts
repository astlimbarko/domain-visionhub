import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  crearIglesia,
  crearUsuarioRol,
  invitarUsuario,
  obtenerIglesiasTodas,
  obtenerUsuarios,
} from '@/services/admin.service';
import type { RolSistema } from '@/types/auth.types';

export function useIglesiasTodas() {
  return useQuery({ queryKey: ['admin', 'iglesias'], queryFn: obtenerIglesiasTodas });
}

export function useUsuarios(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'usuarios', iglesiaId ?? 'todas'],
    queryFn: () => obtenerUsuarios(iglesiaId),
  });
}

export function useCrearIglesia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sufijo, ciudad }: { sufijo: string; ciudad: string }) => crearIglesia(sufijo, ciudad),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'iglesias'] }),
  });
}

export function useInvitarUsuario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      correo,
      rol,
      iglesiaId,
    }: {
      correo: string;
      rol: RolSistema;
      iglesiaId: string | null;
    }) => {
      const resultado = await invitarUsuario(correo, rol, iglesiaId);
      await crearUsuarioRol(resultado.id, rol, iglesiaId);
      return resultado;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'usuarios'] }),
  });
}
