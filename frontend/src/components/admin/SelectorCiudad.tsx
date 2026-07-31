import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCiudades } from '@/hooks/useCasasDePaz';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Select alimentado por el catálogo `ciudad` (45_ciudad.sql) -- reemplaza el
 * texto libre en los formularios de iglesia (15-gestion-administrativa,
 * Panel 2). Guarda el nombre elegido como texto en `iglesia.ciudad` (mismo
 * tipo de columna que ya existía), sin agregar una relación nueva: alcanza
 * para lo que se pidió sin tocar todo lo que hoy lee `iglesia.ciudad`.
 */
export function SelectorCiudad({ value, onChange }: Props) {
  const { data: ciudades = [] } = useCiudades();
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full" id="ciudad">
        <SelectValue placeholder="Elegí una ciudad" />
      </SelectTrigger>
      <SelectContent>
        {ciudades.map((c) => (
          <SelectItem key={c.id} value={c.nombre}>
            {c.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
