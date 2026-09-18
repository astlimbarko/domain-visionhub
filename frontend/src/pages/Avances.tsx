import { Sparkles, CheckCircle2, Wrench, Home, HeartHandshake, ClipboardCheck, Layers } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { AMBAR, AZUL, VERDE } from '@/components/dashboard/DashboardUI';
import { DEPARTAMENTO_META } from '@/utils/departamentos';
import { useAvancesVisibles } from '@/hooks/useAvance';
import type { Avance, AvanceTipo } from '@/types/avance.types';

/** KAN-388 (2026-09-17, ticket del owner): vista de solo lectura, sin menú
 * lateral, acceso solo por URL directa (/avances) -- ver ROUTES.AVANCES.
 * Extremadamente minimalista a propósito: sin dashboard, sin gráficos, sin
 * buscador, sin filtros, sin botones de creación/edición. La visibilidad de
 * cada publicación ya viene resuelta por el backend (fn_avances_visibles),
 * esta pantalla solo pinta lo que le llega. */

const TIPO_META: Record<AvanceTipo, { label: string; color: string; icon: typeof Sparkles }> = {
  EN_CURSO: { label: 'En curso', color: AMBAR, icon: Wrench },
  TERMINADO: { label: 'Terminado', color: VERDE, icon: CheckCircle2 },
  CORRECCION: { label: 'Corrección', color: AZUL, icon: Sparkles },
};

/** Ícono por Área -- reusa los mismos íconos/colores que el resto del
 * proyecto para la misma Área (Home+#0aa5c0 para Casas de Paz igual que
 * CATALOGO_NAV, HeartHandshake+DEPARTAMENTO_META para los departamentos
 * formales). Área es texto libre (KAN-388 pide que un Área nueva no
 * requiera rediseñar la pantalla) -- lo que no matchea cae al genérico
 * `Layers`, nunca rompe con un Área futura sin mapear. */
const AREA_ICONO: Record<string, { icon: typeof Home; color: string }> = {
  'Casas de Paz': { icon: Home, color: '#0aa5c0' },
  Evangelismo: { icon: HeartHandshake, color: DEPARTAMENTO_META.EVANGELISMO.color },
  Afirmación: { icon: ClipboardCheck, color: DEPARTAMENTO_META.AFIRMACION.color },
};
const AREA_ICONO_DEFECTO = { icon: Layers, color: '#8e8e93' };

function formatearFechaHora(fechaISO: string): { fecha: string; hora: string } {
  const d = new Date(fechaISO);
  const fecha = new Intl.DateTimeFormat('es-BO', { day: '2-digit', month: '2-digit', timeZone: 'America/La_Paz' }).format(d);
  const hora = new Intl.DateTimeFormat('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/La_Paz' }).format(d);
  return { fecha, hora };
}

function FilaAvance({ avance }: { avance: Avance }) {
  const meta = TIPO_META[avance.tipo];
  const Icono = meta.icon;
  const area = avance.area ? (AREA_ICONO[avance.area] ?? AREA_ICONO_DEFECTO) : AREA_ICONO_DEFECTO;
  const AreaIcono = area.icon;
  const { fecha, hora } = formatearFechaHora(avance.fecha_publicacion);

  return (
    <div className="flex items-start gap-3 border-b border-border/60 py-3 first:pt-0 last:border-b-0">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `color-mix(in oklab, ${area.color} 14%, transparent)` }}
      >
        <AreaIcono className="h-4 w-4" style={{ color: area.color }} />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-muted-foreground">
          <span>{fecha} · {hora}</span>
          <span
            className="inline-flex items-center gap-1 rounded-full px-1.5 py-px font-semibold"
            style={{ backgroundColor: `color-mix(in oklab, ${meta.color} 14%, transparent)`, color: meta.color }}
          >
            <Icono className="h-2.5 w-2.5" />
            {meta.label}
          </span>
          {avance.area && <span className="text-muted-foreground/70">{avance.area}</span>}
        </div>
        <h2 className="text-sm font-semibold text-foreground">{avance.titulo}</h2>
        <p className="text-[13px] leading-snug text-muted-foreground">{avance.descripcion}</p>
        <p className="text-[10.5px] text-muted-foreground/60">Alcance: {avance.alcance_nombre}</p>
      </div>
    </div>
  );
}

export function Avances() {
  const { data: avances = [], isLoading } = useAvancesVisibles();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-1 px-1 py-2">
      <h1 className="text-xl font-bold tracking-tight">Avances de VisionHub</h1>
      <p className="mb-3 text-sm text-muted-foreground">Conocé las nuevas funcionalidades y mejoras que estamos incorporando.</p>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : avances.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Todavía no hay avances para mostrar.</p>
      ) : (
        <div className="flex flex-col">
          {avances.map((a) => (
            <FilaAvance key={a.id} avance={a} />
          ))}
        </div>
      )}
    </div>
  );
}
