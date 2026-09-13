/**
 * "Un pequeño dashboard de datos sencillos" (pedido del owner, 2026-07-26):
 * estadisticas derivadas de datos que ya se piden en otras vistas de
 * Afirmacion (useLideresCdpAfirmacion / useUrlsAfirmacion) -- sin RPC nueva.
 *
 * Estilo alineado al estandar actual del proyecto (pedido explicito del
 * owner, 2026-09-13): antes tenian color solido + texto blanco a proposito
 * ("colores fuertes para notarse"), distinto de todos los demas dashboards
 * -- ahora usan `CardIndicadorPastel`, el mismo componente que ya usan
 * DashboardLiderCdp.tsx/DashboardLiderRed.tsx y (como variante local
 * clickeable) AfirmacionPersonas.tsx. Puramente informativas, sin onClick
 * -- no se pidio que filtren ni naveguen a ningun lado.
 */
import { FileText, Link2, Link2Off, Network, QrCode, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CardIndicadorPastel } from '@/components/dashboard/CardIndicadorPastel';
import { useEstadisticasRegistroAfirmacion, useLideresCdpAfirmacion, useUrlsAfirmacion } from '@/hooks/useAfirmacion';

interface Props {
  iglesiaId: string;
}

export function DashboardAfirmacion({ iglesiaId }: Props) {
  const { data: lideres = [], isLoading: cargandoLideres } = useLideresCdpAfirmacion(iglesiaId);
  const { data: urls = [], isLoading: cargandoUrls } = useUrlsAfirmacion(iglesiaId);
  const { data: estadisticasRegistro, isLoading: cargandoRegistro } = useEstadisticasRegistroAfirmacion(iglesiaId);

  if (cargandoLideres || cargandoUrls || cargandoRegistro) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[164px] w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  const activas = urls.filter((u) => u.estado === 'ACTIVO').length;
  const inactivas = urls.filter((u) => u.estado !== 'ACTIVO').length;
  const redesCubiertas = new Set(urls.map((u) => u.red_id).filter(Boolean)).size;
  const porUrl = estadisticasRegistro?.por_url ?? 0;
  const porFormulario = estadisticasRegistro?.por_formulario ?? 0;
  const totalRegistros = porUrl + porFormulario;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <CardIndicadorPastel icon={Users} label="Líderes de CdP" color="var(--chart-1)" valor={lideres.length} descripcion="Con cargo vigente" />
        <CardIndicadorPastel icon={Link2} label="URLs activas" color="var(--chart-2)" valor={activas} descripcion={`De ${urls.length} en total`} />
        <CardIndicadorPastel icon={Link2Off} label="URLs inactivas" color="var(--chart-3)" valor={inactivas} descripcion="Pendientes de activar" />
        <CardIndicadorPastel icon={Network} label="Redes cubiertas" color="var(--chart-4)" valor={redesCubiertas} descripcion="Con al menos 1 URL" />
        <CardIndicadorPastel
          icon={QrCode}
          label="Registrados por URL"
          color="var(--brand-navy-soft)"
          valor={porUrl}
          descripcion={totalRegistros > 0 ? `${Math.round((porUrl / totalRegistros) * 100)}% del total` : 'Sin registros todavía'}
        />
        <CardIndicadorPastel
          icon={FileText}
          label="Registrados por formulario"
          color="var(--chart-1)"
          valor={porFormulario}
          descripcion={totalRegistros > 0 ? `${Math.round((porFormulario / totalRegistros) * 100)}% del total` : 'Sin registros todavía'}
        />
      </div>

      {urls.length === 0 && (
        <p className="rounded-2xl border border-border/50 bg-card/60 px-4 py-6 text-center text-sm text-muted-foreground">
          Todavía no hay líderes de Casa de Paz activos en esta iglesia.
        </p>
      )}
    </div>
  );
}
