import { useState } from 'react';
import { toast } from 'sonner';
import { Home, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/store/auth.store';
import {
  useAsignarCargoCdp,
  useAsignarCargoRed,
  useCargoVigenteCdp,
  useCargoVigenteRed,
  useCargos,
  useCdps,
  useCrearCdp,
  useCrearRed,
  useQuitarCargoCdp,
  useQuitarCargoRed,
  useRedes,
  useToggleActivoCdp,
  useToggleActivoRed,
} from '@/hooks/useCasasDePaz';
import { AsignarCargoDialog } from '@/components/casas-de-paz/AsignarCargoDialog';
import { CrearRedDialog } from '@/components/casas-de-paz/CrearRedDialog';
import { CrearCdpDialog } from '@/components/casas-de-paz/CrearCdpDialog';
import type { CargoCdpCodigo, CargoRedCodigo, PersonaBusqueda } from '@/types/casas-de-paz.types';

interface CargoDialogoRed {
  redId: string;
  codigo: CargoRedCodigo;
  titulo: string;
  exclusivo: boolean;
}

interface CargoDialogoCdp {
  cdpId: string;
  codigo: CargoCdpCodigo;
  titulo: string;
  exclusivo: boolean;
}

export function CasasDePaz() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;

  const [redSeleccionadaId, setRedSeleccionadaId] = useState<string>();
  const [mostrarCrearRed, setMostrarCrearRed] = useState(false);
  const [mostrarCrearCdp, setMostrarCrearCdp] = useState(false);
  const [dialogoRed, setDialogoRed] = useState<CargoDialogoRed | null>(null);
  const [dialogoCdp, setDialogoCdp] = useState<CargoDialogoCdp | null>(null);

  const { data: cargos = [] } = useCargos();
  const { data: redes = [], isLoading: cargandoRedes } = useRedes(iglesiaActivaId);
  const { data: cdps = [], isLoading: cargandoCdps } = useCdps(iglesiaActivaId, redSeleccionadaId);
  const redSeleccionada = redes.find((r) => r.id === redSeleccionadaId);

  const crearRed = useCrearRed(iglesiaActivaId);
  const toggleActivoRed = useToggleActivoRed();
  const crearCdp = useCrearCdp(iglesiaActivaId);
  const toggleActivoCdp = useToggleActivoCdp();
  const asignarCargoRed = useAsignarCargoRed(iglesiaActivaId);
  const asignarCargoCdp = useAsignarCargoCdp(iglesiaActivaId);
  const quitarCargoRed = useQuitarCargoRed();
  const quitarCargoCdp = useQuitarCargoCdp();

  const { data: vigentesRed = [], isLoading: cargandoVigentesRed } = useCargoVigenteRed(
    dialogoRed?.redId,
    dialogoRed?.codigo ?? 'LIDER_RED'
  );
  const { data: vigentesCdp = [], isLoading: cargandoVigentesCdp } = useCargoVigenteCdp(
    dialogoCdp?.cdpId,
    dialogoCdp?.codigo ?? 'LIDER_CDP'
  );

  function manejarError(e: unknown, generico: string) {
    const error = e as { message?: string } | null;
    const mensaje = typeof error?.message === 'string' ? error.message : '';
    if (mensaje.includes('RED_CON_CDP_ACTIVAS')) {
      toast.error('Esta red tiene Casas de Paz activas: reasignalas antes de desactivarla');
    } else if (mensaje.includes('RED_CARGO_DUPLICADO') || mensaje.includes('CDP_CARGO_DUPLICADO')) {
      toast.error('Ya hay alguien en ese cargo');
    } else if (mensaje.includes('CDP_CARGO_IGLESIA_DISTINTA') || mensaje.includes('CARGO_IGLESIA_DISTINTA')) {
      toast.error('Esa persona no pertenece a esta iglesia');
    } else if (mensaje.includes('permission denied') || mensaje.includes('row-level security')) {
      toast.error('No tenés permiso para hacer este cambio');
    } else {
      toast.error(generico);
    }
  }

  async function manejarAsignarRed(persona: PersonaBusqueda) {
    if (!dialogoRed) return;
    const cargo = cargos.find((c) => c.codigo === dialogoRed.codigo);
    if (!cargo) return;
    try {
      await asignarCargoRed.mutateAsync({
        redId: dialogoRed.redId,
        personaId: persona.id,
        codigo: dialogoRed.codigo,
        cargoId: cargo.id,
      });
      toast.success(`${persona.nombre_completo} asignado`);
    } catch (e) {
      manejarError(e, 'No se pudo asignar el cargo');
    }
  }

  async function manejarAsignarCdp(persona: PersonaBusqueda) {
    if (!dialogoCdp) return;
    const cargo = cargos.find((c) => c.codigo === dialogoCdp.codigo);
    if (!cargo) return;
    try {
      await asignarCargoCdp.mutateAsync({
        cdpId: dialogoCdp.cdpId,
        personaId: persona.id,
        codigo: dialogoCdp.codigo,
        cargoId: cargo.id,
      });
      toast.success(`${persona.nombre_completo} asignado`);
    } catch (e) {
      manejarError(e, 'No se pudo asignar el cargo');
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="rounded-2xl">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Redes</CardTitle>
          <Button size="sm" className="gap-1.5" onClick={() => setMostrarCrearRed(true)}>
            <Plus className="h-4 w-4" />
            Red
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {cargandoRedes && <Skeleton className="h-32 w-full" />}
          {!cargandoRedes && redes.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay redes.</p>}
          {redes.map((red) => (
            <div
              key={red.id}
              className={`flex flex-col gap-2 rounded-xl border px-4 py-3 transition-colors ${
                red.id === redSeleccionadaId ? 'border-primary bg-primary/5' : 'border-border'
              }`}
            >
              <button type="button" className="flex items-center justify-between text-left" onClick={() => setRedSeleccionadaId(red.id)}>
                <div>
                  <p className="font-medium">{red.nombre}</p>
                  <p className="text-sm text-muted-foreground">
                    {red.lider_nombre ?? 'Sin líder'} · {red.cantidad_cdp} CdP
                  </p>
                </div>
                {red.incompleta && (
                  <Badge variant="outline" className="border-amber-500 text-amber-600">
                    Incompleta
                  </Badge>
                )}
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDialogoRed({ redId: red.id, codigo: 'LIDER_RED', titulo: `Líder de ${red.nombre}`, exclusivo: true })}
                >
                  Líder
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDialogoRed({ redId: red.id, codigo: 'SUBLIDER_RED', titulo: `Sublíderes de ${red.nombre}`, exclusivo: false })}
                >
                  Sublíderes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setDialogoRed({
                      redId: red.id,
                      codigo: 'ENCARGADO_DEPARTAMENTOS_RED',
                      titulo: `Encargado de Departamentos de ${red.nombre}`,
                      exclusivo: true,
                    })
                  }
                >
                  Enc. Departamentos
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setDialogoRed({
                      redId: red.id,
                      codigo: 'ENCARGADO_MINISTERIO_RED',
                      titulo: `Encargado de Ministerio de ${red.nombre}`,
                      exclusivo: true,
                    })
                  }
                >
                  Enc. Ministerio
                </Button>
                <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
                  Activa
                  <Switch
                    checked={red.activo}
                    onCheckedChange={(activo) =>
                      toggleActivoRed.mutate(
                        { redId: red.id, activo },
                        { onError: (e) => manejarError(e, 'No se pudo cambiar el estado de la red') }
                      )
                    }
                  />
                </label>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>{redSeleccionada ? `Casas de Paz — ${redSeleccionada.nombre}` : 'Casas de Paz'}</CardTitle>
          <Button size="sm" className="gap-1.5" disabled={!redSeleccionadaId} onClick={() => setMostrarCrearCdp(true)}>
            <Plus className="h-4 w-4" />
            Casa de Paz
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {!redSeleccionadaId && (
            <p className="text-sm text-muted-foreground">Elegí una red de la izquierda para ver sus Casas de Paz.</p>
          )}
          {redSeleccionadaId && cargandoCdps && <Skeleton className="h-32 w-full" />}
          {redSeleccionadaId && !cargandoCdps && cdps.length === 0 && (
            <p className="text-sm text-muted-foreground">Esta red todavía no tiene Casas de Paz.</p>
          )}
          {cdps.map((cdp) => (
            <div key={cdp.id} className="flex flex-col gap-2 rounded-xl border border-border px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="flex items-center gap-1.5 font-medium">
                    <Home className="h-4 w-4 text-muted-foreground" />
                    {cdp.etiqueta}
                  </p>
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {cdp.miembros_count} miembros · {cdp.sublideres_count} sublíder(es)
                    {cdp.anfitrion_nombre && ` · Anfitrión: ${cdp.anfitrion_nombre}`}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDialogoCdp({ cdpId: cdp.id, codigo: 'LIDER_CDP', titulo: `Líder de ${cdp.etiqueta}`, exclusivo: true })}
                >
                  Líder
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDialogoCdp({ cdpId: cdp.id, codigo: 'SUBLIDER_CDP', titulo: `Sublíderes de ${cdp.etiqueta}`, exclusivo: false })}
                >
                  Sublíderes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDialogoCdp({ cdpId: cdp.id, codigo: 'ANFITRION', titulo: `Anfitrión de ${cdp.etiqueta}`, exclusivo: true })}
                >
                  Anfitrión
                </Button>
                <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
                  Activa
                  <Switch
                    checked={cdp.activo}
                    onCheckedChange={(activo) =>
                      toggleActivoCdp.mutate(
                        { cdpId: cdp.id, activo },
                        { onError: (e) => manejarError(e, 'No se pudo cambiar el estado de la casa de paz') }
                      )
                    }
                  />
                </label>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <CrearRedDialog
        open={mostrarCrearRed}
        onOpenChange={setMostrarCrearRed}
        creando={crearRed.isPending}
        onCrear={(nombre) =>
          crearRed.mutate(nombre, {
            onSuccess: () => {
              toast.success('Red creada');
              setMostrarCrearRed(false);
            },
            onError: (e) => manejarError(e, 'No se pudo crear la red'),
          })
        }
      />

      <CrearCdpDialog
        open={mostrarCrearCdp}
        onOpenChange={setMostrarCrearCdp}
        redNombre={redSeleccionada?.nombre}
        creando={crearCdp.isPending}
        onCrear={(nombre) => {
          if (!redSeleccionadaId) return;
          crearCdp.mutate(
            { redId: redSeleccionadaId, nombre },
            {
              onSuccess: () => {
                toast.success('Casa de Paz creada');
                setMostrarCrearCdp(false);
              },
              onError: (e) => manejarError(e, 'No se pudo crear la casa de paz'),
            }
          );
        }}
      />

      {dialogoRed && (
        <AsignarCargoDialog
          open={!!dialogoRed}
          onOpenChange={(open) => !open && setDialogoRed(null)}
          titulo={dialogoRed.titulo}
          exclusivo={dialogoRed.exclusivo}
          iglesiaId={iglesiaActivaId}
          vigentes={vigentesRed}
          cargandoVigentes={cargandoVigentesRed}
          asignando={asignarCargoRed.isPending}
          onAsignar={manejarAsignarRed}
          onQuitar={(id) => quitarCargoRed.mutate(id, { onError: (e) => manejarError(e, 'No se pudo quitar el cargo') })}
        />
      )}

      {dialogoCdp && (
        <AsignarCargoDialog
          open={!!dialogoCdp}
          onOpenChange={(open) => !open && setDialogoCdp(null)}
          titulo={dialogoCdp.titulo}
          exclusivo={dialogoCdp.exclusivo}
          iglesiaId={iglesiaActivaId}
          vigentes={vigentesCdp}
          cargandoVigentes={cargandoVigentesCdp}
          asignando={asignarCargoCdp.isPending}
          onAsignar={manejarAsignarCdp}
          onQuitar={(id) => quitarCargoCdp.mutate(id, { onError: (e) => manejarError(e, 'No se pudo quitar el cargo') })}
        />
      )}
    </div>
  );
}
