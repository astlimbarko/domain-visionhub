import { useEffect, useState } from 'react';

/** 639px = justo debajo del breakpoint `sm` de Tailwind (640px) -- mismo
 * corte que ya usa el resto de la app para alternar entre layout compacto
 * y completo (ver CalendarioGrid, que ya usa `sm:` para lo mismo). */
const CONSULTA_MOBILE = '(max-width: 639px)';

/** true si el viewport está por debajo del breakpoint `sm`. Se actualiza en
 * vivo si la ventana cambia de tamaño (rotar el celular, redimensionar). */
export function useEsMobile(): boolean {
  const [esMobile, setEsMobile] = useState(() => window.matchMedia(CONSULTA_MOBILE).matches);

  useEffect(() => {
    const mql = window.matchMedia(CONSULTA_MOBILE);
    const actualizar = () => setEsMobile(mql.matches);
    mql.addEventListener('change', actualizar);
    return () => mql.removeEventListener('change', actualizar);
  }, []);

  return esMobile;
}
