import { OpcionRolFila } from './OpcionRolFila';
import type { OpcionRolContextual } from '@/hooks/useOpcionesRolContextuales';

interface Props {
  opciones: OpcionRolContextual[];
  onSeleccionar: (opcion: OpcionRolContextual) => void;
}

/** Lista de opciones, cada una su propia tarjeta redondeada con espacio entre sí (referencia: opencode/multirol/modelo.jpeg). */
export function GrupoOpcionesRol({ opciones, onSeleccionar }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {opciones.map((opcion) => (
        <OpcionRolFila key={opcion.key} opcion={opcion} onSeleccionar={() => onSeleccionar(opcion)} />
      ))}
    </div>
  );
}
