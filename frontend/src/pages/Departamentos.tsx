import { useState } from 'react';
import { toast } from 'sonner';
import { Cog, Heart, LayoutGrid, Mail, RefreshCw, User, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SeccionIconHeader } from '@/components/shared/SeccionIconHeader';
import { AsignarCargoDialog } from '@/components/casas-de-paz/AsignarCargoDialog';
import { useCargos } from '@/hooks/useCasasDePaz';
import {
  useAsignarCargoDepartamento,
  useCargoVigenteDepartamento,
  usePanelConfiguracion,
  useQuitarCargoDepartamento,
} from '@/hooks/usePanelSupervisor';
import { useInvitacionesDepartamento, useInvitarLider, useReenviarInvitacionLider } from '@/hooks/useInvitacionLider';
import { useAuthStore } from '@/store/auth.store';
import { DEPARTAMENTO_FUNCIONAL, DEPARTAMENTO_META } from '@/utils/departamentos';
import { useAsignarCargoGlobal, useCargoVigenteGlobal, useQuitarCargoGlobal } from '@/hooks/useRolesGlobalesDatos';
import type { CodigoRolGlobal } from '@/services/roles-globales.service';
import type { DepartamentoItem } from '@/types/panel-supervisor.types';
import type { LucideIcon } from 'lucide-react';

interface Props {
  departamento: DepartamentoItem;
  funcional: boolean;
  iglesiaActivaId: string | undefined;
  invitacionPendiente?: { id: string; correo: string };
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

function DepartamentoCard({ departamento, funcional, iglesiaActivaId, invitacionPendiente }: Props) {
  const meta = DEPARTAMENTO_META[departamento.codigo] ?? { verbo: departamento.nombre, color: '#8e8e93' };
  const [mostrarDialogo, setMostrarDialogo] = useState(false);
  const [pin, setPin] = useState('');

  const { data: cargos = [] } = useCargos();
  const cargoLiderDepartamento = cargos.find((c) => c.codigo === 'LIDER_DEPARTAMENTO');
  const { data: vigentes = [], isLoading: cargandoVigentes } = useCargoVigenteDepartamento(departamento.id);
  const asignarCargo = useAsignarCargoDepartamento(iglesiaActivaId);
  const quitarCargo = useQuitarCargoDepartamento(departamento.id);
  const invitarLider = useInvitarLider();
  const reenviarInvitacion = useReenviarInvitacionLider();

  async function handleAsignar(persona: { id: string; nombre_completo: string }) {
    if (!cargoLiderDepartamento) return;
    try {
      await asignarCargo.mutateAsync({ departamentoId: departamento.id, personaId: persona.id, cargoId: cargoLiderDepartamento.id, pin });
      toast.success(`${persona.nombre_completo} asignado`);
      setPin('');
    } catch (e) {
      manejarErrorCargo(e, 'No se pudo asignar el líder');
    }
  }

  function handleInvitar(correo: string) {
    invitarLider.mutate(
      { correo, rol: null, redId: null, casaDePazId: null, departamentoId: departamento.id, pin },
      {
        onSuccess: () => {
          toast.success(`Invitación enviada a ${correo}`);
          setPin('');
        },
        onError: (e) => manejarErrorCargo(e, 'No se pudo invitar'),
      }
    );
  }

  function handleQuitar(id: string, pinQuitar?: string) {
    quitarCargo.mutate(
      { id, pin: pinQuitar ?? '' },
      {
        onSuccess: () => setPin(''),
        onError: (e) => manejarErrorCargo(e, 'No se pudo quitar el cargo'),
      }
    );
  }

  const liderActual = vigentes[0];

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex items-center gap-3">
        <Cog className="h-9 w-9 shrink-0" strokeWidth={1.8} style={{ color: meta.color }} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{meta.verbo}</p>
          <p className="truncate text-[11px] text-muted-foreground">{departamento.nombre}</p>
        </div>
        {!funcional && (
          <Badge variant="outline" className="ml-auto shrink-0 text-[10px] text-muted-foreground">
            Próximamente
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
        <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        {cargandoVigentes ? (
          <Skeleton className="h-4 w-32" />
        ) : liderActual ? (
          <span className="truncate text-foreground">{liderActual.nombre_completo}</span>
        ) : (
          <span className="truncate text-muted-foreground">Sin líder asignado</span>
        )}
      </div>

      {funcional && invitacionPendiente && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-[12px]">
          <span className="flex min-w-0 items-center gap-1.5 truncate text-amber-700">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Invitación pendiente: {invitacionPendiente.correo}</span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 gap-1 px-2 text-[11px]"
            disabled={reenviarInvitacion.isPending}
            onClick={() =>
              reenviarInvitacion.mutate(invitacionPendiente.id, {
                onSuccess: () => toast.success('Invitación reenviada'),
                onError: () => toast.error('No se pudo reenviar'),
              })
            }
          >
            <RefreshCw className="h-3 w-3" />
            Reenviar
          </Button>
        </div>
      )}

      {funcional ? (
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setMostrarDialogo(true)}>
          {liderActual ? 'Cambiar líder' : 'Asignar líder'}
        </Button>
      ) : (
        <p className="text-[11px] text-muted-foreground">La gestión de este departamento todavía no está disponible.</p>
      )}

      {mostrarDialogo && (
        <AsignarCargoDialog
          open={mostrarDialogo}
          onOpenChange={(abierto) => {
            setMostrarDialogo(abierto);
            if (!abierto) setPin('');
          }}
          titulo={`Líder de ${departamento.nombre}`}
          exclusivo
          iglesiaId={iglesiaActivaId}
          vigentes={vigentes}
          cargandoVigentes={cargandoVigentes}
          asignando={asignarCargo.isPending}
          onAsignar={handleAsignar}
          onQuitar={handleQuitar}
          quitando={quitarCargo.isPending}
          invitable
          invitando={invitarLider.isPending}
          onInvitar={handleInvitar}
          pin={pin}
          onPinChange={setPin}
        />
      )}
    </div>
  );
}

