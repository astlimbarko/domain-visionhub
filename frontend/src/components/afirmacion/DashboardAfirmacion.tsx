/**
 * "Un pequeño dashboard de datos sencillos" (pedido del owner, 2026-07-26):
 * estadisticas derivadas de datos que ya se piden en otras vistas de
 * Afirmacion (useLideresCdpAfirmacion / useUrlsAfirmacion) -- sin RPC nueva.
 *
 * Tarjetas de color solido + texto blanco a proposito (pedido explicito:
 * "colores fuertes y texto blanco para poder notarse"), distinto del
 * <KpiCard> generico (fondo glass + anillo de color) que ya usan los demas
 * dashboards del sistema -- no se toca ese componente compartido, esto es
 * un estilo propio y acotado a Afirmacion.
 */
import type { LucideIcon } from 'lucide-react';
import { Link2, Link2Off, Network, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useLideresCdpAfirmacion, useUrlsAfirmacion } from '@/hooks/useAfirmacion';

interface Props {
  iglesiaId: string;
}

function Estadistica({
  titulo,
  valor,
  subtitulo,
  icon: Icon,
  color,
}: {
  titulo: string;
  valor: number;
  subtitulo: string;
  icon: LucideIcon;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl p-5 text-white shadow-lg" style={{ backgroundColor: color }}>
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-3xl font-bold tracking-tight">{valor}</p>
        <p className="text-[13px] font-semibold">{titulo}</p>
        <p className="text-[11px] text-white/80">{subtitulo}</p>
      </div>
    </div>
  );
}

export function DashboardAfirmacion({ iglesiaId }: Props) {
  const { data: lideres = [], isLoading: cargandoLideres } = useLideresCdpAfirmacion(iglesiaId);
  const { data: urls = [], isLoading: cargandoUrls } = useUrlsAfirmacion(iglesiaId);

  if (cargandoLideres || cargandoUrls) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-3xl" />
        ))}
      </div>
    );
  }

  const activas = urls.filter((u) => u.estado === 'ACTIVO').length;
  const inactivas = urls.filter((u) => u.estado !== 'ACTIVO').length;
  const redesCubiertas = new Set(urls.map((u) => u.red_id).filter(Boolean)).size;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Estadistica titulo="Líderes de CdP" valor={lideres.length} subtitulo="con cargo vigente" icon={Users} color="var(--chart-1)" />
        <Estadistica titulo="URLs activas" valor={activas} subtitulo={`de ${urls.length} en total`} icon={Link2} color="var(--chart-2)" />
        <Estadistica titulo="URLs inactivas" valor={inactivas} subtitulo="pendientes de activar" icon={Link2Off} color="var(--chart-3)" />
        <Estadistica titulo="Redes cubiertas" valor={redesCubiertas} subtitulo="con al menos 1 URL" icon={Network} color="var(--chart-4)" />
      </div>

      {urls.length === 0 && (
        <p className="rounded-2xl border border-border/50 bg-card/60 px-4 py-6 text-center text-sm text-muted-foreground">
          Todavía no hay líderes de Casa de Paz activos en esta iglesia.
        </p>
      )}
    </div>
  );
}
