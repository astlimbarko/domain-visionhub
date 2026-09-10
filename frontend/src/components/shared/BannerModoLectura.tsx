import { useState } from 'react';
import { Eye, ArrowLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useSoloLectura } from '@/hooks/useSoloLectura';
import { useContextoActivo } from '@/hooks/useContextoActivo';
import { rutaEstructuraOrganizacional } from '@/utils/constants';

/** Debe coincidir exacto con `persist({ name: ... })` en auth.store.ts. */
const CLAVE_STORAGE_AUTH = 'visionhub-auth';

/**
 * KAN-339: aviso de "Modo lectura" mientras el Super Admin esté navegando un
 * Departamento vía "Visualizar" (contexto sintético soloLectura). Un solo
 * componente reusado (pedido del diseño técnico §12.4), montado una vez en
 * PrivateLayout, no por página.
 *
 * 2026-09-09 (pedido explícito del owner, tras probarlo en vivo): el banner
 * fijo en cada pantalla estorbaba -- ahora es un modal que aparece UNA sola
 * vez al entrar a un Departamento (una vez por `clave` de contexto -- si
 * navega entre las pantallas del mismo Departamento no vuelve a aparecer;
 * si entra a OTRO Departamento, sí, porque es una `clave` nueva), más un
 * botón chico y persistente para volver, sin ocupar todo el ancho.
 */
export function BannerModoLectura() {
  const soloLectura = useSoloLectura();
  const { contextoActivo } = useContextoActivo();
  const clave = soloLectura && contextoActivo?.rolUI === 'LIDER_DEPARTAMENTO' ? contextoActivo.clave : null;
  const [claveConfirmada, setClaveConfirmada] = useState<string | null>(null);

  if (!soloLectura || !contextoActivo || contextoActivo.rolUI !== 'LIDER_DEPARTAMENTO') return null;

  // Restaura el contexto SUPER_ADMIN real ANTES de recargar -- nunca pasar
  // por contextoActivo=null (bug real encontrado en vivo 2026-09-09: ese
  // instante intermedio hacia parpadear la pantalla y a veces rebotaba a
  // /seleccionar-rol).
  //
  // NO se usa el store reactivo (setContextoActivo/setIglesiaYContextoActivo)
  // para esto -- se escribe el storage de zustand directo. Motivo (bug real
  // encontrado en vivo 2026-09-10, invisible en los logs de red porque es
  // 100% client-side): `window.location.href = ...` no corta la ejecucion
  // del script en curso, asi que un `set()` del store ANTES de esa linea
  // alcanza a disparar un re-render de PrivateLayout -- que sigue montado
  // para /afirmacion (la ruta vieja) hasta que la recarga real ocurre -- y
  // su guard de acceso (linea 136, obtenerPanelContexto().puedeAccederRuta)
  // evalua el contexto SUPER_ADMIN ya actualizado contra /afirmacion (que no
  // le pertenece), redirigiendo un instante a /administracion (client-side,
  // sin pedido de red) antes de que la recarga real lo tape. Escribir el
  // storage a mano deja el valor correcto para la proxima carga sin
  // disparar ningun render de la pagina actual.
  function volver() {
    const iglesiaId = contextoActivo && 'iglesiaId' in contextoActivo ? contextoActivo.iglesiaId : null;
    try {
      const crudo = window.localStorage.getItem(CLAVE_STORAGE_AUTH);
      if (crudo) {
        const datos = JSON.parse(crudo);
        datos.state = {
          ...datos.state,
          iglesiaActivaId: null,
          rolActivo: 'SUPER_ADMIN',
          contextoActivo: { clave: 'SUPER_ADMIN', rolUI: 'SUPER_ADMIN', alcance: 'GLOBAL' },
        };
        window.localStorage.setItem(CLAVE_STORAGE_AUTH, JSON.stringify(datos));
      }
    } catch {
      // localStorage puede fallar (modo privado, cuota llena) -- la recarga
      // igual entra a Estructura, el contexto se resuelve de nuevo desde
      // cero (Super Admin siempre tiene acceso al Constructor).
    }
    window.location.href = iglesiaId ? rutaEstructuraOrganizacional(iglesiaId) : '/administracion';
  }

  return (
    <>
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
      <button
        type="button"
        onClick={volver}
        className="mb-5 flex w-fit shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:bg-muted"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver al Constructor
      </button>
    </>
  );
}
