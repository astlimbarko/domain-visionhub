import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aprobarSolicitudEstructura, rechazarSolicitudEstructura } from '@/services/solicitud-estructura.service';

// Aprobar/rechazar puede terminar creando o cambiando Redes, Casas de Paz y
// cargos -- se invalida todo lo que la Gestión Estructural usa, igual que
// hacen fusionar/multiplicar (ver useFusion.ts / useMultiplicacion.ts).
function useInvalidarTrasResolucion() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
    queryClient.invalidateQueries({ queryKey: ['estructura'] });
    queryClient.invalidateQueries({ queryKey: ['fusiones'] });
    queryClient.invalidateQueries({ queryKey: ['multiplicaciones'] });
  };
}

export function useAprobarSolicitudEstructura() {
  const invalidar = useInvalidarTrasResolucion();
  return useMutation({
    mutationFn: (id: string) => aprobarSolicitudEstructura(id),
    onSuccess: invalidar,
  });
}

export function useRechazarSolicitudEstructura() {
  const invalidar = useInvalidarTrasResolucion();
  return useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo?: string }) => rechazarSolicitudEstructura(id, motivo),
    onSuccess: invalidar,
  });
}
