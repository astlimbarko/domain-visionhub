import { useContextoActivo } from '@/hooks/useContextoActivo';
import { useSoloLectura } from '@/hooks/useSoloLectura';
import { rutaEstructuraOrganizacional } from '@/utils/constants';

/** Debe coincidir exacto con `persist({ name: ... })` en auth.store.ts. */
const CLAVE_STORAGE_AUTH = 'visionhub-auth';

/**
 * KAN-339: handler de "Volver al Constructor" para Super Admin en modo
 * lectura -- null si no aplica (no hay nada que mostrar). Extraido de
 * BannerModoLectura.tsx (2026-09-10, pedido del owner: el botón se mueve al
 * navbar, alineado a la derecha, no puede quedar pegado arriba del banner de
 * color de cada Departamento).
 *
 * Restaura el contexto SUPER_ADMIN real y recarga la página completa --
 * nunca navigate() de react-router ni el store reactivo de zustand (bug real
 * encontrado en vivo 2026-09-10, invisible en los logs de red porque es
 * 100% client-side): `window.location.href` no corta la ejecución del
 * script en curso, así que un `set()` del store ANTES de esa línea alcanza
 * a disparar un re-render de PrivateLayout -- que sigue montado para la
 * ruta vieja (ej. /afirmacion) hasta que la recarga real ocurre -- y su
 * guard de acceso evalúa el contexto SUPER_ADMIN ya actualizado contra esa
 * ruta vieja (que no le pertenece), rebotando un instante a /administracion
 * antes de que la recarga real lo tape. Escribir el storage a mano deja el
 * valor correcto para la próxima carga sin disparar ningún render de la
 * página actual.
 */
export function useVolverAlConstructor(): (() => void) | null {
  const soloLectura = useSoloLectura();
  const { contextoActivo } = useContextoActivo();

  if (!soloLectura || !contextoActivo || contextoActivo.rolUI !== 'LIDER_DEPARTAMENTO') return null;

  return () => {
    const iglesiaId = 'iglesiaId' in contextoActivo ? contextoActivo.iglesiaId : null;
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
  };
}
