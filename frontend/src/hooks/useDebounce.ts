import { useEffect, useState } from 'react';

/**
 * KAN-407: devuelve `valor` recién `retrasoMs` después de que dejó de
 * cambiar -- usado para no disparar la búsqueda de "posible duplicado"
 * (fn_buscar_personas_similares, pg_trgm) en cada tecla del mini-formulario
 * de "persona nueva". No existía un hook de debounce genérico en el
 * proyecto; la búsqueda normal (`useBuscarPersonas`) no lo necesita porque
 * ya exige coincidencia exacta de substring y es más liviana.
 */
export function useDebounce<T>(valor: T, retrasoMs = 350): T {
  const [debounced, setDebounced] = useState(valor);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(valor), retrasoMs);
    return () => clearTimeout(id);
  }, [valor, retrasoMs]);

  return debounced;
}
