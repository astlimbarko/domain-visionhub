import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Settings2, Wallet } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { AZUL, MORADO, TEAL } from '@/components/dashboard/DashboardUI';
import { useAuthStore } from '@/store/auth.store';
import {
  useCambiarMonedaDefecto,
  useMonedasActivas,
  usePanelConfiguracion,
  useSetConfiguracion,
} from '@/hooks/usePanelSupervisor';
import { ConfiguracionRow } from '@/components/panel-supervisor/ConfiguracionRow';
import { ConfirmarCambioDialog } from '@/components/shared/ConfirmarCambioDialog';

const NOMBRE_CATEGORIA: Record<string, string> = {
  CDP: 'Casa de Paz',
  SSVA: 'Estados SSVA',
  DASHBOARD_LIDER: 'Dashboard del Líder de CdP',
  DASHBOARD_SUBLIDER: 'Dashboard del Sublíder',
  DASHBOARD_RED: 'Dashboard del Líder de Red',
  FORMULARIO_MEMBRESIA: 'Formulario de membresía',
  FORMULARIO_REPORTE: 'Formulario de reporte semanal',
  NOTIFICACION: 'Notificaciones',
  FAMILIA: 'Conteo de familias',
  REGISTRO: 'Registro público por URL',
};

/**
 * Panel del Supervisor -- solo configuración general (moneda, toggles de
 * funcionalidad). Nombre de la iglesia y Departamentos (2026-08-01, pedido
 * del owner) se sacaron de acá: renombrar la iglesia no está disponible para
 * el Supervisor por ahora, y la gestión de Departamentos vive en su propio
 * menú dedicado ("Departamentos").
 */
export function PanelSupervisor() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const esSuperAdmin = useAuthStore((s) => s.esSuperAdmin);

  const { data: panel, isLoading } = usePanelConfiguracion(iglesiaActivaId);
  const { data: monedas } = useMonedasActivas(iglesiaActivaId);
  const setConfig = useSetConfiguracion(iglesiaActivaId);
  const cambiarMoneda = useCambiarMonedaDefecto(iglesiaActivaId);

  // Como Super Admin, cada cambio pide el PIN antes de aplicarse -- se
  // pausa la funcion async hasta que el dialogo se confirme o se cancele.
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

  async function handleGuardar(codigo: string, valor: string) {
    const pin = await pedirPin();
    await setConfig.mutateAsync({ codigo, valor, pin });
  }

  async function handleCambiarMoneda(monedaId: string) {
    try {
      const pin = await pedirPin();
      await cambiarMoneda.mutateAsync({ monedaId, pin });
      toast.success('Moneda por defecto actualizada. No afecta los ingresos ya registrados.');
    } catch {
      toast.error('No se pudo cambiar la moneda');
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!panel) return null;

  const COLORES_CATEGORIA = [AZUL, MORADO, TEAL];

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">{panel.advertencia}</p>

      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader icon={Wallet} color={TEAL} titulo="Moneda por defecto" descripcion="Solo afecta a los ingresos nuevos." />
        <div className="p-5">
          <Select
            value={monedas?.find((m) => m.codigo === panel.iglesia.moneda_defecto)?.moneda_id ?? ''}
            onValueChange={handleCambiarMoneda}
          >
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {monedas?.map((m) => (
                <SelectItem key={m.moneda_id} value={m.moneda_id}>
                  {m.simbolo} {m.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {Object.entries(panel.categorias).map(([categoria, items], idx) => (
        <section key={categoria} className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <TarjetaHeader
            icon={Settings2}
            color={COLORES_CATEGORIA[idx % COLORES_CATEGORIA.length]}
            titulo={NOMBRE_CATEGORIA[categoria] ?? categoria}
            descripcion="Opciones de configuración de esta sección."
          />
          <div className="p-5">
            {items.map((item) => (
              <ConfiguracionRow key={item.codigo} item={item} onGuardar={handleGuardar} />
            ))}
          </div>
        </section>
      ))}

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
    </div>
  );
}
