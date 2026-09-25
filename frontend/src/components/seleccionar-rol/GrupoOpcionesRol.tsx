import { OpcionRolFila } from './OpcionRolFila';
import type { OpcionRolContextual } from '@/hooks/useOpcionesRolContextuales';

interface Props {
  opciones: OpcionRolContextual[];
  onSeleccionar: (opcion: OpcionRolContextual) => void;
}

interface Grupo {
  iglesiaId: string | null;
  iglesiaNombre: string | null;
  opciones: OpcionRolContextual[];
}

/** Agrupa manteniendo el orden de llegada (el hook ya entrega las opciones
 * en orden jerárquico -- madre primero, ver ordenarIglesiasPorJerarquia). */
function agruparPorIglesia(opciones: OpcionRolContextual[]): Grupo[] {
  const grupos: Grupo[] = [];
  const indicePorIglesia = new Map<string | null, number>();
  for (const opcion of opciones) {
    let indice = indicePorIglesia.get(opcion.iglesiaId);
    if (indice === undefined) {
      indice = grupos.length;
      indicePorIglesia.set(opcion.iglesiaId, indice);
      grupos.push({ iglesiaId: opcion.iglesiaId, iglesiaNombre: opcion.iglesiaNombre, opciones: [] });
    }
    grupos[indice].opciones.push(opcion);
  }
  return grupos;
}

/** Lista con divisores finos entre filas dentro de cada grupo, sin tarjetas
 * individuales (referencia: m.png). KAN-442 (pedido explícito del owner,
 * 2026-09-25): cuando la cuenta tiene roles en más de una iglesia, se
 * agrupan con el nombre de la iglesia como encabezado -- en pantallas
 * grandes en 2 columnas separadas por una línea vertical (columns-2 deja
 * que cada grupo fluya de arriba a abajo en una columna antes de saltar a
 * la siguiente, por eso cada grupo lleva break-inside-avoid: no queremos
 * que una iglesia se corte a la mitad entre columnas), en mobile/tablet
 * apiladas una arriba de la otra en el mismo orden (madre primero). */
export function GrupoOpcionesRol({ opciones, onSeleccionar }: Props) {
  const grupos = agruparPorIglesia(opciones);
  const mostrarEncabezados = grupos.filter((g) => g.iglesiaNombre).length > 1;

  return (
    <div className="sm:columns-2 sm:gap-x-6 sm:[column-rule:1px_solid_var(--border)]">
      {grupos.map((grupo) => (
        <div key={grupo.iglesiaId ?? 'GLOBAL'} className="break-inside-avoid">
          {mostrarEncabezados && grupo.iglesiaNombre && (
            <p className="mt-3 mb-1 truncate px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase first:mt-0">
              {grupo.iglesiaNombre}
            </p>
          )}
          <div className="flex flex-col divide-y divide-border/70">
            {grupo.opciones.map((opcion) => (
              <OpcionRolFila key={opcion.key} opcion={opcion} onSeleccionar={() => onSeleccionar(opcion)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
