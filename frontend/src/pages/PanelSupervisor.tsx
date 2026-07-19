import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/store/auth.store';
import {
  useCambiarMonedaDefecto,
  useMonedasActivas,
  usePanelConfiguracion,
  useRenombrarIglesia,
  useSetConfiguracion,
  useToggleDepartamento,
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

export function PanelSupervisor() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const esSuperAdmin = useAuthStore((s) => s.esSuperAdmin);

  const { data: panel, isLoading } = usePanelConfiguracion(iglesiaActivaId);
  const { data: monedas } = useMonedasActivas(iglesiaActivaId);
  const setConfig = useSetConfiguracion(iglesiaActivaId);
  const toggleDepto = useToggleDepartamento(iglesiaActivaId);
  const cambiarMoneda = useCambiarMonedaDefecto(iglesiaActivaId);
  const renombrar = useRenombrarIglesia(iglesiaActivaId);

  const [prefijoIglesia, setPrefijoIglesia] = useState('');
  const [sufijoIglesia, setSufijoIglesia] = useState('');

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

  async function handleToggleDepto(departamentoId: string, activo: boolean) {
    try {
      const pin = await pedirPin();
      await toggleDepto.mutateAsync({ departamentoId, activo, pin });
    } catch {
      toast.error('No se pudo actualizar el departamento');
    }
  }

  useEffect(() => {
    if (panel) {
      setPrefijoIglesia(panel.iglesia.prefijo);
      setSufijoIglesia(panel.iglesia.sufijo);
    }
  }, [panel]);

  const nombreSinCambios =
    prefijoIglesia.trim() === panel?.iglesia.prefijo && sufijoIglesia.trim() === panel?.iglesia.sufijo;

  async function handleRenombrar() {
    if (!prefijoIglesia.trim() || !sufijoIglesia.trim() || nombreSinCambios) return;
    try {
      const pin = await pedirPin();
      await renombrar.mutateAsync({ prefijo: prefijoIglesia.trim(), sufijo: sufijoIglesia.trim(), pin });
      toast.success('Nombre de la iglesia actualizado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo renombrar la iglesia');
    }
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
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!panel) return null;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">{panel.advertencia}</p>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Nombre de la iglesia</CardTitle>
          <CardDescription>Se muestra como "{prefijoIglesia || '…'} {sufijoIglesia || '…'}".</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Prefijo</Label>
            <Input value={prefijoIglesia} onChange={(e) => setPrefijoIglesia(e.target.value)} />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Sufijo</Label>
            <Input value={sufijoIglesia} onChange={(e) => setSufijoIglesia(e.target.value)} />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={renombrar.isPending || !prefijoIglesia.trim() || !sufijoIglesia.trim() || nombreSinCambios}
            onClick={handleRenombrar}
          >
            {renombrar.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Moneda por defecto</CardTitle>
          <CardDescription>Solo afecta a los ingresos nuevos.</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Departamentos</CardTitle>
          <CardDescription>Desactivar oculta el departamento de los dashboards; conserva el histórico.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {panel.departamentos.map((d) => (
            <div key={d.id} className="flex items-center justify-between">
              <Label className="text-sm text-foreground">{d.nombre}</Label>
              <Switch
                checked={d.activo}
                onCheckedChange={(checked) => handleToggleDepto(d.id, checked)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {Object.entries(panel.categorias).map(([categoria, items]) => (
        <Card key={categoria} className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">{NOMBRE_CATEGORIA[categoria] ?? categoria}</CardTitle>
          </CardHeader>
          <CardContent>
            {items.map((item) => (
              <ConfiguracionRow key={item.codigo} item={item} onGuardar={handleGuardar} />
            ))}
          </CardContent>
        </Card>
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
