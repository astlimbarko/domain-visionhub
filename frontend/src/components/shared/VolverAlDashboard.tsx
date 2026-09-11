import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/utils/constants';

/**
 * Botón fijo (2026-09-11, pedido del owner) en las pantallas a las que se
 * llega desde un acceso rápido del Dashboard (Líder de Red, Supervisor de
 * Red, Líder/Sublíder de CdP) -- sin esto, probar otro acceso obligaba a
 * volver a buscar "Dashboard" en el menú lateral. Mismo estilo que el botón
 * "Volver" ya usado en pages/Dashboard.tsx para la pila de inspección.
 * Siempre visible en estas pantallas, sin importar cómo se llegó (no
 * depende de location.state).
 */
export function VolverAlDashboard() {
  const navigate = useNavigate();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-fit gap-1.5 rounded-xl text-muted-foreground hover:text-foreground"
      onClick={() => navigate(ROUTES.DASHBOARD)}
    >
      <ArrowLeft className="h-4 w-4" />
      Volver al Dashboard
    </Button>
  );
}