interface RolGlobalCardProps {
  codigo: CodigoRolGlobal;
  nombre: string;
  icon: LucideIcon;
  color: string;
  iglesiaActivaId: string | undefined;
}

/**
 * Roles globales de solo lectura (2026-08-02): a diferencia de los
 * departamentos, no están atados a `departamento_cargo` sino a
 * `persona_cargo` directo (cargo Tipo B de nivel IGLESIA) -- sin OTP, mismo
 * criterio que casa_de_paz_cargo (son roles de solo lectura, no
 * estructurales). Pueden asignarse a varias personas a la vez.
 */
function RolGlobalCard({ codigo, nombre, icon: Icon, color, iglesiaActivaId }: RolGlobalCardProps) {
  const [mostrarDialogo, setMostrarDialogo] = useState(false);
  const { data: vigentes = [], isLoading: cargandoVigentes } = useCargoVigenteGlobal(iglesiaActivaId, codigo);
  const asignarCargo = useAsignarCargoGlobal(iglesiaActivaId, codigo);
  const quitarCargo = useQuitarCargoGlobal(iglesiaActivaId, codigo);

  function handleAsignar(persona: { id: string; nombre_completo: string }) {
    asignarCargo.mutate(persona.id, {
      onSuccess: () => toast.success(`${persona.nombre_completo} asignado`),
      onError: (e) => manejarErrorCargo(e, 'No se pudo asignar'),
    });
  }

  function handleQuitar(id: string) {
    quitarCargo.mutate(id, {
      onError: (e) => manejarErrorCargo(e, 'No se pudo quitar el cargo'),
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: color }}>
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{nombre}</p>
          <p className="truncate text-[11px] text-muted-foreground">Acceso global de solo lectura</p>
        </div>
      </div>

      {cargandoVigentes ? (
        <Skeleton className="h-9 w-full rounded-xl" />
      ) : vigentes.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {vigentes.map((v) => (
            <Badge key={v.id} variant="secondary" className="gap-1 rounded-full">
              {v.nombre_completo}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Sin nadie asignado todavía.</p>
      )}

      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setMostrarDialogo(true)}>
        Asignar
      </Button>

      {mostrarDialogo && (
        <AsignarCargoDialog
          open={mostrarDialogo}
          onOpenChange={setMostrarDialogo}
          titulo={nombre}
          exclusivo={false}
          iglesiaId={iglesiaActivaId}
          vigentes={vigentes}
          cargandoVigentes={cargandoVigentes}
          asignando={asignarCargo.isPending}
          onAsignar={handleAsignar}
          onQuitar={handleQuitar}
          quitando={quitarCargo.isPending}
        />
      )}
    </div>
  );
}

/** Menú dedicado del Supervisor de la Visión en Acción para gestionar a los
 * 4 líderes de departamento (2026-08-01, pedido explícito). Hoy solo
 * Afirmación tiene la asignación funcional -- los otros 3 ya existen en la
 * base pero quedan "Próximamente" hasta que se pida construirlos. */
export function Departamentos() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const { data: panel, isLoading } = usePanelConfiguracion(iglesiaActivaId);
  const { data: invitaciones = [] } = useInvitacionesDepartamento(iglesiaActivaId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (!panel) return null;

  return (
    <div className="flex flex-col gap-6">
      <SeccionIconHeader icon={LayoutGrid} color="#af52de" titulo="Departamentos" descripcion="Un líder por departamento en esta iglesia." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {panel.departamentos.map((d) => {
          const funcional = d.codigo === DEPARTAMENTO_FUNCIONAL;
          const invitacionPendiente = invitaciones.find((i) => i.departamento_id === d.id && i.estado === 'PENDIENTE');
          return (
            <DepartamentoCard
              key={d.id}
              departamento={d}
              funcional={funcional}
              iglesiaActivaId={iglesiaActivaId}
              invitacionPendiente={invitacionPendiente}
            />
          );
        })}
      </div>

      <SeccionIconHeader icon={Users} color="#ff9500" titulo="Roles Globales" descripcion="Acceso de solo lectura a toda la iglesia, sin importar la Red." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <RolGlobalCard codigo="LIDER_JOVENES" nombre="Líder de Jóvenes" icon={Users} color="#ff9500" iglesiaActivaId={iglesiaActivaId} />
        <RolGlobalCard codigo="ENCARGADO_MATRIMONIOS" nombre="Encargado de Matrimonios" icon={Heart} color="#ff375f" iglesiaActivaId={iglesiaActivaId} />
      </div>
    </div>
  );
}
