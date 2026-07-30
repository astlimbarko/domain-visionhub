import { useState, type ReactNode } from 'react';
import { AlertTriangle, Users, type LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { mosaico, AZUL, VERDE, MARINO } from '@/components/dashboard/DashboardUI';
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

/** Card compacta con el degradado del dashboard: ícono o donut a la izquierda, número y etiqueta a la derecha. */
function StatMini({
  color,
  icon: Icon,
  valor,
  label,
  sub,
  visual,
}: {
  color: string;
  icon?: LucideIcon;
  valor?: ReactNode;
  label: string;
  sub?: ReactNode;
  visual?: ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-3 overflow-hidden rounded-2xl p-4 text-white"
      style={{ background: mosaico(color), boxShadow: `0 12px 22px -14px color-mix(in oklab, ${color} 75%, transparent)` }}
    >
      {visual ?? (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
          {Icon && <Icon className="h-5 w-5" strokeWidth={2.2} />}
        </span>
      )}
      <div className="min-w-0">
        {valor !== undefined && (
          <p className="text-2xl leading-none font-bold tabular-nums [text-shadow:0_1px_2px_rgb(0_0_0_/_0.18)]">{valor}</p>
        )}
        <p className="mt-1 text-[11px] font-semibold tracking-wider text-white/85 uppercase">{label}</p>
        {sub && <p className="text-[11px] text-white/75">{sub}</p>}
      </div>
    </div>
  );
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
      <div className="flex justify-end">
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
          <StatMini color={AZUL} icon={Users} valor={totalMiembros} label="Miembros" />
          {/* Rojo reservado para esto -- es la única señal realmente urgente de la página. */}
          <StatMini
            color={totalUrgentes > 0 ? 'var(--destructive)' : MARINO}
            icon={AlertTriangle}
            valor={totalUrgentes}
            label="Con 2+ faltas seguidas"
          />
          <StatMini
            color={VERDE}
            label="Participación"
            sub={`Últimas ${data.reuniones.length} reuniones`}
            visual={
              <DonutRing porcentaje={participacion} size={48} strokeWidth={6} color="white" trackColor="rgba(255,255,255,0.3)">
                <span className="text-[11px] font-bold text-white">{participacion != null ? `${participacion}%` : '—'}</span>
              </DonutRing>
            }
          />
        </div>
      )}

      <HistorialAsistenciaSeccion casaDePazId={cdpActiva} />
    </div>
  );
}
