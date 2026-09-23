import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, ExternalLink, KeyRound, ShieldOff, UserX } from 'lucide-react';
import { ROUTES, rutaEstructuraOrganizacional } from '@/utils/constants';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { ConfirmarCambioDialog } from '@/components/shared/ConfirmarCambioDialog';
import { AMBAR } from '@/components/dashboard/DashboardUI';
import { useCuentasHuerfanas, useDescartarCuentaHuerfana, useInvitarLider } from '@/hooks/useInvitacionLider';
import type { CuentaHuerfana } from '@/types/invitacion-lider.types';

const NOMBRE_ROL: Record<string, string> = {
  LIDER_RED: 'Líder de Red',
  LIDER_CDP: 'Líder de Casa de Paz',
  SUBLIDER_CDP: 'Sublíder de Casa de Paz',
};

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * KAN-424 (2026-09-23, pedido explícito del owner): panel de Super Admin
 * para las cuentas de auth.users que nunca llegaron a tener una Persona
 * vinculada -- quedaron a medias de un alta anterior, o su invitación se
 * canceló después de que la persona ya había confirmado su correo (caso
 * real: juannylp@gmail.com). No es una lista pasiva: "Reparar" reusa el
 * mismo camino que ya arregla esto solo desde cualquier "Invitar por
 * correo" (KAN-425) -- acá solo se autocompletan el correo y el destino
 * que ya tenía, para no tener que ir a buscarla a la pantalla original.
 */
export function CuentasHuerfanas() {
  const { data: cuentas = [], isLoading } = useCuentasHuerfanas();
  const reparar = useInvitarLider();
  const descartar = useDescartarCuentaHuerfana();
  const [descartando, setDescartando] = useState<CuentaHuerfana | null>(null);

  function manejarReparar(c: CuentaHuerfana) {
    if (!c.ultimo_rol) return;
    reparar.mutate(
      {
        correo: c.correo,
        rol: c.ultimo_rol as 'LIDER_RED' | 'LIDER_CDP' | 'SUBLIDER_CDP',
        redId: c.ultimo_red_id,
        casaDePazId: c.ultimo_casa_de_paz_id,
        departamentoId: c.ultimo_departamento_id,
      },
      {
        onSuccess: () => toast.success(`${c.correo}: le mandamos un correo para restablecer su contraseña`),
        onError: (e) => toast.error((e as Error).message || 'No se pudo reparar la cuenta'),
      }
    );
  }

  function confirmarDescarte(_motivo: string, pin?: string) {
    if (!descartando) return;
    descartar.mutate(
      { usuarioId: descartando.usuario_id, pinDescarte: pin },
      {
        onSuccess: () => {
          toast.success(`${descartando.correo} descartada`);
          setDescartando(null);
        },
        onError: (e) => toast.error((e as Error).message || 'No se pudo descartar la cuenta'),
      }
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link to={ROUTES.ADMINISTRACION} className="mb-2 inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" />
          Administración
        </Link>
        <h1 className="text-xl font-semibold text-white">Cuentas huérfanas</h1>
        <p className="text-sm text-white/50">
          Cuentas que ya existen pero nunca llegaron a tener una ficha (Persona) vinculada -- quedaron a medias de un
          alta anterior. "Reparar" le manda un correo para que retome donde quedó, sin tener que volver a invitarla a
          mano.
        </p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
        <TarjetaHeader oscuro icon={UserX} color={AMBAR} titulo="Sin persona vinculada" descripcion={`${cuentas.length} cuenta${cuentas.length === 1 ? '' : 's'}.`} />
        <div className="flex flex-col gap-1.5 p-5">
          {isLoading && <Skeleton className="h-24 w-full rounded-2xl bg-white/5" />}
          {!isLoading && cuentas.length === 0 && (
            <p className="text-sm text-white/50">No hay ninguna cuenta huérfana ahora mismo.</p>
          )}
          {cuentas.map((c) => {
            // Si ya tiene un destino conocido y esa invitación NO está
            // cancelada, ya hay una invitación viva esperando (recién
            // reparada, o nunca tocada) -- "Reparar" de nuevo chocaría con
            // INVITACION_LIDER_YA_PENDIENTE (bug real encontrado al probar
            // en vivo, 2026-09-23: sin este chequeo no había forma de saber,
            // mirando la fila, que ya se había reparado).
            const tieneInvitacionViva = !!c.ultimo_rol && !c.ultima_invitacion_cancelada_en;
            return (
              <div key={c.usuario_id} className="flex flex-col gap-2 rounded-xl border border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{c.correo}</p>
                  <p className="mt-0.5 text-xs text-white/50">
                    Creada el {formatearFecha(c.fecha_creacion)}
                    {' · '}
                    {c.confirmada ? 'confirmó su correo' : 'nunca confirmó su correo'}
                  </p>
                  {c.ultimo_rol && c.ultima_iglesia_nombre ? (
                    <>
                      <p className="mt-1 flex items-center gap-1 text-xs text-white/70">
                        {NOMBRE_ROL[c.ultimo_rol] ?? c.ultimo_rol}
                        {c.ultimo_destino_nombre ? ` -- ${c.ultimo_destino_nombre}` : ''} ({c.ultima_iglesia_nombre})
                        {c.ultima_iglesia_id && (
                          <Link
                            to={rutaEstructuraOrganizacional(c.ultima_iglesia_id)}
                            className="inline-flex items-center gap-0.5 text-teal-300 hover:text-teal-200"
                            title="Asignarla a otro destino desde el Constructor"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                      </p>
                      {tieneInvitacionViva ? (
                        <p className="mt-1 flex items-center gap-1 text-xs text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Ya tiene una invitación pendiente -- esperando que la complete.
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-amber-400">
                          Se le canceló la invitación
                          {c.ultima_invitacion_cancelada_en ? ` el ${formatearFecha(c.ultima_invitacion_cancelada_en)}` : ''}.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-1 text-xs text-white/40">Sin invitación previa conocida.</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {c.ultimo_rol && !tieneInvitacionViva && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-white/15 bg-transparent text-white hover:bg-white/10"
                      disabled={reparar.isPending}
                      onClick={() => manejarReparar(c)}
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      Reparar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-destructive/30 bg-transparent text-destructive hover:bg-destructive/10"
                    onClick={() => setDescartando(c)}
                  >
                    <ShieldOff className="h-3.5 w-3.5" />
                    Descartar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {descartando && (
        <ConfirmarCambioDialog
          open={!!descartando}
          onOpenChange={(open) => !open && setDescartando(null)}
          titulo={`Descartar ${descartando.correo}`}
          descripcion="Queda baneada de forma definitiva y sale de este listado. No se puede deshacer."
          requiereMotivo={false}
          siempreOtp
          oscuro
          procesando={descartar.isPending}
          onConfirmar={confirmarDescarte}
        />
      )}
    </div>
  );
}
