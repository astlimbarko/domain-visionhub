import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { CircleAlert, Link2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ConfirmarCambioDialog } from '@/components/shared/ConfirmarCambioDialog';
import { AZUL } from '@/components/dashboard/DashboardUI';
import { useAuthStore } from '@/store/auth.store';
import { useSetConfiguracion } from '@/hooks/usePanelSupervisor';
import { useConfigRegistroUrlAfirmacion } from '@/hooks/useAfirmacion';

interface Props {
  iglesiaId: string;
}

/**
 * KAN-232 (seguimiento): el interruptor general "Registro público por URL
 * activo" (REGISTRO_URL_ACTIVO) solo se veía en el Panel de Configuración
 * del Supervisor/Pastor -- si alguien miraba este panel de Afirmación con
 * todos los enlaces individuales en ACTIVO, no había pista de que el
 * interruptor general seguía apagado ("Enlace no disponible" sin
 * explicación visible). Pedido explícito del owner: que el mismo estado se
 * pueda ver (y, si es Pastor/Supervisor, cambiar) desde acá también.
 *
 * El cambio en sí sigue yendo por fn_set_configuracion -- mismos permisos y
 * mismo PIN de Super Admin de siempre (useSetConfiguracion, ya usado en
 * PanelSupervisor.tsx). Si quien mira este panel es Líder de Afirmación sin
 * ser Pastor/Supervisor, ve el estado pero no puede tocarlo -- coherente con
 * que fn_set_configuracion ya exige ser operativo.
 */
export function InterruptorRegistroUrlAfirmacion({ iglesiaId }: Props) {
  const iglesias = useAuthStore((s) => s.iglesias);
  const esSuperAdmin = useAuthStore((s) => s.esSuperAdmin);
  const puedeCambiar = iglesias.find((i) => i.id === iglesiaId)?.es_operativo ?? false;

  const { data: activo, isLoading } = useConfigRegistroUrlAfirmacion(iglesiaId);
  const setConfig = useSetConfiguracion(iglesiaId);

  const [pinPendiente, setPinPendiente] = useState(false);
  const resolverPin = useRef<((pin: string) => void) | null>(null);
  const rechazarPin = useRef<(() => void) | null>(null);

  function pedirPin(): Promise<string | undefined> {
    if (!esSuperAdmin) return Promise.resolve(undefined);
    return new Promise((resolve, reject) => {
      resolverPin.current = resolve;
      rechazarPin.current = reject;
      setPinPendiente(true);
    });
  }

  async function cambiar(nuevoValor: boolean) {
    try {
      const pin = await pedirPin();
      await setConfig.mutateAsync({ codigo: 'REGISTRO_URL_ACTIVO', valor: nuevoValor ? 'true' : 'false', pin });
      toast.success(nuevoValor ? 'Registro por URL activado para toda la iglesia.' : 'Registro por URL desactivado para toda la iglesia.');
    } catch {
      toast.error('No se pudo cambiar el interruptor');
    }
  }

  if (isLoading) return <Skeleton className="h-16 w-full rounded-2xl" />;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: `color-mix(in oklab, ${AZUL} 14%, transparent)`, color: AZUL }}
          >
            <Link2 className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Registro público por URL activo</p>
            <p className="text-xs text-muted-foreground">
              Interruptor general de esta iglesia -- apagado bloquea TODOS los enlaces de abajo, aunque estén en ACTIVO.
            </p>
          </div>
        </div>

        {puedeCambiar ? (
          <Switch checked={!!activo} disabled={setConfig.isPending} onCheckedChange={cambiar} />
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {!activo && <CircleAlert className="h-3.5 w-3.5" />}
            <span>{activo ? 'Activado' : 'Apagado -- pedile a tu Pastor o Supervisor que lo active'}</span>
          </div>
        )}
      </div>

      <ConfirmarCambioDialog
        open={pinPendiente}
        onOpenChange={(open) => {
          if (!open) {
            rechazarPin.current?.();
            setPinPendiente(false);
          }
        }}
        titulo="Confirmá el cambio"
        descripcion="Como Super Admin, cada cambio de configuración pide tu PIN."
        procesando={false}
        requiereMotivo={false}
        onConfirmar={(_motivo, pin) => {
          resolverPin.current?.(pin ?? '');
          setPinPendiente(false);
        }}
      />
    </>
  );
}
