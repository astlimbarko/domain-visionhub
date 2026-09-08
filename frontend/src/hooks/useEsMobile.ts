import { useEffect, useState } from 'react';

const QUERY = '(max-width: 639px)';

/** true por debajo del breakpoint `sm` de Tailwind (640px) -- mismo corte que
 * ya usan las clases `sm:hidden`/`hidden sm:block` del resto de la app, para
 * decisiones de layout que no se pueden resolver solo con CSS (ej. cuántas
 * filas pedir por página). */
export function useEsMobile(): boolean {
  const [esMobile, setEsMobile] = useState(() => window.matchMedia(QUERY).matches);

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = () => setEsMobile(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return esMobile;
}
