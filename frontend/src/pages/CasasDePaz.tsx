import { useState } from 'react';
import { toast } from 'sonner';
import { GitBranch, GitMerge, Home, Plus, Undo2, Users } from 'lucide-react';
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
import {
  useDeshacerFusionCdp,
  useDeshacerFusionRed,
  useFusionarCdp,
  useFusionarRed,
  useFusionesCdp,
  useFusionesRed,
} from '@/hooks/useFusion';
import {
  useMultiplicarCdp,
  useMultiplicarRed,
  useMultiplicacionesCdp,
  useMultiplicacionesRed,
} from '@/hooks/useMultiplicacion';
import { AsignarCargoDialog } from '@/components/casas-de-paz/AsignarCargoDialog';
import { CrearRedDialog } from '@/components/casas-de-paz/CrearRedDialog';
import { CrearCdpDialog } from '@/components/casas-de-paz/CrearCdpDialog';
import { FusionarCdpDialog } from '@/components/casas-de-paz/FusionarCdpDialog';
import { FusionarRedDialog } from '@/components/casas-de-paz/FusionarRedDialog';
import { MultiplicarCdpDialog } from '@/components/casas-de-paz/MultiplicarCdpDialog';
import { MultiplicarRedDialog } from '@/components/casas-de-paz/MultiplicarRedDialog';
import { ConfirmarCambioDialog } from '@/components/shared/ConfirmarCambioDialog';
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
  const iglesias = useAuthStore((s) => s.iglesias);
  const esOperativo = iglesias.find((i) => i.id === iglesiaActivaId)?.es_operativo ?? false;

  const [redSeleccionadaId, setRedSeleccionadaId] = useState<string>();
  const [mostrarCrearRed, setMostrarCrearRed] = useState(false);
  const [mostrarCrearCdp, setMostrarCrearCdp] = useState(false);
  const [mostrarFusionarCdp, setMostrarFusionarCdp] = useState(false);
  const [mostrarFusionarRed, setMostrarFusionarRed] = useState(false);
  const [mostrarMultiplicarCdp, setMostrarMultiplicarCdp] = useState(false);
  const [mostrarMultiplicarRed, setMostrarMultiplicarRed] = useState(false);
  const [deshacerCdpId, setDeshacerCdpId] = useState<string>();
  const [deshacerRedId, setDeshacerRedId] = useState<string>();
  const [dialogoRed, setDialogoRed] = useState<CargoDialogoRed | null>(null);
  const [dialogoCdp, setDialogoCdp] = useState<CargoDialogoCdp | null>(null);

  const { data: cargos = [] } = useCargos();
  const { data: redes = [], isLoading: cargandoRedes } = useRedes(iglesiaActivaId);
  const { data: cdps = [], isLoading: cargandoCdps } = useCdps(iglesiaActivaId, redSeleccionadaId);
  const redSeleccionada = redes.find((r) => r.id === redSeleccionadaId);
  const { data: fusionesCdp = [] } = useFusionesCdp(iglesiaActivaId);
  const { data: fusionesRed = [] } = useFusionesRed(iglesiaActivaId);
  const { data: multiplicacionesCdp = [] } = useMultiplicacionesCdp(iglesiaActivaId);
  const { data: multiplicacionesRed = [] } = useMultiplicacionesRed(iglesiaActivaId);

  const crearRed = useCrearRed(iglesiaActivaId);
  const toggleActivoRed = useToggleActivoRed();
  const crearCdp = useCrearCdp(iglesiaActivaId);
  const toggleActivoCdp = useToggleActivoCdp();
  const asignarCargoRed = useAsignarCargoRed(iglesiaActivaId);
  const asignarCargoCdp = useAsignarCargoCdp(iglesiaActivaId);
  const quitarCargoRed = useQuitarCargoRed();
  const quitarCargoCdp = useQuitarCargoCdp();
  const fusionarCdp = useFusionarCdp();
  const deshacerFusionCdp = useDeshacerFusionCdp();
  const fusionarRed = useFusionarRed();
  const deshacerFusionRed = useDeshacerFusionRed();
  const multiplicarCdp = useMultiplicarCdp();
  const multiplicarRed = useMultiplicarRed();

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
    } else if (mensaje.includes('PIN_INCORRECTO')) {
      toast.error('El PIN es incorrecto');
    } else if (mensaje.includes('FUSION_VENTANA_VENCIDA')) {
      toast.error('Ya se subió un reporte después de la fusión: no se puede deshacer');
    } else if (mensaje.includes('FUSION_YA_DESHECHA')) {
      toast.error('Esta fusión ya fue deshecha');
    } else if (mensaje.includes('FUSION_SIN_PERMISO')) {
      toast.error('No tenés permiso para hacer esta fusión');
    } else if (mensaje.includes('MULTIPLICACION_SIN_PERMISO')) {
      toast.error('No tenés permiso para hacer esta multiplicación');
    } else if (mensaje.includes('MULTIPLICACION_SIN_MIEMBROS') || mensaje.includes('MULTIPLICACION_MIEMBROS_INVALIDOS')) {
      toast.error('Elegí al menos una persona que se vaya a la nueva Casa de Paz');
    } else if (mensaje.includes('MULTIPLICACION_SIN_CDP') || mensaje.includes('MULTIPLICACION_CDP_INVALIDAS')) {
      toast.error('Elegí al menos una Casa de Paz que se vaya a la nueva Red');
    } else if (mensaje.includes('MULTIPLICACION_NOMBRE_OBLIGATORIO')) {
      toast.error('La nueva Red necesita un nombre');
    } else {
      toast.error(generico);
    }
  }

  function fusionarVariosCdp(origenIds: string[], destinoId: string, motivo: string, pin?: string) {
    (async () => {
      for (const origenId of origenIds) {
        await fusionarCdp.mutateAsync({ origenId, destinoId, motivo, pin });
      }
      toast.success('Fusión realizada');
      setMostrarFusionarCdp(false);
    })().catch((e) => manejarError(e, 'No se pudo fusionar'));
  }

  function fusionarVariasRedes(origenIds: string[], destinoId: string, motivo: string, pin?: string) {
    (async () => {
      for (const origenId of origenIds) {
        await fusionarRed.mutateAsync({ origenId, destinoId, motivo, pin });
      }
      toast.success('Fusión realizada');
      setMostrarFusionarRed(false);
    })().catch((e) => manejarError(e, 'No se pudo fusionar'));
  }

  function manejarMultiplicarCdp(params: {
    origenId: string;
    nombreNueva?: string;
    personaIds: string[];
    liderNuevoId?: string;
    motivo: string;
    pin?: string;
  }) {
    multiplicarCdp.mutate(params, {
      onSuccess: () => {
        toast.success('Casa de Paz multiplicada');
        setMostrarMultiplicarCdp(false);
      },
      onError: (e) => manejarError(e, 'No se pudo multiplicar'),
    });
  }

  function manejarMultiplicarRed(params: {
    origenId: string;
    nombreNueva: string;
    cdpIds: string[];
    liderNuevoId?: string;
    motivo: string;
    pin?: string;
  }) {
    multiplicarRed.mutate(params, {
      onSuccess: () => {
        toast.success('Red multiplicada');
        setMostrarMultiplicarRed(false);
      },
      onError: (e) => manejarError(e, 'No se pudo multiplicar'),
    });
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
          {redSeleccionadaId && cdps.map((cdp) => (
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

      <Card className="rounded-2xl lg:col-span-2">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Fusiones</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={!redSeleccionadaId}
              onClick={() => setMostrarFusionarCdp(true)}
            >
              <GitMerge className="h-4 w-4" />
              Fusionar Casas de Paz
            </Button>
            {esOperativo && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setMostrarFusionarRed(true)}>
                <GitMerge className="h-4 w-4" />
                Fusionar Redes
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!redSeleccionadaId && (
            <p className="text-sm text-muted-foreground">
              Elegí una red arriba para poder fusionar sus Casas de Paz. Fusionar Redes no depende de elegir una.
            </p>
          )}

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">Historial de Casas de Paz</p>
            {fusionesCdp.length === 0 && <p className="text-sm text-muted-foreground">Sin fusiones todavía.</p>}
            {fusionesCdp.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <div>
                  <p>
                    <span className="text-muted-foreground">{f.origen_etiqueta}</span> → <span className="font-medium">{f.destino_etiqueta}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(f.fecha_fusion).toLocaleDateString('es-BO')} · {f.motivo}
                    {f.deshecha_en && ` · Deshecha: ${f.deshecha_motivo}`}
                  </p>
                </div>
                {f.puede_deshacer && (
                  <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setDeshacerCdpId(f.id)}>
                    <Undo2 className="h-4 w-4" />
                    Deshacer
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">Historial de Redes</p>
            {fusionesRed.length === 0 && <p className="text-sm text-muted-foreground">Sin fusiones todavía.</p>}
            {fusionesRed.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <div>
                  <p>
                    <span className="text-muted-foreground">{f.origen_nombre}</span> → <span className="font-medium">{f.destino_nombre}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(f.fecha_fusion).toLocaleDateString('es-BO')} · {f.motivo}
                    {f.deshecha_en && ` · Deshecha: ${f.deshecha_motivo}`}
                  </p>
                </div>
                {f.puede_deshacer && (
                  <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setDeshacerRedId(f.id)}>
                    <Undo2 className="h-4 w-4" />
                    Deshacer
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl lg:col-span-2">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Multiplicación</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={!redSeleccionadaId}
              onClick={() => setMostrarMultiplicarCdp(true)}
            >
              <GitBranch className="h-4 w-4" />
              Multiplicar Casa de Paz
            </Button>
            {esOperativo && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setMostrarMultiplicarRed(true)}>
                <GitBranch className="h-4 w-4" />
                Multiplicar Red
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!redSeleccionadaId && (
            <p className="text-sm text-muted-foreground">
              Elegí una red arriba para poder multiplicar sus Casas de Paz. Multiplicar Red no depende de elegir una.
            </p>
          )}

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">Historial de Casas de Paz</p>
            {multiplicacionesCdp.length === 0 && <p className="text-sm text-muted-foreground">Sin multiplicaciones todavía.</p>}
            {multiplicacionesCdp.map((m) => (
              <div key={m.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                <p>
                  <span className="text-muted-foreground">{m.origen_etiqueta}</span> →{' '}
                  <span className="font-medium">{m.nueva_etiqueta}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(m.fecha_multiplicacion).toLocaleDateString('es-BO')} · {m.cantidad_movidos} persona(s) · {m.motivo}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">Historial de Redes</p>
            {multiplicacionesRed.length === 0 && <p className="text-sm text-muted-foreground">Sin multiplicaciones todavía.</p>}
            {multiplicacionesRed.map((m) => (
              <div key={m.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                <p>
                  <span className="text-muted-foreground">{m.origen_nombre}</span> →{' '}
                  <span className="font-medium">{m.nueva_nombre}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(m.fecha_multiplicacion).toLocaleDateString('es-BO')} · {m.cantidad_movidas} Casa(s) de Paz · {m.motivo}
                </p>
              </div>
            ))}
          </div>
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
        iglesiaId={iglesiaActivaId}
        creando={crearCdp.isPending}
        onCrear={(nombre, sublideresIds) => {
          if (!redSeleccionadaId) return;
          crearCdp.mutate(
            { redId: redSeleccionadaId, nombre, sublideresIds },
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

      <FusionarCdpDialog
        open={mostrarFusionarCdp}
        onOpenChange={setMostrarFusionarCdp}
        cdps={cdps}
        procesando={fusionarCdp.isPending}
        onFusionar={fusionarVariosCdp}
      />

      <FusionarRedDialog
        open={mostrarFusionarRed}
        onOpenChange={setMostrarFusionarRed}
        redes={redes}
        procesando={fusionarRed.isPending}
        onFusionar={fusionarVariasRedes}
      />

      <MultiplicarCdpDialog
        open={mostrarMultiplicarCdp}
        onOpenChange={setMostrarMultiplicarCdp}
        cdps={cdps}
        procesando={multiplicarCdp.isPending}
        onMultiplicar={manejarMultiplicarCdp}
      />

      <MultiplicarRedDialog
        open={mostrarMultiplicarRed}
        onOpenChange={setMostrarMultiplicarRed}
        iglesiaId={iglesiaActivaId}
        redes={redes}
        procesando={multiplicarRed.isPending}
        onMultiplicar={manejarMultiplicarRed}
      />

      <ConfirmarCambioDialog
        open={!!deshacerCdpId}
        onOpenChange={(open) => !open && setDeshacerCdpId(undefined)}
        titulo="Deshacer fusión de Casas de Paz"
        descripcion="La Casa de Paz absorbida vuelve a estar activa y sus miembros regresan."
        procesando={deshacerFusionCdp.isPending}
        onConfirmar={(motivo, pin) => {
          if (!deshacerCdpId) return;
          deshacerFusionCdp.mutate(
            { fusionId: deshacerCdpId, motivo, pin },
            {
              onSuccess: () => {
                toast.success('Fusión deshecha');
                setDeshacerCdpId(undefined);
              },
              onError: (e) => manejarError(e, 'No se pudo deshacer la fusión'),
            }
          );
        }}
      />

      <ConfirmarCambioDialog
        open={!!deshacerRedId}
        onOpenChange={(open) => !open && setDeshacerRedId(undefined)}
        titulo="Deshacer fusión de Redes"
        descripcion="La Red absorbida vuelve a estar activa y sus Casas de Paz regresan."
        procesando={deshacerFusionRed.isPending}
        onConfirmar={(motivo, pin) => {
          if (!deshacerRedId) return;
          deshacerFusionRed.mutate(
            { fusionId: deshacerRedId, motivo, pin },
            {
              onSuccess: () => {
                toast.success('Fusión deshecha');
                setDeshacerRedId(undefined);
              },
              onError: (e) => manejarError(e, 'No se pudo deshacer la fusión'),
            }
          );
        }}
      />
    </div>
  );
}
