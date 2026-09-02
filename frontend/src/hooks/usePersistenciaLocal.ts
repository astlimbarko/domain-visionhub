import { useEffect, useRef, useState } from 'react';

// KAN-124 (Q-7): persistencia de progreso del formulario paginado en el
// cliente (localStorage), no en el servidor -- ver harness/17-membresia-ampliada/open-questions.md
// Q-7. Cubre "no perder lo completado si la persona abandona y vuelve" en el
// mismo navegador, sin crear un estado BORRADOR nuevo en la base de datos.
//
// Bug real (2026-08-27): storageKey es el slug del link del líder de CdP, no
// algo por-persona -- ese link lo llenan distintas personas en el mismo
// dispositivo (el líder lo prueba, o lo pasa a quien llega a la reunión).
// Restaurar en silencio pisaba el formulario con el nombre de quien lo haya
// tecleado antes (muchas veces el líder), y si no se notaba se creaba una
// persona duplicada con el nombre equivocado. Ahora NO se restaura solo:
// se deja `pendiente` para que el llamador confirme con la persona antes de
// aplicar los datos guardados.
export function usePersistenciaLocal<T>(
  storageKey: string | null,
  valor: T,
  restaurar: (valor: T) => void
) {
  const [pendiente, setPendiente] = useState<T | null>(null);
  const yaLeido = useRef(false);
  const hayPendiente = useRef(false);

  useEffect(() => {
    if (!storageKey || yaLeido.current) return;
    yaLeido.current = true;
    try {
      const guardado = window.localStorage.getItem(storageKey);
      if (guardado) {
        hayPendiente.current = true;
        setPendiente(JSON.parse(guardado) as T);
      }
    } catch {
      // localStorage inaccesible (modo privado, cuota, etc.) -- no bloquea el formulario.
    }
    // Solo se lee una vez, al montar con ese storageKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    // Mientras hay datos pendientes de confirmar, no pisar lo guardado con el
    // formulario vacío/en blanco que se está mostrando mientras tanto.
    if (!storageKey || hayPendiente.current) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(valor));
    } catch {
      // idem arriba
    }
  }, [storageKey, valor]);

  function confirmarPendiente() {
    if (pendiente) restaurar(pendiente);
    hayPendiente.current = false;
    setPendiente(null);
  }

  function descartarPendiente() {
    if (storageKey) limpiarPersistenciaLocal(storageKey);
    hayPendiente.current = false;
    setPendiente(null);
  }

  return { pendiente, confirmarPendiente, descartarPendiente };
}

export function limpiarPersistenciaLocal(storageKey: string) {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // idem arriba
  }
}
