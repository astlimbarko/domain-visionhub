import { useState } from 'react';
import { toast } from 'sonner';
import { Bell, Check, CheckCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useMarcarNotificacionLeida, useMarcarTodasLeidas, useMisNotificaciones, useNotificacionesNoLeidasCount } from '@/hooks/useNotificaciones';
import { useAprobarSolicitudEstructura, useRechazarSolicitudEstructura } from '@/hooks/useSolicitudesEstructura';
import type { Notificacion } from '@/types/notificacion.types';

function fmtFechaHora(fechaISO: string) {
  return new Date(fechaISO).toLocaleString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function ItemNotificacion({ n, onLeer }: { n: Notificacion; onLeer: (id: string) => void }) {
  const aprobar = useAprobarSolicitudEstructura();
  const rechazar = useRechazarSolicitudEstructura();
  // Una vez resuelta (aprobada/rechazada) la solicitud ya no existe como
  // pendiente -- se oculta la acción localmente sin esperar el refetch.
  const [resuelta, setResuelta] = useState(false);
  const esSolicitudPendiente = n.tipo === 'SOLICITUD_ESTRUCTURA' && n.entidad_id && !resuelta;

  function manejarAprobar() {
    if (!n.entidad_id) return;
    aprobar.mutate(n.entidad_id, {
      onSuccess: () => { setResuelta(true); toast.success('Solicitud aprobada'); },
      onError: () => toast.error('No se pudo aprobar la solicitud'),
    });
  }

  function manejarRechazar() {
    if (!n.entidad_id) return;
    rechazar.mutate({ id: n.entidad_id }, {
      onSuccess: () => { setResuelta(true); toast.success('Solicitud rechazada'); },
      onError: () => toast.error('No se pudo rechazar la solicitud'),
    });
  }

  return (
    <div className="flex w-full flex-col gap-1.5 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/60">
      <button type="button" onClick={() => !n.leida && onLeer(n.id)} className="flex w-full flex-col gap-0.5 text-left">
        <div className="flex items-center gap-2">
          {!n.leida && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
          <p className={`min-w-0 truncate text-[13px] font-semibold ${n.leida ? 'text-muted-foreground' : 'text-foreground'}`}>{n.titulo}</p>
        </div>
        <p className="line-clamp-2 pl-3.5 text-[12px] text-muted-foreground">{n.mensaje}</p>
        <p className="pl-3.5 text-[11px] text-muted-foreground/70">{fmtFechaHora(n.fecha_creacion)}</p>
      </button>
      {esSolicitudPendiente && (
        <div className="flex gap-1.5 pl-3.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 rounded-lg text-xs"
            disabled={aprobar.isPending || rechazar.isPending}
            onClick={manejarAprobar}
          >
            {aprobar.isPending ? <Spinner className="h-3 w-3" /> : <Check className="h-3 w-3" />}
            Aprobar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 rounded-lg text-xs text-destructive hover:text-destructive"
            disabled={aprobar.isPending || rechazar.isPending}
            onClick={manejarRechazar}
          >
            {rechazar.isPending ? <Spinner className="h-3 w-3" /> : <X className="h-3 w-3" />}
            Rechazar
          </Button>
        </div>
      )}
    </div>
  );
}

/** Campanita de notificaciones -- visible para todos los roles, ya que cualquiera puede ser destinatario. */
export function NotificacionesBell() {
  const { data: notificaciones = [], isLoading } = useMisNotificaciones();
  const { data: noLeidasCount = 0 } = useNotificacionesNoLeidasCount();
  const marcarLeida = useMarcarNotificacionLeida();
  const marcarTodas = useMarcarTodasLeidas();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-xl" aria-label="Notificaciones">
          <Bell className="h-[18px] w-[18px]" />
          {noLeidasCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 justify-center rounded-full px-1 text-[9px]">
              {noLeidasCount > 9 ? '9+' : noLeidasCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-2">
        <div className="flex items-center justify-between px-1.5 py-1">
          <span className="text-[13px] font-semibold text-foreground">Notificaciones</span>
          {noLeidasCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 gap-1 rounded-lg text-xs" onClick={() => marcarTodas.mutate()}>
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas
            </Button>
          )}
        </div>
        <div className="flex max-h-96 flex-col gap-0.5 overflow-y-auto">
          {isLoading && <p className="px-3 py-4 text-center text-sm text-muted-foreground">Cargando…</p>}
          {!isLoading && notificaciones.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">No tenés notificaciones todavía.</p>
          )}
          {notificaciones.map((n) => (
            <ItemNotificacion key={n.id} n={n} onLeer={(id) => marcarLeida.mutate(id)} />
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
