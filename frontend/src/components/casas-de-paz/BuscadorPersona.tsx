import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useBuscarPersonas } from '@/hooks/useCasasDePaz';
import type { PersonaBusqueda } from '@/types/casas-de-paz.types';

interface Props {
  iglesiaId: string | undefined;
  onSeleccionar: (persona: PersonaBusqueda) => void;
  excluirIds?: string[];
}

export function BuscadorPersona({ iglesiaId, onSeleccionar, excluirIds = [] }: Props) {
  const [texto, setTexto] = useState('');
  const { data: resultados = [], isFetching } = useBuscarPersonas(iglesiaId, texto);
  const filtrados = resultados.filter((p) => !excluirIds.includes(p.id));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Buscar persona por nombre o apellido..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      </div>
      {texto.trim().length >= 2 && (
        <div className="flex flex-col gap-1 rounded-lg border border-border p-1.5">
          {isFetching && <p className="px-2 py-1 text-sm text-muted-foreground">Buscando...</p>}
          {!isFetching && filtrados.length === 0 && (
            <p className="px-2 py-1 text-sm text-muted-foreground">Sin resultados.</p>
          )}
          {filtrados.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onSeleccionar(p);
                setTexto('');
              }}
              className="rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
            >
              {p.nombre_completo}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
