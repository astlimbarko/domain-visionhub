import { useEffect, useState } from 'react';
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

type Vista =
  | { tipo: 'pastor' }
  | { tipo: 'supervisor'; iglesiaId: string }
  | { tipo: 'red'; redId: string }
  | { tipo: 'cdp'; cdpId: string; esSublider: boolean };

export function Dashboard() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const iglesias = useAuthStore((s) => s.iglesias);
  const { data: roles, isLoading } = useMisRoles(iglesiaActivaId);
  const [pila, setPila] = useState<Vista[]>([]);

  function vistaPorDefecto(): Vista | null {
    if (!roles) return null;
    if (iglesias.length > 1) return { tipo: 'pastor' };
    if (roles.es_operativo && iglesiaActivaId) return { tipo: 'supervisor', iglesiaId: iglesiaActivaId };
    if (roles.redes_lider?.length) return { tipo: 'red', redId: roles.redes_lider[0].id };
    if (roles.cdp_lider?.length) return { tipo: 'cdp', cdpId: roles.cdp_lider[0].id, esSublider: false };
    if (roles.cdp_sublider?.length) return { tipo: 'cdp', cdpId: roles.cdp_sublider[0].id, esSublider: true };
    return null;
  }

  useEffect(() => {
    const defecto = vistaPorDefecto();
    setPila(defecto ? [defecto] : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles, iglesias.length, iglesiaActivaId]);

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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-32 w-full lg:col-span-4" />
        <Skeleton className="h-64 w-full lg:col-span-4" />
      </div>
    );
  }

  const vista = pila[pila.length - 1];

  if (!vista) {
    return <p className="text-sm text-muted-foreground">Todavía no tenés ningún panel asignado en esta iglesia.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {pila.length > 1 && (
        <Button variant="ghost" size="sm" className="w-fit gap-1.5" onClick={volver}>
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>
      )}

      {vista.tipo === 'red' && roles.redes_lider && roles.redes_lider.length > 1 && pila.length === 1 && (
        <Select value={vista.redId} onValueChange={(redId) => setPila([{ tipo: 'red', redId }])}>
          <SelectTrigger className="w-full sm:w-64">
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
          <SelectTrigger className="w-full sm:w-64">
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
