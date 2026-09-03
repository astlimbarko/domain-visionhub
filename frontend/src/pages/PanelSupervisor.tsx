import { useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Bell, ClipboardList, LayoutDashboard, Settings2, SlidersHorizontal, Users, Wallet } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { AZUL, MORADO, TEAL } from '@/components/dashboard/DashboardUI';
import { useAuthStore } from '@/store/auth.store';
import {
  useActivarMoneda,
  useCambiarMonedaDefecto,
  useMonedasActivas,
  useMonedasCatalogo,
  usePanelConfiguracion,
  useSetConfiguracion,
} from '@/hooks/usePanelSupervisor';
import { ConfiguracionRow } from '@/components/panel-supervisor/ConfiguracionRow';
import { ConfirmarCambioDialog } from '@/components/shared/ConfirmarCambioDialog';

const NOMBRE_CATEGORIA: Record<string, string> = {
  CDP: 'Casa de Paz',
  ESTRUCTURA: 'Constructor',
  SSVA: 'Estados SSVA',
  DASHBOARD_LIDER: 'Dashboard del Líder de CdP',
  DASHBOARD_SUBLIDER: 'Dashboard del Sublíder',
  DASHBOARD_RED: 'Dashboard del Líder de Red',
  FORMULARIO_MEMBRESIA: 'Formulario de membresía',
  FORMULARIO_REPORTE: 'Formulario de reporte semanal',
  CONTROL_REPORTES: 'Control de Reportes',
  NOTIFICACION: 'Notificaciones',
  FAMILIA: 'Conteo de familias',
  REGISTRO: 'Registro público por URL',
};

// Agrupa las cards por tema en vez de por pares mecánicos, para que cada
// pestaña tenga un solo nombre claro (no dos títulos pegados con "·").
// Las categorías que llegue del backend y no estén contempladas acá caen en
// un grupo "Otros" al final -- así la pantalla no se rompe si se agrega una
// categoría nueva sin actualizar este mapa.
const GRUPOS_PESTANIA: { id: string; nombre: string; icon: LucideIcon; categorias: string[] }[] = [
  { id: 'general', nombre: 'General', icon: SlidersHorizontal, categorias: ['__moneda', 'CDP', 'ESTRUCTURA'] },
  { id: 'dashboards', nombre: 'Dashboards', icon: LayoutDashboard, categorias: ['DASHBOARD_LIDER', 'DASHBOARD_SUBLIDER', 'DASHBOARD_RED'] },
  { id: 'formularios', nombre: 'Formularios', icon: ClipboardList, categorias: ['FORMULARIO_MEMBRESIA', 'FORMULARIO_REPORTE', 'CONTROL_REPORTES'] },
  { id: 'estados', nombre: 'Estados y familias', icon: Users, categorias: ['SSVA', 'FAMILIA'] },
  { id: 'comunicacion', nombre: 'Notificaciones y registro', icon: Bell, categorias: ['NOTIFICACION', 'REGISTRO'] },
];

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
  const { data: catalogoMonedas } = useMonedasCatalogo(iglesiaActivaId);
  const setConfig = useSetConfiguracion(iglesiaActivaId);
  const cambiarMoneda = useCambiarMonedaDefecto(iglesiaActivaId);
  const activarMonedaMut = useActivarMoneda(iglesiaActivaId);

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

  async function handleActivarMoneda(monedaId: string) {
    try {
      const pin = await pedirPin();
      await activarMonedaMut.mutateAsync({ monedaId, pin });
      toast.success('Moneda activada. Ya podés usarla al enviar reportes.');
    } catch {
      toast.error('No se pudo activar la moneda');
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

  const tarjetaMoneda = {
    id: '__moneda',
    nodo: (
      <section key="__moneda" className="overflow-hidden rounded-2xl border border-border/60 bg-card">
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

          {catalogoMonedas?.some((m) => !m.activaEnIglesia) && (
            <div className="mt-4 flex flex-col gap-1.5 border-t border-border/60 pt-4">
              <Label>Activar otra moneda</Label>
              <Select value="" onValueChange={handleActivarMoneda}>
                <SelectTrigger className="w-full sm:w-56">
                  <SelectValue placeholder="Elegí una moneda del catálogo" />
                </SelectTrigger>
                <SelectContent>
                  {catalogoMonedas.filter((m) => !m.activaEnIglesia).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.simbolo} {m.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </section>
    ),
  };

  const tarjetasCategorias = Object.entries(panel.categorias).map(([categoria, items], idx) => ({
    id: categoria,
    nodo: (
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
    ),
  }));

  const tarjetas = [tarjetaMoneda, ...tarjetasCategorias];
  const mapaTarjetas = new Map(tarjetas.map((t) => [t.id, t]));
  const idsAgrupados = new Set<string>();

  const pestanas = GRUPOS_PESTANIA.map((def) => ({
    id: def.id,
    nombre: def.nombre,
    icon: def.icon,
    tarjetas: def.categorias
      .map((id) => mapaTarjetas.get(id))
      .filter((t): t is (typeof tarjetas)[number] => {
        if (!t) return false;
        idsAgrupados.add(t.id);
        return true;
      }),
  })).filter((p) => p.tarjetas.length > 0);

  const sobrantes = tarjetas.filter((t) => !idsAgrupados.has(t.id));
  if (sobrantes.length > 0) {
    pestanas.push({ id: 'otros', nombre: 'Otros', icon: Settings2, tarjetas: sobrantes });
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">{panel.advertencia}</p>

      <Tabs defaultValue={pestanas[0]?.id}>
        <TabsList>
          {pestanas.map((p) => (
            <TabsTrigger key={p.id} value={p.id}>
              <p.icon />
              {p.nombre}
            </TabsTrigger>
          ))}
        </TabsList>

        {pestanas.map((p) => (
          <TabsContent key={p.id} value={p.id}>
            {p.tarjetas.map((t) => t.nodo)}
          </TabsContent>
        ))}
      </Tabs>

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
