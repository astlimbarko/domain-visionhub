import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  useSetConfiguracion,
  useToggleDepartamento,
} from '@/hooks/usePanelSupervisor';
import { ConfiguracionRow } from '@/components/panel-supervisor/ConfiguracionRow';

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

  const { data: panel, isLoading } = usePanelConfiguracion(iglesiaActivaId);
  const { data: monedas } = useMonedasActivas(iglesiaActivaId);
  const setConfig = useSetConfiguracion(iglesiaActivaId);
  const toggleDepto = useToggleDepartamento(iglesiaActivaId);
  const cambiarMoneda = useCambiarMonedaDefecto(iglesiaActivaId);

  async function handleGuardar(codigo: string, valor: string) {
    await setConfig.mutateAsync({ codigo, valor });
  }

  async function handleToggleDepto(departamentoId: string, activo: boolean) {
    try {
      await toggleDepto.mutateAsync({ departamentoId, activo });
    } catch {
      toast.error('No se pudo actualizar el departamento');
    }
  }

  async function handleCambiarMoneda(monedaId: string) {
    try {
      await cambiarMoneda.mutateAsync(monedaId);
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
    </div>
  );
}
