import { CalendarHeart } from 'lucide-react';
import type { EvangelismoDeOrigen } from '@/types/persona.types';

interface Props {
  evangelismo: EvangelismoDeOrigen;
}

/**
 * Solo lectura: de dónde y cuándo vino esta persona, si entró por
 * evangelismo. No editable desde acá -- el registro vive en el módulo de
 * Evangelismo (evangelismo.fecha, 12_evangelismo.sql).
 */
export function FichaEvangelismo({ evangelismo }: Props) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border p-3">
      <CalendarHeart className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="text-sm">
        <p className="font-medium">
          Evangelizada el {new Date(`${evangelismo.fecha}T00:00:00`).toLocaleDateString('es-BO')}
          {evangelismo.tipo_evangelismo_nombre && ` · ${evangelismo.tipo_evangelismo_nombre}`}
        </p>
        {evangelismo.evangelizado_por_nombre && (
          <p className="text-xs text-muted-foreground">Por {evangelismo.evangelizado_por_nombre}</p>
        )}
        {evangelismo.casa_de_paz_etiqueta && (
          <p className="text-xs text-muted-foreground">{evangelismo.casa_de_paz_etiqueta}</p>
        )}
      </div>
    </div>
  );
}
