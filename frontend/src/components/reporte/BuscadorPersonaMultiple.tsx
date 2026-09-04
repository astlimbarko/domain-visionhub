import { useEffect, useRef, useState } from 'react';
import { Check, Plus, Search, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { MiembroCdp } from '@/types/reporte.types';

/** Datos que pide el mini-formulario de "persona nueva" -- mismos campos que
 * el alta de evangelizados (EvangelismoPendientePanel), para que no haya
 * choque de datos entre los dos lugares donde se puede crear a la misma
 * persona (pedido del owner, 2026-09-04). */
export interface DatosPersonaNueva {
  primer_nombre: string;
  segundo_nombre?: string;
  primer_apellido: string;
  segundo_apellido?: string;
  sexo: 'M' | 'F';
  domicilio?: string;
  telefono?: string;
  fecha_nacimiento?: string;
}

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
  /** Cuando la búsqueda no encuentra a nadie, ofrece cargarla como persona
   * nueva (mismo patrón que el buscador de evangelizados). Solo tiene
   * sentido en "Asistentes nuevos" -- regulares/niños clasifican gente que
   * ya está en el sistema, no crean personas. */
  permitirAgregarNueva?: boolean;
  onAgregarNueva?: (datos: DatosPersonaNueva) => void;
}

/** Separa un nombre completo tecleado en sus partes -- no hay forma de
 * adivinar con certeza dónde termina el nombre y empieza el apellido, así
 * que se usa el criterio más común en Bolivia (nombre[s] + apellido paterno
 * + apellido materno):
 *  - 1 palabra: nombre.
 *  - 2 palabras: nombre, apellido paterno.
 *  - 3 palabras: nombre, apellido paterno, apellido materno.
 *  - 4+ palabras: nombre, segundo nombre, apellido paterno, apellido
 *    materno (el resto, por si tiene más de una palabra). "Jose Maria Perez
 *    Antofagasta" -> nombre "Jose", segundo nombre "Maria", apellido
 *    paterno "Perez", apellido materno "Antofagasta".
 * Siempre editable a mano después -- esto solo precarga el formulario. */
