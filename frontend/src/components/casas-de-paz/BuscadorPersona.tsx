import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useBuscarPersonas } from '@/hooks/useCasasDePaz';
import type { PersonaBusqueda } from '@/types/casas-de-paz.types';
import { AZUL, MORADO, TEAL } from '@/components/dashboard/DashboardUI';
import { COLOR_ESTADO_SSVA } from '@/components/shared/EdadEstadoBadges';
import { clasificarEdad, RANGO_EDAD_LABEL_PERSONA } from '@/utils/edad';

interface Props {
  iglesiaId: string | undefined;
  onSeleccionar: (persona: PersonaBusqueda) => void;
  excluirIds?: string[];
  /** Q-MR-12 (2026-08-15): si se pasa, prioriza miembros de esta Casa de Paz
   * antes de caer a toda la iglesia (ver buscarPersonas en
   * casas-de-paz.service.ts). Opcional -- sin esto, busca en toda la
   * iglesia directamente, como antes (cargos de Red/Departamento). */
  cdpId?: string;
}

/** Segunda línea de cada resultado: estado SSVA + edad por clasificación +
 * Casa de Paz + teléfono, cada uno con su color de la paleta compartida
 * (pedido explícito del owner) -- solo se muestra lo que la persona tenga. */
function DetalleResultado({ p }: { p: PersonaBusqueda }) {
  const partes: { texto: string; color: string }[] = [];
  if (p.estado_sigla) partes.push({ texto: p.estado_sigla, color: COLOR_ESTADO_SSVA[p.estado_sigla] ?? AZUL });
  if (p.edad !== null && p.edad !== undefined) {
    partes.push({ texto: RANGO_EDAD_LABEL_PERSONA[clasificarEdad(p.edad)], color: AZUL });
  }
  if (p.casa_de_paz_nombre) partes.push({ texto: p.casa_de_paz_nombre, color: MORADO });
  if (p.telefono) partes.push({ texto: p.telefono, color: TEAL });

  if (partes.length === 0) return null;

  return (
    <span className="flex flex-wrap items-center gap-x-1.5 text-[11px]">
      {partes.map((parte, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-muted-foreground/40">·</span>}
          <span className="font-medium" style={{ color: parte.color }}>
            {parte.texto}
          </span>
        </span>
      ))}
    </span>
  );
}

export function BuscadorPersona({ iglesiaId, onSeleccionar, excluirIds = [], cdpId }: Props) {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const { data: resultados = [], isFetching } = useBuscarPersonas(iglesiaId, texto, undefined, cdpId);
  const filtrados = resultados.filter((p) => !excluirIds.includes(p.id));
  const mostrarDropdown = abierto && texto.trim().length >= 2;

  return (
    <div className="relative flex flex-col gap-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Buscar persona por nombre o apellido..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onFocus={() => setAbierto(true)}
          onBlur={() => setTimeout(() => setAbierto(false), 150)}
          autoComplete="off"
        />
      </div>
      {mostrarDropdown && (
        <div className="absolute top-full z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-lg">
          {isFetching && <p className="px-2 py-1 text-sm text-muted-foreground">Buscando...</p>}
          {!isFetching && filtrados.length === 0 && (
            <p className="px-2 py-1 text-sm text-muted-foreground">Sin resultados.</p>
          )}
          {filtrados.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={() => {
                onSeleccionar(p);
                setTexto('');
                setAbierto(false);
              }}
              className="flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <span>{p.nombre_completo}</span>
              <DetalleResultado p={p} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
