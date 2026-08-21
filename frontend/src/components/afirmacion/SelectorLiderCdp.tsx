/**
 * Selector de Lider de Casa de Paz para el registro interno de Afirmacion.
 * Solo lectura sobre casa_de_paz_cargo (fn_listar_lideres_cdp_afirmacion) --
 * no crea, edita ni toca nada de Casas de Paz. Internamente guarda el
 * casa_de_paz_cargo_id (identificador estable), nunca el nombre mostrado.
 *
 * Pedido explícito del owner (2026-08-21): primero se elige la Red (filtra
 * los líderes a los de esa Red), y cada líder muestra su zona/dirección
 * como segundo dato para distinguir CdP con nombres parecidos o cuando el
 * mismo líder tiene 2+ CdP (mismo criterio de zona que ya usa fn_etiqueta_cdp).
 */
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CAMPO_ESTILO } from '@/components/shared/CamposMembresiaFields';
import { useLideresCdpAfirmacion, useRedesAfirmacion } from '@/hooks/useAfirmacion';

interface Props {
  iglesiaId: string | undefined;
  value: string | undefined;
  onChange: (casaDePazCargoId: string | undefined) => void;
}

export function SelectorLiderCdp({ iglesiaId, value, onChange }: Props) {
  const { data: redes = [], isLoading: cargandoRedes } = useRedesAfirmacion(iglesiaId);
  const { data: lideres = [], isLoading: cargandoLideres } = useLideresCdpAfirmacion(iglesiaId);
  const [redId, setRedId] = useState<string>();

  const lideresDeLaRed = useMemo(() => lideres.filter((l) => l.red_id === redId), [lideres, redId]);
  const seleccionado = lideres.find((l) => l.casa_de_paz_cargo_id === value);

  function elegirRed(nuevaRedId: string) {
    setRedId(nuevaRedId);
    // Cambiar de Red invalida el líder ya elegido -- pertenecía a la Red anterior.
    if (value) onChange(undefined);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label>Red *</Label>
        <Select value={redId ?? ''} onValueChange={elegirRed}>
          <SelectTrigger className={cn('w-full', CAMPO_ESTILO)}>
            <SelectValue placeholder={cargandoRedes ? 'Cargando redes...' : 'Elegí una Red'} />
          </SelectTrigger>
          <SelectContent>
            {redes.length === 0 && !cargandoRedes && (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">No hay Redes activas.</p>
            )}
            {redes.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Líder de Casa de Paz *</Label>
        <Select value={value ?? ''} onValueChange={onChange} disabled={!redId}>
          <SelectTrigger className={cn('w-full', CAMPO_ESTILO)}>
            <SelectValue placeholder={!redId ? 'Elegí primero una Red' : cargandoLideres ? 'Cargando líderes...' : 'Elegí un líder de Casa de Paz'} />
          </SelectTrigger>
          <SelectContent>
            {redId && lideresDeLaRed.length === 0 && !cargandoLideres && (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">Esa Red no tiene líderes de CdP activos.</p>
            )}
            {lideresDeLaRed.map((l) => (
              <SelectItem key={l.casa_de_paz_cargo_id} value={l.casa_de_paz_cargo_id}>
                {l.lider_nombre} — {l.cdp_etiqueta}
                {l.zona && ` (${l.zona})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {seleccionado?.zona && (
          <p className="text-xs text-muted-foreground">
            Zona: <span className="font-medium text-foreground">{seleccionado.zona}</span>
          </p>
        )}
      </div>
    </div>
  );
}
