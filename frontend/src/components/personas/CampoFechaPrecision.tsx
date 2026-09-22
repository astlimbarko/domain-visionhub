// KAN-408 (2026-09-21): mismo patrón de fecha+precisión del formulario de 10
// pasos (CampoFechaConPrecision en CamposMembresiaExtendidaFields.tsx), pero
// controlado con anio/mes/dia/precision_fecha sueltos en vez de un objeto
// FechaConPrecision -- así lo pueden usar directo los componentes Ficha*
// nuevos (Discipulados, Seminario, Universidad) sin acoplarse al tipo del
// wizard.
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { OPCIONES_PRECISION_FECHA } from '@/types/membresia-extendida.types';
import type { PrecisionFecha } from '@/types/membresia-extendida.types';
import type { ValorFechaPrecision } from '@/types/persona.types';

export type { ValorFechaPrecision };

interface Props {
  valor: ValorFechaPrecision;
  onChange: (v: ValorFechaPrecision) => void;
  disabled?: boolean;
}

export function CampoFechaPrecision({ valor, onChange, disabled }: Props) {
  const precision = valor.precision_fecha;
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg bg-muted/40 p-2">
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Precisión de la fecha</Label>
        <Select
          value={precision ?? ''}
          disabled={disabled}
          onValueChange={(v) => onChange({ ...valor, precision_fecha: v as PrecisionFecha })}
        >
          <SelectTrigger className={cn('h-8 w-44 text-xs', CAMPO_ESTILO)}>
            <SelectValue placeholder="No recuerdo / prefiero no decir" />
          </SelectTrigger>
          <SelectContent>
            {OPCIONES_PRECISION_FECHA.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {precision && (
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Año</Label>
          <Input
            type="number"
            disabled={disabled}
            className={cn('h-8 w-20 text-xs', CAMPO_ESTILO)}
            value={valor.anio ?? ''}
            onChange={(e) => onChange({ ...valor, anio: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
      )}
      {(precision === 'EXACTA' || precision === 'APROXIMADA' || precision === 'SOLO_MES_ANIO') && (
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Mes</Label>
          <Input
            type="number"
            min={1}
            max={12}
            disabled={disabled}
            className={cn('h-8 w-16 text-xs', CAMPO_ESTILO)}
            value={valor.mes ?? ''}
            onChange={(e) => onChange({ ...valor, mes: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
      )}
      {(precision === 'EXACTA' || precision === 'APROXIMADA') && (
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Día</Label>
          <Input
            type="number"
            min={1}
            max={31}
            disabled={disabled}
            className={cn('h-8 w-16 text-xs', CAMPO_ESTILO)}
            value={valor.dia ?? ''}
            onChange={(e) => onChange({ ...valor, dia: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
      )}
    </div>
  );
}

export function textoFechaPrecision(v: ValorFechaPrecision): string | null {
  if (!v.precision_fecha) return null;
  if (v.precision_fecha === 'SOLO_ANIO') return v.anio ? String(v.anio) : null;
  if (v.precision_fecha === 'SOLO_MES_ANIO') return v.anio && v.mes ? `${v.mes}/${v.anio}` : null;
  return v.anio && v.mes && v.dia ? `${v.dia}/${v.mes}/${v.anio}` : null;
}
