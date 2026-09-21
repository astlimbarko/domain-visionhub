/**
 * KAN-405: panel de gestión de Colaboradores temporales para la Líder de
 * Afirmación (o Pastor/Supervisor) -- generar código, ver activos con sus
 * 3 acciones (extender/pausar/finalizar), historial + auditoría por
 * Colaborador.
 */
import { useState } from 'react';
import { Users } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { AZUL } from '@/components/dashboard/DashboardUI';
import { Skeleton } from '@/components/ui/skeleton';
import { useColaboradores } from '@/hooks/useColaborador';
import { GenerarCodigoCard } from '@/components/colaborador/GenerarCodigoCard';
import { ColaboradorFila } from '@/components/colaborador/ColaboradorFila';
import { ExtenderColaboradorDialog } from '@/components/colaborador/ExtenderColaboradorDialog';
import { ColaboradorAuditoriaDialog } from '@/components/colaborador/ColaboradorAuditoriaDialog';
import type { ColaboradorListado } from '@/types/colaborador.types';

const DEPARTAMENTO_CODIGO = 'AFIRMACION';

export function AfirmacionColaboradores() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);
  const { data: colaboradores = [], isLoading } = useColaboradores(iglesiaActivaId ?? undefined, DEPARTAMENTO_CODIGO);
  const [extendiendo, setExtendiendo] = useState<ColaboradorListado | null>(null);
  const [auditando, setAuditando] = useState<ColaboradorListado | null>(null);

  if (!iglesiaActivaId) {
    return <p className="text-sm text-muted-foreground">Elegí una iglesia para continuar.</p>;
  }

  const activos = colaboradores.filter((c) => c.estado_calculado === 'ACTIVO' || c.estado_calculado === 'PAUSADO');
  const historial = colaboradores.filter((c) => c.estado_calculado === 'VENCIDO' || c.estado_calculado === 'FINALIZADO');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Colaboradores</h1>
        <p className="text-sm text-muted-foreground">Refuerzos temporales para eventos masivos de Afirmación.</p>
      </div>

      <GenerarCodigoCard iglesiaId={iglesiaActivaId} departamentoCodigo={DEPARTAMENTO_CODIGO} />

      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader icon={Users} color={AZUL} titulo="Colaboradores activos" descripcion="Extender, pausar o finalizar el acceso de cada uno." />
        <div className="flex flex-col gap-2 p-5">
          {isLoading ? (
            <Skeleton className="h-16 w-full rounded-xl" />
          ) : activos.length === 0 ? (
            <p className="rounded-2xl border border-border/50 bg-card/60 px-4 py-6 text-center text-sm text-muted-foreground">
              No hay Colaboradores activos en este momento.
            </p>
          ) : (
            activos.map((c) => (
              <ColaboradorFila
                key={c.id}
                colaborador={c}
                iglesiaId={iglesiaActivaId}
                departamentoCodigo={DEPARTAMENTO_CODIGO}
                onExtender={setExtendiendo}
                onVerAuditoria={setAuditando}
              />
            ))
          )}
        </div>
      </section>

      {historial.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <TarjetaHeader icon={Users} color="var(--muted-foreground)" titulo="Historial" descripcion="Colaboradores vencidos o finalizados." />
          <div className="flex flex-col gap-2 p-5">
            {historial.map((c) => (
              <ColaboradorFila
                key={c.id}
                colaborador={c}
                iglesiaId={iglesiaActivaId}
                departamentoCodigo={DEPARTAMENTO_CODIGO}
                onExtender={setExtendiendo}
                onVerAuditoria={setAuditando}
              />
            ))}
          </div>
        </section>
      )}

      <ExtenderColaboradorDialog
        colaborador={extendiendo}
        iglesiaId={iglesiaActivaId}
        departamentoCodigo={DEPARTAMENTO_CODIGO}
        onOpenChange={(open) => !open && setExtendiendo(null)}
      />
      <ColaboradorAuditoriaDialog colaborador={auditando} onOpenChange={(open) => !open && setAuditando(null)} />
    </div>
  );
}
