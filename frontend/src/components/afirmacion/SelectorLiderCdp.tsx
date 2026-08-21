/**
 * Selector de Lider de Casa de Paz para el registro interno de Afirmacion.
 * Solo lectura sobre casa_de_paz_cargo (fn_listar_lideres_cdp_afirmacion) --
 * no crea, edita ni toca nada de Casas de Paz. Internamente guarda el
 * casa_de_paz_cargo_id (identificador estable), nunca el nombre mostrado.
 */
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CAMPO_ESTILO } from '@/components/shared/CamposMembresiaFields';
import { useLideresCdpAfirmacion } from '@/hooks/useAfirmacion';

interface Props {
  iglesiaId: string | undefined;
  value: string | undefined;
  onChange: (casaDePazCargoId: string) => void;
}

export function SelectorLiderCdp({ iglesiaId, value, onChange }: Props) {
  const { data: lideres = [], isLoading } = useLideresCdpAfirmacion(iglesiaId);
  const seleccionado = lideres.find((l) => l.casa_de_paz_cargo_id === value);

  return (
    <div className="flex flex-col gap-1">
      <Select value={value ?? ''} onValueChange={onChange}>
        <SelectTrigger className={cn('w-full', CAMPO_ESTILO)}>
          <SelectValue placeholder={isLoading ? 'Cargando líderes...' : 'Elegí un líder de Casa de Paz'} />
        </SelectTrigger>
        <SelectContent>
          {lideres.length === 0 && !isLoading && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">No hay líderes de CdP activos.</p>
          )}
          {lideres.map((l) => (
            <SelectItem key={l.casa_de_paz_cargo_id} value={l.casa_de_paz_cargo_id}>
              {l.lider_nombre} — {l.cdp_etiqueta}
              {l.red_nombre && ` (Red: ${l.red_nombre})`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {/* Pedido explícito del owner (2026-08-21): el formulario público por
          URL ya muestra la Red al elegir el líder -- el interno no lo
          hacía, quedaba inconsistente. Se muestra apenas se elige, sin
          convertirlo en un campo seleccionable aparte (la Red la define el
          líder elegido, no al revés). */}
      {seleccionado && (
        <p className="text-xs text-muted-foreground">
          Red: <span className="font-medium text-foreground">{seleccionado.red_nombre ?? 'Sin red asignada'}</span>
        </p>
      )}
    </div>
  );
}
