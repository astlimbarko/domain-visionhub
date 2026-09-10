import { useState } from 'react';
import { Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useSoloLectura } from '@/hooks/useSoloLectura';
import { useContextoActivo } from '@/hooks/useContextoActivo';

/**
 * KAN-339: aviso de "Modo lectura" mientras el Super Admin esté navegando un
 * Departamento vía "Visualizar" (contexto sintético soloLectura). Un solo
 * componente reusado (pedido del diseño técnico §12.4), montado una vez en
 * PrivateLayout, no por página.
 *
 * 2026-09-09/10 (pedido explícito del owner, tras probarlo en vivo): el
 * banner fijo en cada pantalla estorbaba -- ahora es un modal que aparece
 * UNA sola vez al entrar a un Departamento (una vez por `clave` de contexto
 * -- si navega entre las pantallas del mismo Departamento no vuelve a
 * aparecer; si entra a OTRO Departamento, sí, porque es una `clave` nueva).
 * El botón "Volver al Constructor" ya no vive acá -- se movió al navbar
 * (ver AppShell.tsx + useVolverAlConstructor.ts), quedaba pegado justo
 * arriba del banner de color de cada Departamento.
 */
export function BannerModoLectura() {
  const soloLectura = useSoloLectura();
  const { contextoActivo } = useContextoActivo();
  const clave = soloLectura && contextoActivo?.rolUI === 'LIDER_DEPARTAMENTO' ? contextoActivo.clave : null;
  const [claveConfirmada, setClaveConfirmada] = useState<string | null>(null);

  if (!soloLectura || !contextoActivo || contextoActivo.rolUI !== 'LIDER_DEPARTAMENTO') return null;

  return (
    <Dialog open={clave !== claveConfirmada} onOpenChange={(open) => { if (!open) setClaveConfirmada(clave); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: '#8a5a00' }}>
            <Eye className="h-4 w-4" />
            Modo lectura
          </DialogTitle>
          <DialogDescription>
            Estás viendo este departamento como Super Admin. Podés navegar todas sus pantallas, pero no podés editar nada.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" onClick={() => setClaveConfirmada(clave)}>
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
