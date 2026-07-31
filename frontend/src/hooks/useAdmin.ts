import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  actualizarIglesia,
  actualizarUsuarioRol,
  buscarCuentas,
  crearIglesia,
  crearUsuarioRol,
  eliminarIglesia,
  invitarUsuario,
  obtenerDashboardSuperAdmin,
  obtenerIglesiasTodas,
  obtenerUsuarios,
  toggleIglesiaActiva,
  toggleUsuarioRol,
} from '@/services/admin.service';
import type { RolSistema } from '@/types/auth.types';

export function useIglesiasTodas() {
  return useQuery({ queryKey: ['admin', 'iglesias'], queryFn: obtenerIglesiasTodas });
}

export function useDashboardSuperAdmin() {
  return useQuery({ queryKey: ['admin', 'dashboard-super-admin'], queryFn: obtenerDashboardSuperAdmin });
}

export function useUsuarios(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'usuarios', iglesiaId ?? 'todas'],
    queryFn: () => obtenerUsuarios(iglesiaId),
  });
}

/** Opción 1 del alta de doble vía (REQ-C-1): busca entre TODAS las cuentas
 * que ya existen (cualquier rol), no solo las administrativas -- a
 * diferencia de useUsuarios, que sólo lista cargos de Super Admin/Pastor/
 * Supervisor. */
export function useBuscarCuentas(busqueda: string) {
  return useQuery({
    queryKey: ['admin', 'buscar-cuentas', busqueda],
    queryFn: () => buscarCuentas(busqueda.trim()),
    enabled: busqueda.trim().length >= 2,
  });
}

export function useCrearIglesia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sufijo,
      ciudad,
      iglesiaPadreId,
      tipo,
      pastorUsuarioId,
      pin,
    }: {
      sufijo: string;
      ciudad: string;
      iglesiaPadreId: string | null;
      tipo: 'HIJA' | 'SATELITE';
      pastorUsuarioId: string | null;
      pin?: string;
    }) => crearIglesia(sufijo, ciudad, iglesiaPadreId, tipo, pastorUsuarioId, pin),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'iglesias'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'usuarios'] });
    },
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

/** Opción 1 del alta de doble vía (REQ-C-1): asignar un cargo nuevo a alguien
 * que ya tiene cuenta en el sistema -- sin invitación, sin correo nuevo. */
export function useAsignarUsuarioExistente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      usuarioId,
      rol,
      iglesiaId,
      pin,
    }: {
      usuarioId: string;
      rol: RolSistema;
      iglesiaId: string | null;
      pin?: string;
    }) => crearUsuarioRol(usuarioId, rol, iglesiaId, pin),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'usuarios'] }),
  });
}

export function useActualizarIglesia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      iglesiaId,
      sufijo,
      ciudad,
      correo,
      pin,
    }: {
      iglesiaId: string;
      sufijo: string;
      ciudad: string;
      correo: string | null;
      pin?: string;
    }) => actualizarIglesia(iglesiaId, sufijo, ciudad, correo, pin),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'iglesias'] }),
  });
}

export function useToggleIglesiaActiva() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ iglesiaId, activa, pin }: { iglesiaId: string; activa: boolean; pin?: string }) =>
      toggleIglesiaActiva(iglesiaId, activa, pin),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'iglesias'] }),
  });
}

export function useEliminarIglesia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ iglesiaId, pin }: { iglesiaId: string; pin?: string }) => eliminarIglesia(iglesiaId, pin),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'iglesias'] }),
  });
}

export function useActualizarUsuarioRol() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      usuarioRolId,
      rol,
      iglesiaId,
      pin,
    }: {
      usuarioRolId: string;
      rol: RolSistema;
      iglesiaId: string | null;
      pin?: string;
    }) => actualizarUsuarioRol(usuarioRolId, rol, iglesiaId, pin),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'usuarios'] }),
  });
}

export function useToggleUsuarioRol() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ usuarioRolId, activo, pin }: { usuarioRolId: string; activo: boolean; pin?: string }) =>
      toggleUsuarioRol(usuarioRolId, activo, pin),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'usuarios'] }),
  });
}
