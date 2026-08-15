import { OpcionRolFila } from './OpcionRolFila';
import type { OpcionRolContextual } from '@/hooks/useOpcionesRolContextuales';

interface Props {
  opciones: OpcionRolContextual[];
  onSeleccionar: (opcion: OpcionRolContextual) => void;
}

/** Lista plana con divisores finos entre filas, sin tarjetas individuales (referencia: m.png). */
export function GrupoOpcionesRol({ opciones, onSeleccionar }: Props) {
  return (
    <div className="flex flex-col divide-y divide-border/70">
      {opciones.map((opcion) => (
        <OpcionRolFila key={opcion.key} opcion={opcion} onSeleccionar={() => onSeleccionar(opcion)} />
      ))}
    </div>
  );
}
