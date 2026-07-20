import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/store/auth.store';
import {
  useAgregarParticipante,
  useCrearMinisterio,
  useHacerLiderMinisterio,
  useMinisterios,
  useParticipantesMinisterio,
  useQuitarParticipante,
  useToggleActivoMinisterio,
} from '@/hooks/useMinisterios';
import { CrearMinisterioDialog } from '@/components/ministerios/CrearMinisterioDialog';
import { DetalleMinisterioDialog } from '@/components/ministerios/DetalleMinisterioDialog';
import type { PersonaBusqueda } from '@/types/casas-de-paz.types';

export function Ministerios() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;

  const [mostrarCrear, setMostrarCrear] = useState(false);
  const [ministerioAbiertoId, setMinisterioAbiertoId] = useState<string>();

  const { data: ministerios = [], isLoading } = useMinisterios(iglesiaActivaId);
  const ministerioAbierto = ministerios.find((m) => m.id === ministerioAbiertoId);
  const { data: participantes = [], isLoading: cargandoParticipantes } = useParticipantesMinisterio(ministerioAbiertoId);
  const liderActual = participantes.find((p) => p.es_lider);

  const crearMinisterio = useCrearMinisterio(iglesiaActivaId);
  const toggleActivo = useToggleActivoMinisterio();
  const agregarParticipante = useAgregarParticipante(iglesiaActivaId);
  const quitarParticipante = useQuitarParticipante();
  const hacerLider = useHacerLiderMinisterio();

  function manejarError(e: unknown, generico: string) {
    const error = e as { message?: string } | null;
    const mensaje = typeof error?.message === 'string' ? error.message : '';
    if (mensaje.includes('permission denied') || mensaje.includes('row-level security')) {
      toast.error('No tenés permiso para hacer este cambio');
    } else {
      toast.error(generico);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="glass-card-elevated rounded-2xl p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Ministerios</h2>
          <Button size="sm" className="gap-1.5 rounded-xl shadow-sm shadow-primary/20 active:scale-[0.98]" onClick={() => setMostrarCrear(true)}>
            <Plus className="h-4 w-4" />
            Ministerio
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading && <Skeleton className="h-24 w-full rounded-2xl sm:col-span-2 lg:col-span-3" />}
          {!isLoading && ministerios.length === 0 && (
            <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">Todavía no hay ministerios.</p>
          )}
          {ministerios.map((m) => (
            <div key={m.id} className="flex flex-col gap-2 rounded-2xl border border-border/50 bg-card/60 px-4 py-3.5 transition-all hover:border-primary/20 hover:shadow-sm">
              <button type="button" className="text-left" onClick={() => setMinisterioAbiertoId(m.id)}>
                <p className="text-sm font-semibold">{m.nombre}</p>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {m.participantes_count} persona(s) · {m.lider_nombre ?? 'Sin líder'}
                </p>
              </button>
              <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                Activo
                <Switch
                  checked={m.activo}
                  onCheckedChange={(activo) =>
                    toggleActivo.mutate(
                      { ministerioId: m.id, activo },
                      { onError: (e) => manejarError(e, 'No se pudo cambiar el estado del ministerio') }
                    )
                  }
                />
              </label>
            </div>
          ))}
        </div>
      </div>

      <CrearMinisterioDialog
        open={mostrarCrear}
        onOpenChange={setMostrarCrear}
        creando={crearMinisterio.isPending}
        onCrear={(nombre) =>
          crearMinisterio.mutate(nombre, {
            onSuccess: () => {
              toast.success('Ministerio creado');
              setMostrarCrear(false);
            },
            onError: (e) => manejarError(e, 'No se pudo crear el ministerio'),
          })
        }
      />

      {ministerioAbierto && (
        <DetalleMinisterioDialog
          open={!!ministerioAbiertoId}
          onOpenChange={(open) => !open && setMinisterioAbiertoId(undefined)}
          ministerioNombre={ministerioAbierto.nombre}
          iglesiaId={iglesiaActivaId}
          participantes={participantes}
          cargando={cargandoParticipantes}
          agregando={agregarParticipante.isPending}
          onAgregar={(persona: PersonaBusqueda) => {
            if (!ministerioAbiertoId) return;
            agregarParticipante.mutate(
              { ministerioId: ministerioAbiertoId, personaId: persona.id },
              {
                onSuccess: () => toast.success(`${persona.nombre_completo} agregado`),
                onError: (e) => manejarError(e, 'No se pudo agregar a la persona'),
              }
            );
          }}
          onQuitar={(participanteId) =>
            quitarParticipante.mutate(participanteId, { onError: (e) => manejarError(e, 'No se pudo quitar a la persona') })
          }
          onHacerLider={(participanteId) => {
            hacerLider.mutate(
              { participanteId, liderAnteriorId: liderActual?.id },
              { onError: (e) => manejarError(e, 'No se pudo asignar el liderazgo') }
            );
          }}
        />
      )}
    </div>
  );
}
