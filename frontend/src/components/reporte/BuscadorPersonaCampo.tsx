import { useState } from 'react';
import { Check, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useBuscarPersonas } from '@/hooks/useCasasDePaz';
import type { PersonaBusqueda } from '@/types/casas-de-paz.types';

interface Props {
  iglesiaId: string | undefined;
  /** Texto mostrado en el campo: el nombre de la persona seleccionada, o lo que el usuario esté escribiendo. */
  valor: string;
  /** true cuando `valor` corresponde a una persona confirmada (no a una búsqueda en curso). */
  seleccionado: boolean;
  onCambiarTexto: (texto: string) => void;
  onSeleccionar: (persona: PersonaBusqueda) => void;
  placeholder?: string;
  /** Si viene informado, excluye de los resultados a quien tenga fecha de nacimiento y sea menor de esta edad. */
  edadMinima?: number;
}

/**
 * Buscador inteligente de personas: busca en toda la iglesia (no solo en la
 * Casa de Paz), con sugerencias en vivo a partir de 2 caracteres. Mismo
 * patrón que el campo "disertador" del prototipo (temporal_pages/NuevoReporte),
 * pero con estilo Apple y datos reales (`useBuscarPersonas`).
 */
export function BuscadorPersonaCampo({ iglesiaId, valor, seleccionado, onCambiarTexto, onSeleccionar, placeholder, edadMinima }: Props) {
  const [abierto, setAbierto] = useState(false);
  const { data: resultados = [], isFetching } = useBuscarPersonas(iglesiaId, valor, edadMinima);
  const mostrarDropdown = abierto && !seleccionado && valor.trim().length >= 2;

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
        <Input
          className="h-10 rounded-xl border-border bg-muted/40 pl-9 pr-9 text-sm focus-visible:bg-background"
          placeholder={placeholder ?? 'Buscar persona por nombre...'}
          value={valor}
          onChange={(e) => {
            onCambiarTexto(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          onBlur={() => setTimeout(() => setAbierto(false), 150)}
          autoComplete="off"
        />
        {seleccionado && (
          <Check className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-chart-2" />
        )}
      </div>

      {mostrarDropdown && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          {isFetching ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Buscando...</p>
          ) : resultados.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">No se encontró ninguna persona con ese nombre.</p>
          ) : (
            <div className="max-h-56 overflow-y-auto py-1">
              {resultados.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={() => onSeleccionar(p)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  {p.nombre_completo}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
