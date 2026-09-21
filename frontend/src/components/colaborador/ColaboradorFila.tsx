import { useState } from 'react';
import { toast } from 'sonner';
import { Clock, Pause, Play, Square, History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCuentaRegresiva } from '@/hooks/useCuentaRegresiva';
import {
  useFinalizarColaboradorSesion,
  usePausarColaboradorSesion,
  useReanudarColaboradorSesion,
} from '@/hooks/useColaborador';
import type { ColaboradorListado } from '@/types/colaborador.types';

function fmtFechaHora(iso: string) {
  return new Date(iso).toLocaleString('es-BO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const ESTADO_BADGE: Record<ColaboradorListado['estado_calculado'], { label: string; variant: 'default' | 'outline' | 'secondary' | 'destructive' }> = {
  ACTIVO: { label: 'Activo', variant: 'default' },
  PAUSADO: { label: 'Pausado', variant: 'secondary' },
  VENCIDO: { label: 'Vencido', variant: 'outline' },
  FINALIZADO: { label: 'Finalizado', variant: 'outline' },
};

interface Props {
  colaborador: ColaboradorListado;
  iglesiaId: string | undefined;
  departamentoCodigo: string;
  onExtender: (c: ColaboradorListado) => void;
  onVerAuditoria: (c: ColaboradorListado) => void;
}

export function ColaboradorFila({ colaborador, iglesiaId, departamentoCodigo, onExtender, onVerAuditoria }: Props) {
  const [confirmandoFinalizar, setConfirmandoFinalizar] = useState(false);
  const { texto, vencido } = useCuentaRegresiva(colaborador.estado === 'ACTIVO' || colaborador.estado === 'PAUSADO' ? colaborador.fecha_fin : null);
  const pausar = usePausarColaboradorSesion(iglesiaId, departamentoCodigo);
  const reanudar = useReanudarColaboradorSesion(iglesiaId, departamentoCodigo);
  const finalizar = useFinalizarColaboradorSesion(iglesiaId, departamentoCodigo);

  const activo = colaborador.estado_calculado === 'ACTIVO';
  const pausado = colaborador.estado_calculado === 'PAUSADO';
  const enCurso = activo || pausado;
  const badge = ESTADO_BADGE[colaborador.estado_calculado];

  function handlePausarReanudar() {
    if (pausado) {
      reanudar.mutate(colaborador.id, {
        onSuccess: () => toast.success('Colaboración reanudada.'),
        onError: () => toast.error('No se pudo reanudar.'),
      });
    } else {
      pausar.mutate(colaborador.id, {
        onSuccess: () => toast.success('Colaboración pausada.'),
        onError: () => toast.error('No se pudo pausar.'),
      });
    }
  }

  function handleFinalizar() {
    finalizar.mutate(colaborador.id, {
      onSuccess: () => {
        toast.success('Colaboración finalizada.');
        setConfirmandoFinalizar(false);
      },
      onError: () => toast.error('No se pudo finalizar.'),
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/50 bg-muted/30 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{colaborador.persona_nombre}</p>
        <p className="text-[11px] text-muted-foreground">
          Código {colaborador.codigo} · desde {fmtFechaHora(colaborador.fecha_inicio)} · {colaborador.personas_cargadas} persona{colaborador.personas_cargadas === 1 ? '' : 's'} cargada{colaborador.personas_cargadas === 1 ? '' : 's'}
        </p>
      </div>

      <Badge variant={badge.variant}>{badge.label}</Badge>

      {enCurso && !vencido && (
        <Badge variant="outline" className="gap-1.5 text-[12px] font-semibold tabular-nums">
          <Clock className="h-3 w-3" />
          {texto}
        </Badge>
      )}

      <div className="flex shrink-0 items-center gap-1.5">
        <Button variant="ghost" size="icon-sm" title="Ver auditoría" onClick={() => onVerAuditoria(colaborador)}>
          <History className="h-3.5 w-3.5" />
        </Button>

        {enCurso && (
          <>
            <Button variant="outline" size="sm" onClick={() => onExtender(colaborador)}>
              Extender
            </Button>
            <Button variant="outline" size="icon-sm" title={pausado ? 'Reanudar' : 'Pausar'} onClick={handlePausarReanudar} disabled={pausar.isPending || reanudar.isPending}>
              {pausado ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="destructive" size="icon-sm" title="Finalizar" onClick={() => setConfirmandoFinalizar(true)}>
              <Square className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>

      <Dialog open={confirmandoFinalizar} onOpenChange={setConfirmandoFinalizar}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Finalizar colaboración</DialogTitle>
            <DialogDescription>
              {colaborador.persona_nombre} va a perder el acceso al formulario de membresía y a Casas de Paz de inmediato. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmandoFinalizar(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleFinalizar} disabled={finalizar.isPending}>
              {finalizar.isPending ? 'Finalizando...' : 'Finalizar ahora'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
