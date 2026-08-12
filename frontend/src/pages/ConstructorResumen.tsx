/**
 * Resumen del Constructor (2026-08-11): landing dentro del panel normal
 * (AppShell), antes de entrar al lienzo -- muestra un resumen de entidades y
 * líderes de la iglesia activa, y si tiene hijas/satélite, un botón por cada
 * una para entrar a SU propio Constructor. Antes el ítem de nav de Pastor
 * saltaba directo al lienzo de una sola iglesia; no había forma de ver ni
 * elegir entre iglesia madre e hijas/satélite desde ahí.
 */
import { Building2, Home, LayoutGrid, Network, RadioTower, Users } from 'lucide-react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { AZUL, AMBAR, DashboardHero, KpiMosaico, MARINO, MORADO, VERDE } from '@/components/dashboard/DashboardUI';
import { useEstructuraOrganizacional } from '@/features/estructura-organizacional/useEstructuraOrganizacional';
import { useIglesiasHijas } from '@/hooks/useCalendario';
import { useRolUI } from '@/hooks/useRolUI';
import { ROUTES, rutaEstructuraOrganizacional } from '@/utils/constants';

export function ConstructorResumen() {
  const { iglesiaId } = useParams<{ iglesiaId: string }>();
  const navigate = useNavigate();
  const rolUI = useRolUI();

  const { data, isLoading, isError } = useEstructuraOrganizacional(iglesiaId);
  const { data: iglesiasHijas = [], isLoading: cargandoHijas } = useIglesiasHijas(iglesiaId);

  if (rolUI === null) return <Skeleton className="h-96 w-full rounded-2xl" />;
  // Autoprotegida, mismo patrón que EstructuraOrganizacional.tsx -- por ahora
  // solo Pastor tiene un ítem de nav que apunta acá (paneles-contexto.ts).
  if (rolUI !== 'PASTOR') return <Navigate to={ROUTES.DASHBOARD} replace />;
  if (!iglesiaId) return <Navigate to={ROUTES.DASHBOARD} replace />;

  if (isError) {
    return <p className="text-sm text-muted-foreground">No se pudo cargar el resumen de esta iglesia.</p>;
  }

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-28 w-full rounded-3xl" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  const redesActivas = data.redes.filter((r) => !r.eliminada);
  const casasDePazActivas = data.casasDePaz.filter((c) => !c.eliminada);
  const totalLideres = new Set([
    ...redesActivas.flatMap((r) => [...r.lideres, ...r.supervisores].map((l) => l.id)),
    ...casasDePazActivas.flatMap((c) => [...c.lideres, ...c.sublideres].map((l) => l.id)),
    ...data.departamentos.flatMap((d) => d.lideres.map((l) => l.id)),
  ]).size;

  return (
    <div className="flex flex-col gap-6">
      <DashboardHero
        icon={Network}
        eyebrow="Constructor"
        title={data.iglesia.nombre}
        actions={
          <Button
            onClick={() => navigate(rutaEstructuraOrganizacional(data.iglesia.id))}
            className="gap-1.5 rounded-xl border border-white/25 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 hover:text-white"
          >
            <Network className="h-4 w-4" /> Entrar al Constructor
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiMosaico label="Redes" icon={Network} color={AZUL}>{redesActivas.length}</KpiMosaico>
        <KpiMosaico label="Casas de Paz" icon={Home} color={VERDE}>{casasDePazActivas.length}</KpiMosaico>
        <KpiMosaico label="Departamentos" icon={LayoutGrid} color={MORADO}>{data.departamentos.length}</KpiMosaico>
        <KpiMosaico label="Líderes" icon={Users} color={AMBAR}>{totalLideres}</KpiMosaico>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader
          icon={Building2}
          color={MARINO}
          titulo="Iglesias hijas y satélite"
          descripcion="Cada una tiene su propio Constructor, independiente de esta iglesia"
        />
        <div className="p-5">
          {cargandoHijas ? (
            <Skeleton className="h-16 w-full rounded-xl" />
          ) : iglesiasHijas.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Esta iglesia no tiene hijas ni sedes satélite.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {iglesiasHijas.map((hija) => (
                <button
                  key={hija.id}
                  type="button"
                  onClick={() => navigate(rutaEstructuraOrganizacional(hija.id))}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
                      style={{ backgroundColor: hija.tipo === 'SATELITE' ? MORADO : MARINO }}
                    >
                      {hija.tipo === 'SATELITE' ? <RadioTower className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{hija.nombre}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {hija.tipo === 'SATELITE' ? 'Iglesia satélite' : 'Iglesia hija'}
                      </p>
                    </div>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-primary">
                    <Network className="h-3.5 w-3.5" /> Entrar
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
