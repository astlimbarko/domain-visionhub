import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AsignarCargoDialog } from '@/components/casas-de-paz/AsignarCargoDialog';
import { useCargos } from '@/hooks/useCasasDePaz';
import {
  useAsignarCargoDepartamento,
  useCargoVigenteDepartamento,
  useQuitarCargoDepartamento,
} from '@/hooks/usePanelSupervisor';
import { useInvitarLider } from '@/hooks/useInvitacionLider';
import { notificarAsignacionCargoDepartamento } from './estructura.service';
import type { PersonaBusqueda } from '@/types/casas-de-paz.types';

/**
 * Reusa el mismo flujo de doble vía ya construido en Departamentos.tsx
 * (`fn_asignar_cargo_departamento`, `AsignarCargoDialog`) en vez de duplicar
 * la lógica de asignación dentro del organigrama. Único departamento
 * funcional hoy: Afirmación (REQ-DEP-6).
 */
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departamentoId: string;
  departamentoNombre: string;
  iglesiaId: string;
  otpRequerido: boolean;
}

function manejarErrorCargo(e: unknown, generico: string) {
  const mensaje = e instanceof Error ? e.message : '';
  if (mensaje.includes('PIN_INCORRECTO')) {
    toast.error('El código de confirmación es incorrecto, expiró, o no fue solicitado');
  } else if (mensaje) {
    toast.error(mensaje);
  } else {
    toast.error(generico);
  }
}

export function AsignarLiderAfirmacionDialog({ open, onOpenChange, departamentoId, departamentoNombre, iglesiaId, otpRequerido }: Props) {
  const queryClient = useQueryClient();
  const [pin, setPin] = useState('');
  const { data: cargos = [] } = useCargos();
  const cargoLiderDepartamento = cargos.find((c) => c.codigo === 'LIDER_DEPARTAMENTO');
  const { data: vigentes = [], isLoading: cargandoVigentes } = useCargoVigenteDepartamento(departamentoId);
  const asignarCargo = useAsignarCargoDepartamento(iglesiaId);
  const quitarCargo = useQuitarCargoDepartamento(departamentoId);
  const invitarLider = useInvitarLider();

  const invalidarEstructura = () => queryClient.invalidateQueries({ queryKey: ['estructura-organizacional', iglesiaId] });

  async function handleAsignar(persona: PersonaBusqueda) {
    if (!cargoLiderDepartamento) return;
    try {
      await asignarCargo.mutateAsync({ departamentoId, personaId: persona.id, cargoId: cargoLiderDepartamento.id, pin });
      toast.success(`${persona.nombre_completo} asignado`);
      // KAN-16x: aviso por correo, igual que ya hace el mismo flujo para
      // Pastor/Supervisor (notificarAsignacionCargoPrincipal) -- no bloquea
      // si falla, el cargo ya quedó asignado.
      notificarAsignacionCargoDepartamento(departamentoId, persona.id).catch((error) =>
        console.error('No se pudo avisar por correo de la designación', error),
      );
      setPin('');
      void invalidarEstructura();
    } catch (e) {
      manejarErrorCargo(e, 'No se pudo asignar el líder');
    }
  }

  function handleInvitar(correo: string) {
    invitarLider.mutate(
      { correo, rol: null, redId: null, casaDePazId: null, departamentoId, pin },
      {
        onSuccess: (resultado) => {
          // KAN-16x: si el correo ya tenía cuenta, se asignó directo (no se
          // mandó ninguna invitación) -- mensaje distinto para no confundir.
          toast.success(resultado.yaExistia ? 'Asignado a la cuenta existente' : `Invitación enviada a ${correo}`);
          setPin('');
          void invalidarEstructura();
        },
        onError: (e) => manejarErrorCargo(e, 'No se pudo invitar'),
      },
    );
  }

  function handleQuitar(id: string, pinQuitar?: string) {
    quitarCargo.mutate(
      { id, pin: pinQuitar ?? '' },
      {
        onSuccess: () => {
          setPin('');
          void invalidarEstructura();
        },
        onError: (e) => manejarErrorCargo(e, 'No se pudo quitar el cargo'),
      },
    );
  }

  return (
    <AsignarCargoDialog
      open={open}
      onOpenChange={(abierto) => {
        onOpenChange(abierto);
        if (!abierto) setPin('');
      }}
      titulo={`Líder de ${departamentoNombre}`}
      exclusivo
      iglesiaId={iglesiaId}
      vigentes={vigentes}
      cargandoVigentes={cargandoVigentes}
      asignando={asignarCargo.isPending}
      onAsignar={(persona) => void handleAsignar(persona)}
      onQuitar={handleQuitar}
      quitando={quitarCargo.isPending}
      invitable
      invitando={invitarLider.isPending}
      onInvitar={handleInvitar}
      pin={pin}
      onPinChange={setPin}
      otpRequerido={otpRequerido}
    />
  );
}
