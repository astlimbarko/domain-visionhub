import { Sparkles, CheckCircle2, Wrench } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { AMBAR, AZUL, VERDE } from '@/components/dashboard/DashboardUI';
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

function formatearFechaHora(fechaISO: string): { fecha: string; hora: string } {
  const d = new Date(fechaISO);
  const fecha = new Intl.DateTimeFormat('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/La_Paz' }).format(d);
  const hora = new Intl.DateTimeFormat('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/La_Paz' }).format(d);
  return { fecha, hora };
}

function FilaAvance({ avance }: { avance: Avance }) {
  const meta = TIPO_META[avance.tipo];
  const Icono = meta.icon;
  const { fecha, hora } = formatearFechaHora(avance.fecha_publicacion);

  return (
    <div className="flex flex-col gap-2 border-b border-border/60 py-5 first:pt-0 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span>{fecha}</span>
        <span>·</span>
        <span>{hora}</span>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold"
          style={{ backgroundColor: `color-mix(in oklab, ${meta.color} 14%, transparent)`, color: meta.color }}
        >
          <Icono className="h-3 w-3" />
          {meta.label}
        </span>
        {avance.area && (
          <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground">{avance.area}</span>
        )}
      </div>
      <h2 className="text-[15px] font-semibold text-foreground">{avance.titulo}</h2>
      <p className="text-sm text-muted-foreground">{avance.descripcion}</p>
      <p className="text-[11px] text-muted-foreground/70">Alcance: {avance.alcance_nombre}</p>
    </div>
  );
}

export function Avances() {
  const { data: avances = [], isLoading } = useAvancesVisibles();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-1 px-1 py-2">
      <h1 className="text-xl font-bold tracking-tight">Avances de VisionHub</h1>
      <p className="mb-4 text-sm text-muted-foreground">Conocé las nuevas funcionalidades y mejoras que estamos incorporando.</p>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
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
