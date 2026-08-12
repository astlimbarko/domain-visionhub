/**
 * Resumen del Constructor (2026-08-11): landing dentro del panel normal
 * (AppShell), antes de entrar al lienzo -- resumen de texto simple (a
 * propósito, no el mismo banner/mosaico de un dashboard típico -- pedido del
 * owner) y un botón grande por iglesia (la propia + cada hija/satélite) para
 * entrar directo a SU Constructor. Antes el ítem de nav de Pastor saltaba
 * directo al lienzo de una sola iglesia; no había forma de ver ni elegir
 * entre iglesia madre e hijas/satélite desde ahí.
 */
import { Building2, Network, RadioTower } from 'lucide-react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { MARINO, MORADO } from '@/components/dashboard/DashboardUI';
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
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
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

  const iglesiasParaEntrar: { id: string; nombre: string; esSatelite: boolean }[] = [
    { id: data.iglesia.id, nombre: data.iglesia.nombre, esSatelite: false },
    ...iglesiasHijas.map((hija) => ({ id: hija.id, nombre: hija.nombre, esSatelite: hija.tipo === 'SATELITE' })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Constructor</h1>
        <p className="text-sm text-muted-foreground">
          {data.iglesia.nombre} · {redesActivas.length} red(es) · {casasDePazActivas.length} Casa(s) de Paz ·{' '}
          {data.departamentos.length} departamento(s) · {totalLideres} líder(es)
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {iglesiasParaEntrar.map((iglesia) => (
          <button
            key={iglesia.id}
            type="button"
            onClick={() => navigate(rutaEstructuraOrganizacional(iglesia.id))}
            className="group flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{ backgroundColor: iglesia.esSatelite ? MORADO : MARINO }}
            >
              {iglesia.esSatelite ? <RadioTower className="h-6 w-6" /> : <Building2 className="h-6 w-6" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-foreground">{iglesia.nombre}</p>
              <p className="text-xs text-muted-foreground">{iglesia.esSatelite ? 'Iglesia satélite' : 'Ir al Constructor'}</p>
            </div>
            <Network className="h-5 w-5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
          </button>
        ))}
        {cargandoHijas && <Skeleton className="h-28 w-full rounded-2xl" />}
      </div>
    </div>
  );
}
