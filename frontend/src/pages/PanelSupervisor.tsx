import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Building2, LayoutGrid, Settings2, Wallet } from 'lucide-react';
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
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { AMBAR, AZUL, MARINO, MORADO, TEAL } from '@/components/dashboard/DashboardUI';
import { useAuthStore } from '@/store/auth.store';
import {
  useAsignarCargoDepartamento,
  useCambiarMonedaDefecto,
  useCargoVigenteDepartamento,
  useMonedasActivas,
  usePanelConfiguracion,
  useQuitarCargoDepartamento,
  useRenombrarIglesia,
  useSetConfiguracion,
  useToggleDepartamento,
} from '@/hooks/usePanelSupervisor';
import { useCargos } from '@/hooks/useCasasDePaz';
import { ConfiguracionRow } from '@/components/panel-supervisor/ConfiguracionRow';
import { ConfirmarCambioDialog } from '@/components/shared/ConfirmarCambioDialog';
import { AsignarCargoDialog } from '@/components/casas-de-paz/AsignarCargoDialog';
import type { DepartamentoItem } from '@/types/panel-supervisor.types';

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

  // Líder de Departamento (básico, 2026-08-01): hoy solo existe el
  // Departamento de Afirmación -- no había ninguna pantalla para asignarlo,
  // solo "se hace por DB" (ver 47_departamento_cargo.sql).
  const [deptoLiderDialogo, setDeptoLiderDialogo] = useState<DepartamentoItem | null>(null);
  const { data: cargos = [] } = useCargos();
  const cargoLiderDepartamento = cargos.find((c) => c.codigo === 'LIDER_DEPARTAMENTO');
  const { data: vigentesDepto = [], isLoading: cargandoVigentesDepto } = useCargoVigenteDepartamento(deptoLiderDialogo?.id);
  const asignarCargoDepto = useAsignarCargoDepartamento(iglesiaActivaId);
  const quitarCargoDepto = useQuitarCargoDepartamento(deptoLiderDialogo?.id);

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

  async function handleAsignarLiderDepartamento(persona: { id: string; nombre_completo: string }) {
    if (!deptoLiderDialogo || !cargoLiderDepartamento) return;
    try {
      await asignarCargoDepto.mutateAsync({
        departamentoId: deptoLiderDialogo.id,
        personaId: persona.id,
        cargoId: cargoLiderDepartamento.id,
      });
      toast.success(`${persona.nombre_completo} asignado`);
    } catch {
      toast.error('No se pudo asignar el líder del departamento');
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
        <TarjetaHeader
          icon={Building2}
          color={MARINO}
          titulo="Nombre de la iglesia"
          descripcion={`Se muestra como "${prefijoIglesia || '…'} ${sufijoIglesia || '…'}".`}
        />
        <div className="flex flex-col gap-2 p-5 sm:flex-row sm:items-end">
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
        </div>
      </section>

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

      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader
          icon={LayoutGrid}
          color={AMBAR}
          titulo="Departamentos"
          descripcion="Desactivar oculta el departamento de los dashboards; conserva el histórico."
        />
        <div className="flex flex-col gap-3 p-5">
          {panel.departamentos.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3">
              <Label className="text-sm text-foreground">{d.nombre}</Label>
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" size="sm" onClick={() => setDeptoLiderDialogo(d)}>
                  Líder
                </Button>
                <Switch
                  checked={d.activo}
                  onCheckedChange={(checked) => handleToggleDepto(d.id, checked)}
                />
              </div>
            </div>
          ))}
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

      {deptoLiderDialogo && (
        <AsignarCargoDialog
          open={!!deptoLiderDialogo}
          onOpenChange={(open) => !open && setDeptoLiderDialogo(null)}
          titulo={`Líder de ${deptoLiderDialogo.nombre}`}
          exclusivo
          iglesiaId={iglesiaActivaId}
          vigentes={vigentesDepto}
          cargandoVigentes={cargandoVigentesDepto}
          asignando={asignarCargoDepto.isPending}
          onAsignar={handleAsignarLiderDepartamento}
          onQuitar={(id) => quitarCargoDepto.mutate(id, { onError: () => toast.error('No se pudo quitar el cargo') })}
        />
      )}
    </div>
  );
}
