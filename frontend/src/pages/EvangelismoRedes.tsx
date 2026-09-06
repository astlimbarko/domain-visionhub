// VisionHub -- detalle del anillo "Evangelizados por Red" del dashboard de
// Evangelismo. Pedido explícito del owner (2026-09-06): página propia, no
// modal -- "es mejor páginas, así hay más espacio... estamos preparados por
// si hay muchas Redes". Llega navegando desde EvangelismoSupervisorVista con
// el mes que se estaba viendo ahí (`navigate(ruta, { state: { desde, hasta } })`);
// si se entra directo (sin ese estado, ej. refresh), cae al mes calendario actual.
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { ChevronLeft, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { AnilloSegmentado, type SegmentoAnillo } from '@/components/evangelismo/AnilloSegmentado';
import { EVANGELISMO_COLOR } from '@/utils/evangelismo-colores';
import { DEPARTAMENTO_META } from '@/utils/departamentos';
import { ROUTES } from '@/utils/constants';
import { useAuthStore } from '@/store/auth.store';
import { useRedes, useCdpsIglesia } from '@/hooks/useCasasDePaz';
import { obtenerEvangelismoRed } from '@/services/evangelismo.service';
import { aISO } from '@/utils/calendario-fechas';

const { AZUL, VERDE, MORADO, AMARILLO, CELESTE, NARANJA, ROSA } = EVANGELISMO_COLOR;
const PALETA_ANILLO = [AZUL, VERDE, MORADO, AMARILLO, CELESTE, NARANJA, ROSA];

interface FiltroInicial {
  desde?: string;
  hasta?: string;
}

export function EvangelismoRedes() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const navigate = useNavigate();
  const location = useLocation();
  const filtroInicial = location.state as FiltroInicial | null;

  const hoy = new Date();
  const desde = filtroInicial?.desde ?? aISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const hasta = filtroInicial?.hasta ?? aISO(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0));

  const { data: redesTodas = [] } = useRedes(iglesiaActivaId);
  const redes = useMemo(() => redesTodas.filter((r) => r.activo), [redesTodas]);
  const { data: cdpsTodas = [] } = useCdpsIglesia(iglesiaActivaId);
  const cdps = useMemo(() => cdpsTodas.filter((c) => c.activo), [cdpsTodas]);

  const evangelizadosPorRed = useQueries({
    queries: redes.map((r) => ({
      queryKey: ['evangelismo', 'redes-detalle', r.id, desde, hasta],
      queryFn: () => obtenerEvangelismoRed(r.id, desde, hasta),
      enabled: !!r.id,
    })),
  });
  const cargando = evangelizadosPorRed.some((q) => q.isLoading);

  const donutRedes = useMemo<SegmentoAnillo[]>(
    () =>
      redes.map((r, i) => {
        const datos = evangelizadosPorRed[i]?.data ?? [];
        const cantidad = datos.filter((e) => e.tipo_evangelismo_codigo !== 'SEMILLA').length;
        return { id: r.id, etiqueta: r.nombre, cantidad };
      }),
    [redes, evangelizadosPorRed]
  );

  const donutRedesPorCdp = useMemo<Map<string, SegmentoAnillo[]>>(() => {
    const mapa = new Map<string, SegmentoAnillo[]>();
    redes.forEach((r, i) => {
      const datos = evangelizadosPorRed[i]?.data ?? [];
      const cdpsDeRed = cdps.filter((c) => c.red_id === r.id);
      const conteoPorCdp = new Map<string, number>();
      for (const e of datos) {
        if (e.tipo_evangelismo_codigo === 'SEMILLA') continue;
        conteoPorCdp.set(e.casa_de_paz_id, (conteoPorCdp.get(e.casa_de_paz_id) ?? 0) + 1);
      }
      mapa.set(
        r.id,
        cdpsDeRed.map((c) => ({ id: c.id, etiqueta: c.etiqueta, cantidad: conteoPorCdp.get(c.id) ?? 0 }))
      );
    });
    return mapa;
  }, [redes, cdps, evangelizadosPorRed]);

  function irAPersonasEvangelizadas(casaDePazId: string) {
    navigate(ROUTES.EVANGELISMO_PERSONAS, { state: { desde, hasta, casaDePazId } });
  }

  const periodoLegible = new Date(desde + 'T00:00:00').toLocaleDateString('es-BO', { month: 'long', year: 'numeric' });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => navigate(ROUTES.EVANGELISMO)} aria-label="Volver a Evangelismo">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Evangelizados por Red</h1>
          <p className="text-sm text-muted-foreground capitalize">{periodoLegible}</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader icon={UsersRound} color={DEPARTAMENTO_META.EVANGELISMO.color} titulo="Toda la iglesia" descripcion="Proporción de evangelizados que aportó cada Red este período" />
        <div className="p-6">
          {cargando ? <Skeleton className="h-52 w-full rounded-2xl" /> : <AnilloSegmentado datos={donutRedes} colores={PALETA_ANILLO} tamano={220} />}
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {redes.map((r) => (
          <section key={r.id} className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <TarjetaHeader icon={UsersRound} color={DEPARTAMENTO_META.EVANGELISMO.color} titulo={r.nombre} descripcion="Tocá una Casa de Paz para ver a sus personas" />
            <div className="p-5">
              {cargando ? (
                <Skeleton className="h-40 w-full rounded-2xl" />
              ) : (
                <AnilloSegmentado datos={donutRedesPorCdp.get(r.id) ?? []} colores={PALETA_ANILLO} tamano={144} onSeleccionar={irAPersonasEvangelizadas} />
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
