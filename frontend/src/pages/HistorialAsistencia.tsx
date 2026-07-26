import { useState } from 'react';
import { AlertTriangle, PhoneCall, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DonutRing } from '@/components/dashboard/DonutRing';
import { HistorialAsistencia as HistorialAsistenciaSeccion } from '@/components/reporte/HistorialAsistencia';
import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';
import { useAuthStore } from '@/store/auth.store';
import { useMisCasasDePaz } from '@/hooks/useCalendario';
import { useHistorialAsistencia } from '@/hooks/useReporte';

const UMBRAL_URGENCIA = 2;

function faltasConsecutivas(asistio: boolean[]) {
  let n = 0;
  for (const presente of asistio) {
    if (presente) break;
    n++;
  }
  return n;
}

export function HistorialAsistencia() {
  const personaId = useAuthStore((s) => s.personaId);
  const { data: misCasas, isLoading: cargandoCasas } = useMisCasasDePaz(personaId);
  const [casaDePazId, setCasaDePazId] = useState<string>();
  const cdpActiva = casaDePazId ?? misCasas?.[0]?.casa_de_paz_id;

  // Misma queryKey que usa el componente de abajo -- React Query comparte el
  // cache, así que esto no dispara una segunda consulta a la red.
  const { data } = useHistorialAsistencia(cdpActiva);
  const totalMiembros = data?.miembros.length ?? 0;
  const totalUrgentes = data ? data.miembros.filter((m) => faltasConsecutivas(m.asistio) >= UMBRAL_URGENCIA).length : 0;
  const totalAsistencias = data ? data.miembros.reduce((acc, m) => acc + m.asistio.filter(Boolean).length, 0) : 0;
  const totalPosibles = data ? data.miembros.length * data.reuniones.length : 0;
  const participacion = totalPosibles > 0 ? Math.round((totalAsistencias / totalPosibles) * 100) : null;

  if (cargandoCasas) return <Skeleton className="h-96 w-full rounded-2xl" />;

  if (!misCasas || misCasas.length === 0) {
    return (
      <ProximamentePlaceholder
        titulo="Historial de Asistencia"
        descripcion="Todavía no tenés una Casa de Paz asignada como líder o sublíder, así que no hay historial que mostrar."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#6366f1]/10">
            <PhoneCall className="h-5 w-5" style={{ color: '#6366f1' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Historial de Asistencia</h1>
            <p className="mt-0.5 text-[13px] text-muted-foreground">Quién viene, quién se está alejando, y a quién llamar primero</p>
          </div>
        </div>
        {misCasas.length > 1 && (
          <Select value={cdpActiva} onValueChange={setCasaDePazId}>
            <SelectTrigger className="w-full sm:w-56 rounded-xl border-border/60 bg-background text-sm">
              <SelectValue placeholder="Casa de Paz" />
            </SelectTrigger>
            <SelectContent>
              {misCasas.map((c) => (
                <SelectItem key={c.casa_de_paz_id} value={c.casa_de_paz_id}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {data && totalMiembros > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="glass-card-elevated flex items-center gap-4 rounded-2xl p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: '#ec4899' }}>
              <Users className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Miembros</p>
              <p className="text-2xl font-bold tracking-tight text-foreground">{totalMiembros}</p>
            </div>
          </div>

          {/* Rojo reservado para esto -- es la unica señal realmente urgente de la página. */}
          <div className="glass-card-elevated flex items-center gap-4 rounded-2xl p-4">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: totalUrgentes > 0 ? 'var(--destructive)' : 'var(--muted)' }}
            >
              <AlertTriangle className={totalUrgentes > 0 ? 'h-5 w-5 text-white' : 'h-5 w-5 text-muted-foreground'} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Con 2+ faltas seguidas</p>
              <p className="text-2xl font-bold tracking-tight text-foreground">{totalUrgentes}</p>
            </div>
          </div>

          <div className="glass-card-elevated flex items-center gap-4 rounded-2xl p-4">
            <DonutRing
              porcentaje={participacion}
              size={52}
              strokeWidth={6}
              color={participacion != null && participacion < 60 ? '#f59e0b' : '#06b6d4'}
            >
              <span className="text-xs font-bold text-foreground">{participacion != null ? `${participacion}%` : '—'}</span>
            </DonutRing>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Participación</p>
              <p className="text-[11px] text-muted-foreground">Últimas {data.reuniones.length} reuniones</p>
            </div>
          </div>
        </div>
      )}

      <HistorialAsistenciaSeccion casaDePazId={cdpActiva} />
    </div>
  );
}
