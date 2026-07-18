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
    mutationFn: ({ sufijo, ciudad, pin }: { sufijo: string; ciudad: string; pin?: string }) => crearIglesia(sufijo, ciudad, pin),
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
      pin,
    }: {
      correo: string;
      rol: RolSistema;
      iglesiaId: string | null;
      pin?: string;
    }) => {
      const resultado = await invitarUsuario(correo, rol, iglesiaId, pin);
      await crearUsuarioRol(resultado.id, rol, iglesiaId, pin);
      return resultado;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'usuarios'] }),
  });
}
