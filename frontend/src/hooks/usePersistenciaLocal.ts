import { useEffect, useRef } from 'react';

// KAN-124 (Q-7): persistencia de progreso del formulario paginado en el
// cliente (localStorage), no en el servidor -- ver harness/17-membresia-ampliada/open-questions.md
// Q-7. Cubre "no perder lo completado si la persona abandona y vuelve" en el
// mismo navegador, sin crear un estado BORRADOR nuevo en la base de datos.
export function usePersistenciaLocal<T>(
  storageKey: string | null,
  valor: T,
  restaurar: (valor: T) => void
) {
  const yaRestaurado = useRef(false);

  useEffect(() => {
    if (!storageKey || yaRestaurado.current) return;
    yaRestaurado.current = true;
    try {
      const guardado = window.localStorage.getItem(storageKey);
      if (guardado) restaurar(JSON.parse(guardado) as T);
    } catch {
      // localStorage inaccesible (modo privado, cuota, etc.) -- no bloquea el formulario.
    }
    // Solo se restaura una vez, al montar con ese storageKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(valor));
    } catch {
      // idem arriba
    }
  }, [storageKey, valor]);
}

export function limpiarPersistenciaLocal(storageKey: string) {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // idem arriba
  }
}
