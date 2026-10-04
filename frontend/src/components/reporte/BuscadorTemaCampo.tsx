import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useTodosLosTemas } from '@/hooks/useReporte';
import { cn } from '@/lib/utils';

interface Props {
  iglesiaId: string | undefined;
  onSeleccionar: (libroId: string, temaId: string) => void;
  className?: string;
}

/**
 * KAN-367 (2026-09-17): atajo para encontrar un tema sin saber de antemano
 * en qué libro está -- quien carga el reporte suele saber el nombre del
 * tema, no el número de libro. Busca en los 13 libros a la vez (mismo
 * patrón que BuscadorPersonaCampo); al elegir un resultado completa Libro y
 * Tema solos. No reemplaza los selects de Libro/Tema, es un atajo arriba.
 */
export function BuscadorTemaCampo({ iglesiaId, onSeleccionar, className }: Props) {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const { data: temas = [] } = useTodosLosTemas(iglesiaId);

  const normalizado = texto.trim().toLowerCase();
  const resultados = normalizado.length >= 2 ? temas.filter((t) => t.nombre.toLowerCase().includes(normalizado)).slice(0, 20) : [];
  const mostrarDropdown = abierto && normalizado.length >= 2;

  // Mismo motivo que BuscadorPersonaCampo: onBlur + setTimeout perdía el tap
  // en celular (el blur por el cierre del teclado ganaba la carrera). Cierra
  // solo al tocar afuera, sin depender de timing.
  useEffect(() => {
    if (!abierto) return;
    function alTocarFuera(e: PointerEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener('pointerdown', alTocarFuera);
    return () => document.removeEventListener('pointerdown', alTocarFuera);
  }, [abierto]);

  return (
    <div className={cn('relative', className)} ref={contenedorRef}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
        <Input
          className="h-10 rounded-xl pl-9 text-sm"
          placeholder="Buscar tema por nombre (en los 13 libros)..."
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          autoComplete="off"
        />
      </div>

      {mostrarDropdown && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          {resultados.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">No se encontró ningún tema con ese nombre.</p>
          ) : (
            <div className="max-h-56 overflow-y-auto py-1">
              {resultados.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    onSeleccionar(t.libro_id, t.id);
                    setTexto('');
                    setAbierto(false);
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="truncate">{t.nombre}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">Libro {t.libro_numero}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
