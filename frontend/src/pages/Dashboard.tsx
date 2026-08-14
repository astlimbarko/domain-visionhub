import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useContextoActivo } from '@/hooks/useContextoActivo';
import { ROUTES } from '@/utils/constants';
import { DashboardPastor } from '@/components/dashboard/DashboardPastor';
import { DashboardSupervisor } from '@/components/dashboard/DashboardSupervisor';
import { DashboardLiderRed } from '@/components/dashboard/DashboardLiderRed';
import { DashboardLiderCdp } from '@/components/dashboard/DashboardLiderCdp';
import type { ContextoActivo } from '@/types/contexto-activo.types';
import type { Vista } from '@/types/dashboard.types';
import { vistaInicialParaContexto } from '@/utils/contextos-disponibles';
import { rutaInicialParaContexto } from '@/utils/paneles-contexto';

interface DashboardContextualProps {
  contexto: ContextoActivo;
  vistaInicial: Vista;
}

function DashboardContextual({ contexto, vistaInicial }: DashboardContextualProps) {
  const [pila, setPila] = useState<Vista[]>([vistaInicial]);

  function avanzar(nueva: Vista) {
    setPila((prev) => [...prev, nueva]);
  }

  function volver() {
    setPila((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }

  function irARed(redId: string) {
    setPila((prev) => {
      const existe = prev.findIndex((vista) => vista.tipo === 'red' && vista.redId === redId);
      if (existe >= 0) return prev.slice(0, existe + 1);
      return [...prev, { tipo: 'red', redId }];
    });
  }

  const vista = pila[pila.length - 1];
  const esSupervisorDeLaRedActiva =
    vista.tipo === 'red'
    && contexto.alcance === 'RED'
    && contexto.redId === vista.redId
    && contexto.cargoRed === 'SUPERVISOR';

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

      {vista.tipo === 'pastor' && <DashboardPastor onSeleccionarIglesia={(iglesiaId) => avanzar({ tipo: 'supervisor', iglesiaId })} />}
      {vista.tipo === 'supervisor' && <DashboardSupervisor iglesiaId={vista.iglesiaId} onSeleccionarRed={irARed} />}
      {vista.tipo === 'red' && (
        <DashboardLiderRed
          redId={vista.redId}
          esSublider={esSupervisorDeLaRedActiva}
          onSeleccionarCdp={(cdpId) => avanzar({ tipo: 'cdp', cdpId, esSublider: false })}
        />
      )}
      {vista.tipo === 'cdp' && <DashboardLiderCdp casaDePazId={vista.cdpId} esSublider={vista.esSublider} />}
    </div>
  );
}

export function Dashboard() {
  const { contextoActivo } = useContextoActivo();

  if (!contextoActivo) {
    return <Navigate to={ROUTES.SELECCIONAR_ROL} replace />;
  }

  const vistaInicial = vistaInicialParaContexto(contextoActivo);
  if (!vistaInicial) {
    return <Navigate to={rutaInicialParaContexto(contextoActivo)} replace />;
  }

  // La clave fuerza un remount sin pintar datos del contexto anterior durante
  // el cambio entre dos Redes o Casas de Paz del mismo usuario.
  return <DashboardContextual key={contextoActivo.clave} contexto={contextoActivo} vistaInicial={vistaInicial} />;
}
