import type { ReactNode } from 'react';
import { useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Users, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { mosaico, AZUL, VERDE, MARINO } from '@/components/dashboard/DashboardUI';
import { DonutRing } from '@/components/dashboard/DonutRing';
import { HistorialAsistencia as HistorialAsistenciaSeccion } from '@/components/reporte/HistorialAsistencia';
import { HistorialAsistenciaSupervisorVista } from '@/components/reporte/HistorialAsistenciaSupervisorVista';
import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';
import { useContextoActivo } from '@/hooks/useContextoActivo';
import { useCdpPerfil } from '@/hooks/useCasasDePaz';
import { useHistorialAsistencia } from '@/hooks/useReporte';
import { nombreMes } from '@/utils/calendario-fechas';
import type { EstadoAsistenciaReunion } from '@/types/reporte.types';

const UMBRAL_URGENCIA = 2;

/** Cuenta las faltas mas recientes seguidas -- `estados` va de la reunion mas
 * vieja a la mas nueva, asi que se cuenta desde el final hacia atras.
 * 'SIN_REPORTE' no corta la racha ni suma: no hay dato de esa persona, no es
 * su falta. */
function faltasConsecutivas(estados: EstadoAsistenciaReunion[]) {
  let n = 0;
  for (let i = estados.length - 1; i >= 0; i--) {
    const e = estados[i];
    if (e === 'SIN_REPORTE') continue;
    if (e === 'ASISTIO') break;
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
  const { contextoActivo } = useContextoActivo();
  const rolUI = contextoActivo?.rolUI;
  const cdpActiva = contextoActivo?.alcance === 'CDP' ? contextoActivo.cdpId : undefined;

  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth());

  const { data: perfil } = useCdpPerfil(cdpActiva);
  const diaReunion = perfil?.dia_reunion;

  // Misma queryKey que usa el componente de abajo -- React Query comparte el
  // cache, así que esto no dispara una segunda consulta a la red.
  const { data } = useHistorialAsistencia(cdpActiva, anio, mes, diaReunion);
  const totalMiembros = data?.miembros.length ?? 0;
  const totalUrgentes = data ? data.miembros.filter((m) => faltasConsecutivas(m.estados) >= UMBRAL_URGENCIA).length : 0;
  const totalAsistencias = data
    ? data.miembros.reduce((acc, m) => acc + m.estados.filter((e) => e === 'ASISTIO').length, 0)
    : 0;
  // "Posibles" excluye las reuniones sin reporte cargado -- no penalizar la
  // participación de la gente por un reporte que el líder no llegó a subir.
  const totalPosibles = data
    ? data.miembros.reduce((acc, m) => acc + m.estados.filter((e) => e !== 'SIN_REPORTE').length, 0)
    : 0;
  const participacion = totalPosibles > 0 ? Math.round((totalAsistencias / totalPosibles) * 100) : null;

  function irMesAnterior() {
    const f = new Date(anio, mes - 1, 1);
    setAnio(f.getFullYear());
    setMes(f.getMonth());
  }

  function irMesSiguiente() {
    const f = new Date(anio, mes + 1, 1);
    setAnio(f.getFullYear());
    setMes(f.getMonth());
  }

  // El Supervisor no lidera/sublidera ninguna Casa de Paz propia -- ve el
  // historial agrupado por Red de toda la iglesia, no el de una sola CdP.
  if (rolUI === 'SUPERVISOR') return <HistorialAsistenciaSupervisorVista />;

  if (!cdpActiva) {
    return (
      <ProximamentePlaceholder
        titulo="Historial de Asistencia"
        descripcion="Todavía no tenés una Casa de Paz asignada como líder o sublíder, así que no hay historial que mostrar."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Navegación de mes ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 self-start rounded-2xl border border-border/60 bg-muted/20 p-2 pl-4">
        <span className="text-sm font-semibold tracking-tight capitalize">{nombreMes(anio, mes)}</span>
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={irMesAnterior} aria-label="Mes anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={irMesSiguiente} aria-label="Mes siguiente">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {perfil && diaReunion == null ? (
        <ProximamentePlaceholder
          titulo="Falta definir el día de reunión"
          descripcion='Para armar el historial por mes, primero fijá el día en que se reúne tu Casa de Paz desde "Perfil de Casa de Paz".'
        />
      ) : (
        <>
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
                sub={`${nombreMes(anio, mes)}`}
                visual={
                  <DonutRing porcentaje={participacion} size={48} strokeWidth={6} color="white" trackColor="rgba(255,255,255,0.3)">
                    <span className="text-[11px] font-bold text-white">{participacion != null ? `${participacion}%` : '—'}</span>
                  </DonutRing>
                }
              />
            </div>
          )}

          <HistorialAsistenciaSeccion casaDePazId={cdpActiva} anio={anio} mes={mes} diaReunion={diaReunion ?? null} />
        </>
      )}
    </div>
  );
}
