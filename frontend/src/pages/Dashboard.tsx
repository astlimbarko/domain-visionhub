import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/store/auth.store';
import { useMisRoles } from '@/hooks/useDashboard';
import { DashboardPastor } from '@/components/dashboard/DashboardPastor';
import { DashboardSupervisor } from '@/components/dashboard/DashboardSupervisor';
import { DashboardLiderRed } from '@/components/dashboard/DashboardLiderRed';
import { DashboardLiderCdp } from '@/components/dashboard/DashboardLiderCdp';
import type { Vista } from '@/types/dashboard.types';

export function Dashboard() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const iglesias = useAuthStore((s) => s.iglesias);
  const esPastor = iglesias.find((i) => i.id === iglesiaActivaId)?.es_pastor ?? false;
  const { data: roles, isLoading } = useMisRoles(iglesiaActivaId);
  const [pila, setPila] = useState<Vista[]>([]);
  const location = useLocation();
  const vistaForzada = (location.state as { vista?: Vista } | null)?.vista;

  function vistaPorDefecto(): Vista | null {
    if (!roles) return null;
    if (esPastor) return { tipo: 'pastor' };
    if (roles.es_operativo && iglesiaActivaId) return { tipo: 'supervisor', iglesiaId: iglesiaActivaId };
    if (roles.redes_lider?.length) return { tipo: 'red', redId: roles.redes_lider[0].id };
    if (roles.cdp_lider?.length) return { tipo: 'cdp', cdpId: roles.cdp_lider[0].id, esSublider: false };
    if (roles.cdp_sublider?.length) return { tipo: 'cdp', cdpId: roles.cdp_sublider[0].id, esSublider: true };
    return null;
  }

  useEffect(() => {
    if (vistaForzada) {
      setPila([vistaForzada]);
      return;
    }
    const defecto = vistaPorDefecto();
    setPila(defecto ? [defecto] : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles, esPastor, iglesiaActivaId, location.key]);

  function avanzar(nueva: Vista) {
    setPila((prev) => [...prev, nueva]);
  }

  function volver() {
    setPila((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }

  function irARed(redId: string) {
    setPila((prev) => {
      const existe = prev.findIndex((v) => v.tipo === 'red' && v.redId === redId);
      if (existe >= 0) return prev.slice(0, existe + 1);
      return [...prev, { tipo: 'red', redId }];
    });
  }

  if (isLoading || !roles) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const vista = pila[pila.length - 1];

  if (!vista) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
          <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
        </div>
        <p className="text-sm text-muted-foreground">Todavía no tenés ningún panel asignado en esta iglesia.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {pila.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-fit gap-1.5 rounded-xl text-muted-foreground hover:text-foreground"
          onClick={volver}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>
      )}

      {vista.tipo === 'red' && roles.redes_lider && roles.redes_lider.length > 1 && pila.length === 1 && (
        <Select value={vista.redId} onValueChange={(redId) => setPila([{ tipo: 'red', redId }])}>
          <SelectTrigger className="w-full rounded-xl border-border/60 bg-muted/40 text-sm sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roles.redes_lider.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {vista.tipo === 'cdp' && !vista.esSublider && roles.cdp_lider && roles.cdp_lider.length > 1 && pila.length === 1 && (
        <Select value={vista.cdpId} onValueChange={(cdpId) => setPila([{ tipo: 'cdp', cdpId, esSublider: false }])}>
          <SelectTrigger className="w-full rounded-xl border-border/60 bg-muted/40 text-sm sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roles.cdp_lider.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.etiqueta}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {vista.tipo === 'pastor' && <DashboardPastor onSeleccionarIglesia={(iglesiaId) => avanzar({ tipo: 'supervisor', iglesiaId })} />}
      {vista.tipo === 'supervisor' && <DashboardSupervisor iglesiaId={vista.iglesiaId} onSeleccionarRed={irARed} />}
      {vista.tipo === 'red' && (
        <DashboardLiderRed redId={vista.redId} onSeleccionarCdp={(cdpId) => avanzar({ tipo: 'cdp', cdpId, esSublider: false })} />
      )}
      {vista.tipo === 'cdp' && <DashboardLiderCdp casaDePazId={vista.cdpId} esSublider={vista.esSublider} />}
    </div>
  );
}
