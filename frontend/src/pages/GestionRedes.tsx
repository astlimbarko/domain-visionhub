import { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Network, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SeccionIconHeader } from '@/components/shared/SeccionIconHeader';
import { AsignarCargoDialog } from '@/components/casas-de-paz/AsignarCargoDialog';
import { CrearRedSupervisorDialog } from '@/components/casas-de-paz/CrearRedSupervisorDialog';
import { ConfirmarCambioDialog } from '@/components/shared/ConfirmarCambioDialog';
import { useCargoVigenteRed, useRedes } from '@/hooks/useCasasDePaz';
import {
  useAsignarLiderRedSupervisor,
  useCrearRedSupervisor,
  useDesactivarRedSupervisor,
  useQuitarLiderRedSupervisor,
} from '@/hooks/useGestionRedes';
import { useInvitarLider } from '@/hooks/useInvitacionLider';
import { useAuthStore } from '@/store/auth.store';
import type { RedResumen } from '@/types/casas-de-paz.types';

function manejarError(e: unknown, generico: string) {
  const mensaje = (e as { message?: string })?.message ?? '';
  if (mensaje.includes('PIN_INCORRECTO')) {
    toast.error('El código de confirmación es incorrecto, expiró, o no fue solicitado');
  } else if (mensaje) {
    toast.error(mensaje);
  } else {
    toast.error(generico);
  }
}

/**
 * Menú "Gestión de Redes" del Supervisor de la Visión en Acción
 * (2026-08-01, pedido del owner): crear/desactivar Redes y designar Líder
 * de Red, con confirmación OTP en todo lo delicado. Reemplaza esa parte de
 * GestionEstructuraVista.tsx (Casas de Paz) para el Supervisor -- ahí queda
 * solo la gestión de CdP, fusiones y multiplicaciones.
 */
export function GestionRedes() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const { data: redes = [], isLoading } = useRedes(iglesiaActivaId);

  const [mostrarCrear, setMostrarCrear] = useState(false);
  const [redDesactivar, setRedDesactivar] = useState<RedResumen | null>(null);
  const [redLiderDialogo, setRedLiderDialogo] = useState<RedResumen | null>(null);
  const [pinLider, setPinLider] = useState('');

  const crearRed = useCrearRedSupervisor(iglesiaActivaId);
  const desactivarRed = useDesactivarRedSupervisor();
  const asignarLider = useAsignarLiderRedSupervisor();
  const invitarLider = useInvitarLider();

  const { data: vigentesLider = [], isLoading: cargandoVigentesLider } = useCargoVigenteRed(redLiderDialogo?.id, 'LIDER_RED');
  const quitarLiderRed = useQuitarLiderRedSupervisor();

  async function handleAsignarLider(persona: { id: string; nombre_completo: string }) {
    if (!redLiderDialogo) return;
    try {
      await asignarLider.mutateAsync({ redId: redLiderDialogo.id, personaId: persona.id, pin: pinLider });
      toast.success(`${persona.nombre_completo} asignado como Líder de Red`);
      setPinLider('');
      setRedLiderDialogo(null);
    } catch (e) {
      manejarError(e, 'No se pudo asignar el Líder de Red');
    }
  }

  function handleInvitarLider(correo: string) {
    if (!redLiderDialogo) return;
    invitarLider.mutate(
      { correo, rol: 'LIDER_RED', redId: redLiderDialogo.id, casaDePazId: null, pin: pinLider },
      {
        onSuccess: () => {
          toast.success(`Invitación enviada a ${correo}`);
          setPinLider('');
          setRedLiderDialogo(null);
        },
        onError: (e) => manejarError(e, 'No se pudo invitar'),
      }
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <SeccionIconHeader icon={Network} color="#5856d6" titulo="Gestión de Redes" descripcion="Crear Redes y designar su Líder -- pide código de confirmación." />
        <Button type="button" className="shrink-0 gap-1.5" onClick={() => setMostrarCrear(true)}>
          <Plus className="h-4 w-4" />
          Red
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {redes.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay redes.</p>}
        {redes.map((red) => (
          <div key={red.id} className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold text-foreground">{red.nombre}</p>
              {!red.activo && (
                <Badge variant="outline" className="shrink-0 text-muted-foreground">Desactivada</Badge>
              )}
            </div>
            {red.lider_nombre ? (
              <p className="text-[13px] text-muted-foreground">Líder: {red.lider_nombre}</p>
            ) : (
              <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[12px] text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Falta designar líder
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setRedLiderDialogo(red)}>
                {red.lider_nombre ? 'Cambiar líder' : 'Designar líder'}
              </Button>
              {red.activo && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setRedDesactivar(red)}
                >
                  Desactivar
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <CrearRedSupervisorDialog
        open={mostrarCrear}
        onOpenChange={setMostrarCrear}
        iglesiaId={iglesiaActivaId}
        creando={crearRed.isPending}
        onCrear={async (nombre, liderPersonaId, liderCorreoNuevo, pin) => {
          try {
            const resultado = await crearRed.mutateAsync({ nombre, liderPersonaId, liderCorreoNuevo, pin });
            if (resultado.error) {
              toast.warning(resultado.error);
            } else {
              toast.success(liderCorreoNuevo || liderPersonaId ? 'Red creada y Líder asignado' : 'Red creada');
            }
            return resultado;
          } catch (e) {
            manejarError(e, 'No se pudo crear la red');
            throw e;
          }
        }}
      />

      {redLiderDialogo && (
        <AsignarCargoDialog
          open={!!redLiderDialogo}
          onOpenChange={(open) => { if (!open) { setRedLiderDialogo(null); setPinLider(''); } }}
          titulo={`Líder de ${redLiderDialogo.nombre}`}
          exclusivo
          iglesiaId={iglesiaActivaId}
          vigentes={vigentesLider}
          cargandoVigentes={cargandoVigentesLider}
          asignando={asignarLider.isPending}
          onAsignar={handleAsignarLider}
          onQuitar={(id, pin) =>
            quitarLiderRed.mutate(
              { id, pin },
              { onSuccess: () => setPinLider(''), onError: (e) => manejarError(e, 'No se pudo quitar el cargo') }
            )
          }
          quitando={quitarLiderRed.isPending}
          invitable
          invitando={invitarLider.isPending}
          onInvitar={handleInvitarLider}
          pin={pinLider}
          onPinChange={setPinLider}
        />
      )}

      <ConfirmarCambioDialog
        open={!!redDesactivar}
        onOpenChange={(open) => !open && setRedDesactivar(null)}
        titulo="Desactivar Red"
        descripcion={redDesactivar ? `"${redDesactivar.nombre}" deja de aparecer como Red activa. No se pierde el histórico.` : undefined}
        procesando={desactivarRed.isPending}
        requiereMotivo={false}
        siempreOtp
        onConfirmar={async (_motivo, pin) => {
          if (!redDesactivar) return;
          try {
            await desactivarRed.mutateAsync({ redId: redDesactivar.id, pin });
            toast.success('Red desactivada');
            setRedDesactivar(null);
          } catch (e) {
            manejarError(e, 'No se pudo desactivar la red');
          }
        }}
      />
    </div>
  );
}
