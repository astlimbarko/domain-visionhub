import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { PersonaNombreLink } from '@/components/personas/PersonaNombreLink';

const UMBRAL_BUSCADOR = 15;
const ALTO_MAXIMO = 'max-h-72';

export interface PersonaDelDia {
  id: string;
  personaId: string;
  nombre: string;
  tipoNombre: string | null;
  tipoColor: string | null;
}

/** Lista de personas evangelizadas un día puntual, dentro de una Casa de Paz.
 * Con scroll de alto fijo + buscador por nombre cuando son muchas (ej. una
 * inauguración con 100 registros de la misma CdP) -- sin esto una sola celda
 * podía desarmar el resto del acordeón. */
export function ListaPersonasDia({ personas }: { personas: PersonaDelDia[] }) {
  const [busqueda, setBusqueda] = useState('');

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return personas;
    return personas.filter((p) => p.nombre.toLowerCase().includes(q));
  }, [personas, busqueda]);

  return (
    <div className="flex flex-col gap-2">
      {personas.length > UMBRAL_BUSCADOR && (
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={`Buscar entre ${personas.length}...`}
            className="h-8 pl-8 text-sm"
          />
        </div>
      )}
      <div className={`flex flex-col gap-1 overflow-y-auto pr-1 ${ALTO_MAXIMO}`}>
        {filtradas.length === 0 && <p className="px-1 py-1 text-xs text-muted-foreground">Sin resultados.</p>}
        {filtradas.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-sm hover:bg-muted/50">
            <PersonaNombreLink personaId={p.personaId} className="min-w-0 truncate font-medium">
              {p.nombre}
            </PersonaNombreLink>
            {p.tipoNombre && (
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                style={{ backgroundColor: `color-mix(in oklab, ${p.tipoColor ?? '#8e8e93'} 16%, transparent)`, color: p.tipoColor ?? undefined }}
              >
                {p.tipoNombre}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
