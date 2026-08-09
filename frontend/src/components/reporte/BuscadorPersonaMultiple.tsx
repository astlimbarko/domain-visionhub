import { useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import type { MiembroCdp } from '@/types/reporte.types';

interface Props {
  titulo: string;
  miembros: MiembroCdp[];
  seleccionados: string[];
  onToggle: (personaId: string) => void;
  placeholder: string;
  colorChip: string;
  esMenorPorPersona?: Record<string, boolean>;
  onEsMenorChange?: (personaId: string, esMenor: boolean) => void;
  /** KAN-16: indicador "Asiste a esta CDP" por persona -- true = miembro
   * habitual, false = visita/no pertenece formalmente. No cambia la
   * membresía oficial, solo queda asociado a este registro de asistencia. */
  asisteCdpPorPersona?: Record<string, boolean>;
  onAsisteCdpChange?: (personaId: string, asiste: boolean) => void;
}

/**
 * Buscador inteligente con selección múltiple: escribís, filtra en vivo la
 * lista de miembros ya cargada (sin nueva consulta), tildás a los que
 * asistieron y quedan como chips removibles. Mismo patrón visual que las 3
 * listas de asistencia de temporal_pages/NuevoReporte, con estilo Apple.
 */
export function BuscadorPersonaMultiple({
  titulo,
  miembros,
  seleccionados,
  onToggle,
  placeholder,
  colorChip,
  esMenorPorPersona,
  onEsMenorChange,
  asisteCdpPorPersona,
  onAsisteCdpChange,
}: Props) {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);

  const filtrados = texto.trim()
    ? miembros.filter((m) => m.nombre_completo.toLowerCase().includes(texto.trim().toLowerCase()))
    : miembros;

  const seleccionadosSet = new Set(seleccionados);

  // KAN-38: "Seleccionar todo" actúa sobre `filtrados` (lo visible con el
  // texto de búsqueda activo), nunca sobre `miembros` completo -- si hay un
  // filtro de texto puesto, solo tilda/destilda lo que coincide con él.
  const filtradosSeleccionadosCount = filtrados.filter((m) => seleccionadosSet.has(m.persona_id)).length;
  const todosFiltradosSeleccionados = filtrados.length > 0 && filtradosSeleccionadosCount === filtrados.length;
  const algunoFiltradoSeleccionado = filtradosSeleccionadosCount > 0 && !todosFiltradosSeleccionados;

  function toggleTodosFiltrados() {
    if (todosFiltradosSeleccionados) {
      filtrados.forEach((m) => { if (seleccionadosSet.has(m.persona_id)) onToggle(m.persona_id); });
    } else {
      filtrados.forEach((m) => { if (!seleccionadosSet.has(m.persona_id)) onToggle(m.persona_id); });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
        <Input
          className="h-10 rounded-xl pl-9 text-sm"
          placeholder={placeholder}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onFocus={() => setAbierto(true)}
          onBlur={() => setTimeout(() => setAbierto(false), 150)}
        />

        {abierto && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
            <div className="sticky top-0 flex items-center justify-between border-b border-border bg-muted/60 px-3 py-1.5">
              <span className="text-xs font-medium text-muted-foreground">{titulo}</span>
              <button type="button" onMouseDown={() => setAbierto(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {filtrados.length > 0 && (
              <label
                onMouseDown={(e) => e.preventDefault()}
                className="flex cursor-pointer items-center gap-2.5 border-b border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <Checkbox
                  checked={todosFiltradosSeleccionados ? true : algunoFiltradoSeleccionado ? 'indeterminate' : false}
                  onCheckedChange={toggleTodosFiltrados}
                />
                Seleccionar todo ({filtradosSeleccionadosCount}/{filtrados.length})
              </label>
            )}
            <div className="max-h-56 overflow-y-auto py-1">
              {filtrados.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">No se encontró a nadie.</p>
              ) : (
                filtrados.map((m) => (
                  <label
                    key={m.persona_id}
                    onMouseDown={(e) => e.preventDefault()}
                    className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    <Checkbox checked={seleccionadosSet.has(m.persona_id)} onCheckedChange={() => onToggle(m.persona_id)} />
                    <span className="flex-1">
                      {m.nombre_completo}
                      {m.edad !== null && <span className="ml-1.5 text-xs text-muted-foreground">({m.edad} años)</span>}
                    </span>
                    {seleccionadosSet.has(m.persona_id) && <Check className="h-3.5 w-3.5 text-chart-2" />}
                  </label>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {seleccionados.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {seleccionados.map((id) => {
            const persona = miembros.find((m) => m.persona_id === id);
            if (!persona) return null;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                style={{ backgroundColor: `color-mix(in oklab, ${colorChip} 14%, transparent)`, color: colorChip }}
              >
                {persona.nombre_completo}
                {!persona.tiene_fecha_nacimiento && onEsMenorChange && (
                  <label className="ml-1 flex items-center gap-1 text-[10px]" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      className="h-3 w-3"
                      checked={esMenorPorPersona?.[id] ?? false}
                      onCheckedChange={(v) => onEsMenorChange(id, v === true)}
                    />
                    es menor
                  </label>
                )}
                {onAsisteCdpChange && (
                  <label className="ml-1 flex items-center gap-1 text-[10px]" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      className="h-3 w-3"
                      checked={asisteCdpPorPersona?.[id] ?? true}
                      onCheckedChange={(v) => onAsisteCdpChange(id, v === true)}
                    />
                    Asiste a esta CDP
                  </label>
                )}
                <button type="button" onClick={() => onToggle(id)} className="rounded-full p-0.5 hover:bg-black/10">
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">Total: {seleccionados.length}</p>
    </div>
  );
}