function separarNombreCompleto(texto: string) {
  const partes = texto.trim().split(/\s+/).filter(Boolean);
  if (partes.length >= 4) {
    return {
      nombre: partes[0],
      segundoNombre: partes[1],
      apellidoPaterno: partes[2],
      apellidoMaterno: partes.slice(3).join(' '),
    };
  }
  return {
    nombre: partes[0] ?? '',
    segundoNombre: '',
    apellidoPaterno: partes[1] ?? '',
    apellidoMaterno: partes[2] ?? '',
  };
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
  permitirAgregarNueva,
  onAgregarNueva,
}: Props) {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  // Pedido del owner (2026-09-05): tildar a una persona no debe cerrar la
  // lista -- antes se cerraba en cada selección (dependía de un blur del
  // input con preventDefault en los checkboxes, poco confiable en táctil).
  // Ahora se cierra solo por clic/toque fuera del componente, o con la X.
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

  const [mostrarFormNueva, setMostrarFormNueva] = useState(false);
  const [nombreNueva, setNombreNueva] = useState('');
  const [segundoNombreNueva, setSegundoNombreNueva] = useState('');
  const [apellidoPaternoNueva, setApellidoPaternoNueva] = useState('');
  const [apellidoMaternoNueva, setApellidoMaternoNueva] = useState('');
  const [sexoNueva, setSexoNueva] = useState<'M' | 'F' | ''>('');
  const [domicilioNueva, setDomicilioNueva] = useState('');
  const [telefonoNueva, setTelefonoNueva] = useState('');
  const [fechaNacimientoNueva, setFechaNacimientoNueva] = useState('');

  const filtrados = texto.trim()
    ? miembros.filter((m) => m.nombre_completo.toLowerCase().includes(texto.trim().toLowerCase()))
    : miembros;

  // El texto que ya escribió para buscar no debería perderse: se separa en
  // nombre/apellidos (mismo criterio que el buscador de evangelizados) y
  // precarga el mini-formulario, para no hacerle escribir todo de nuevo.
  function abrirFormNueva() {
    const { nombre, segundoNombre, apellidoPaterno, apellidoMaterno } = separarNombreCompleto(texto);
    setNombreNueva(nombre);
    setSegundoNombreNueva(segundoNombre);
    setApellidoPaternoNueva(apellidoPaterno);
    setApellidoMaternoNueva(apellidoMaterno);
    setMostrarFormNueva(true);
    setAbierto(false);
  }

  function confirmarAgregarNueva() {
    if (!nombreNueva.trim() || !apellidoPaternoNueva.trim() || !sexoNueva || !onAgregarNueva) return;
    onAgregarNueva({
      primer_nombre: nombreNueva.trim(),
      segundo_nombre: segundoNombreNueva.trim() || undefined,
      primer_apellido: apellidoPaternoNueva.trim(),
      segundo_apellido: apellidoMaternoNueva.trim() || undefined,
      sexo: sexoNueva,
      domicilio: domicilioNueva.trim() || undefined,
      telefono: telefonoNueva.trim() || undefined,
      fecha_nacimiento: fechaNacimientoNueva || undefined,
    });
    setTexto('');
    setNombreNueva('');
    setSegundoNombreNueva('');
    setApellidoPaternoNueva('');
    setApellidoMaternoNueva('');
    setSexoNueva('');
    setDomicilioNueva('');
    setTelefonoNueva('');
    setFechaNacimientoNueva('');
    setMostrarFormNueva(false);
  }

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
      <div className="relative" ref={contenedorRef}>
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
        <Input
          className="h-10 rounded-xl pl-9 text-sm"
          placeholder={placeholder}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onFocus={() => setAbierto(true)}
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
                permitirAgregarNueva && texto.trim() ? (
                  <button
                    type="button"
                    onMouseDown={abrirFormNueva}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-primary hover:bg-accent"
                  >
                    <UserPlus className="h-4 w-4" />
                    No está en el sistema: agregarla como persona nueva
                  </button>
                ) : (
                  <p className="px-3 py-2 text-sm text-muted-foreground">No se encontró a nadie.</p>
                )
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

      {mostrarFormNueva && (
        <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
          {/* Mismos campos que "Nueva persona evangelizada" (EvangelismoPendientePanel)
              -- pedido del owner (2026-09-04) para que no haya datos que se
              pierdan según por dónde se cargue a la persona. */}
          <p className="text-xs font-medium text-muted-foreground">Persona nueva (no está en el sistema)</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Nombre *</Label>
              <Input value={nombreNueva} onChange={(e) => setNombreNueva(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Segundo nombre</Label>
              <Input value={segundoNombreNueva} onChange={(e) => setSegundoNombreNueva(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Apellido paterno *</Label>
              <Input value={apellidoPaternoNueva} onChange={(e) => setApellidoPaternoNueva(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Apellido materno</Label>
              <Input value={apellidoMaternoNueva} onChange={(e) => setApellidoMaternoNueva(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Sexo *</Label>
              <Select value={sexoNueva} onValueChange={(v) => setSexoNueva(v as 'M' | 'F')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="F">Femenino</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Domicilio</Label>
              <Input value={domicilioNueva} onChange={(e) => setDomicilioNueva(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Teléfono</Label>
              <Input type="tel" placeholder="Opcional" value={telefonoNueva} onChange={(e) => setTelefonoNueva(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Fecha de nacimiento</Label>
              <Input
                type="date"
                value={fechaNacimientoNueva}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setFechaNacimientoNueva(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setMostrarFormNueva(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={confirmarAgregarNueva}
              disabled={!nombreNueva.trim() || !apellidoPaternoNueva.trim() || !sexoNueva}
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar
            </Button>
          </div>
        </div>
      )}

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
