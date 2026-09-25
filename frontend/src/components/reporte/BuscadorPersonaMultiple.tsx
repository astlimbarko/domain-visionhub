import { useEffect, useRef, useState } from 'react';
import { Check, Plus, Search, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { normalizarNombre } from '@/utils/normalizarNombre';
import { clasificarEdad, RANGO_EDAD_LABEL_PERSONA } from '@/utils/edad';
import { componerTelefono, PAISES_TELEFONO } from '@/utils/paises-telefono';
import { MORADO, VERDE } from '@/components/dashboard/DashboardUI';
import { useBuscarPersonasSimilares } from '@/hooks/useCasasDePaz';
import { useDebounce } from '@/hooks/useDebounce';
import { ConfirmarPosibleDuplicadoDialog } from '@/components/shared/ConfirmarPosibleDuplicadoDialog';
import { esCandidatoLocal, PREFIJO_CANDIDATO_LOCAL, sonNombresIguales } from '@/utils/personaSimilarLocal';
import { toast } from 'sonner';
import type { MiembroCdp } from '@/types/reporte.types';
import type { PersonaBusqueda, PersonaSimilar } from '@/types/casas-de-paz.types';

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
  /** KAN-406: cuando no se conoce la fecha exacta (niños, adultos mayores
   * sin documento a mano, etc.) se permite el alta igual con una edad
   * aproximada -- nunca se deriva una fecha_nacimiento ficticia a partir de
   * esto. Solo tiene sentido cuando fecha_nacimiento viene vacío. */
  edad_aproximada?: number;
  /** KAN-435 (2026-09-23, pedido explícito del owner): si se tilda, la
   * persona queda como Nuevo Convertido (NC) de una -- es una decisión que
   * solo puede confirmar el líder que estuvo ahí, no algo que el sistema
   * deba inferir por conteo de visitas. Sin tildar, sigue el camino de
   * siempre (entra como Asistente Nuevo, el conteo automático decide
   * después). */
  acepto_a_cristo?: boolean;
}

interface Props {
  titulo: string;
  /** KAN-407: requerida solo para chequear "posible duplicado" al confirmar
   * el mini-formulario de "persona nueva" (fn_buscar_personas_similares) --
   * si no se pasa, el aviso simplemente no se muestra (el resto del
   * componente sigue funcionando igual, ver `permitirAgregarNueva`). */
  iglesiaId?: string;
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
  /** KAN-438: personas nuevas ya agregadas a este mismo reporte (todavía sin
   * guardar) -- se comparan en el cliente contra el mini-formulario de
   * "persona nueva", porque `fn_buscar_personas_similares` (RPC) solo ve la
   * tabla `persona` real y no puede detectar un nombre repetido dentro del
   * mismo borrador sin enviar. */
  visitasNuevasExistentes?: { clave: string; primer_nombre?: string; primer_apellido?: string }[];
  /** Búsqueda en vivo en TODA la iglesia (no solo el pool de `miembros`) --
   * usado en "Asistentes nuevos", donde antes no había forma de encontrar a
   * alguien que ya está en el sistema (una visita de otra semana, un
   * evangelizado) antes de ofrecer crearla de nuevo y duplicarla (bug real
   * reportado por el owner, 2026-09-05). Cuando se pasa, tiene prioridad
   * sobre "agregarla como nueva": esa opción solo aparece si la búsqueda no
   * encontró a nadie. */
  resultadosBusquedaGlobal?: PersonaBusqueda[];
  buscandoGlobal?: boolean;
  onSeleccionarGlobal?: (persona: PersonaBusqueda) => void;
  /** KAN-391: si es `false`, nunca muestra de qué CdP viene un resultado de
   * `resultadosBusquedaGlobal` aunque el dato venga poblado -- el padre
   * decide esto según rol + criterio `REPORTE_MOSTRAR_ORIGEN_ASISTENTE`
   * (Líder de Red/Supervisor siempre en `true`, Líder/Sublíder de CdP según
   * el criterio). Default `true` para no romper otros usos futuros. */
  mostrarOrigenBusquedaGlobal?: boolean;
  onTextoCambia?: (texto: string) => void;
  /** KAN-367 (pedido del owner, 2026-09-17): ids que ya estaban guardados al
   * abrir el reporte para editar -- esas pastillas se ven en rojo suave
   * (mismo criterio que los demás campos "cargados de la base"), en vez del
   * color de categoría normal. Quien se agrega/saca durante esta sesión de
   * edición no entra acá, sigue con su color de categoría de siempre. */
  idsOriginales?: Set<string>;
  /** KAN-391 (2026-09-17): cuando el padre unifica varios buscadores en un
   * mismo `miembros`/`seleccionados` pero quiere seguir mostrando los
   * resultados agrupados a mano (por categoría propia, con su color), oculta
   * el listado de pastillas y el "Total" que este componente arma solo --
   * el checkbox de la lista desplegable sigue reflejando la selección real
   * (viene de `seleccionados`), solo se oculta el resumen de abajo. */
  ocultarResultados?: boolean;
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
  iglesiaId,
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
  visitasNuevasExistentes,
  resultadosBusquedaGlobal,
  buscandoGlobal,
  onSeleccionarGlobal,
  onTextoCambia,
  idsOriginales,
  ocultarResultados,
  mostrarOrigenBusquedaGlobal = true,
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
  const [telefonoPaisNueva, setTelefonoPaisNueva] = useState('+591');
  const [telefonoNumeroNueva, setTelefonoNumeroNueva] = useState('');
  const [fechaNacimientoNueva, setFechaNacimientoNueva] = useState('');
  // KAN-406: checkbox "Se desconoce la fecha de nacimiento" -- no bloquea el
  // alta rápida cuando no se sabe (niños, mayores sin documento a mano). En
  // ese caso se pide una edad aproximada en vez de la fecha exacta.
  const [fechaDesconocidaNueva, setFechaDesconocidaNueva] = useState(false);
  const [edadAproximadaNueva, setEdadAproximadaNueva] = useState('');
  // KAN-435: sin marcar por defecto -- solo NC si el líder lo confirma a propósito.
  const [aceptoACristoNueva, setAceptoACristoNueva] = useState(false);

  // KAN-407: mismo mecanismo que EvangelismoPendientePanel -- mientras se
  // completa "Persona nueva", busca en segundo plano (debounced) si ya
  // existe alguien con un nombre muy parecido (pg_trgm, tolera errores de
  // tipeo) antes de dejar confirmar el alta.
  const nombreNuevaDebounced = useDebounce(nombreNueva);
  const segundoNombreNuevaDebounced = useDebounce(segundoNombreNueva);
  const apellidoPaternoNuevaDebounced = useDebounce(apellidoPaternoNueva);
  const apellidoMaternoNuevaDebounced = useDebounce(apellidoMaternoNueva);
  const { data: similaresNueva = [] } = useBuscarPersonasSimilares(
    iglesiaId,
    {
      primer_nombre: nombreNuevaDebounced,
      segundo_nombre: segundoNombreNuevaDebounced,
      primer_apellido: apellidoPaternoNuevaDebounced,
      segundo_apellido: apellidoMaternoNuevaDebounced,
    },
    mostrarFormNueva
  );
  const [mostrarConfirmDuplicado, setMostrarConfirmDuplicado] = useState(false);
  const [duplicadoDescartado, setDuplicadoDescartado] = useState(false);
  useEffect(() => {
    setDuplicadoDescartado(false);
  }, [nombreNueva, segundoNombreNueva, apellidoPaternoNueva, apellidoMaternoNueva]);

  // KAN-438: mismo criterio que EvangelismoPendientePanel -- `similaresNueva`
  // (RPC) no ve a las visitas nuevas que ya se agregaron a este mismo
  // reporte pero todavía no se guardaron, se comparan acá en el cliente.
  const candidatosLocalesNueva: PersonaSimilar[] = (visitasNuevasExistentes ?? [])
    .filter((v) => sonNombresIguales(nombreNueva, apellidoPaternoNueva, v.primer_nombre, v.primer_apellido))
    .map((v) => ({
      id: `${PREFIJO_CANDIDATO_LOCAL}${v.clave}`,
      nombre_completo: [v.primer_nombre, v.primer_apellido].filter(Boolean).join(' '),
      score: 1,
    }));
  const candidatosDuplicadoNueva = [...candidatosLocalesNueva, ...similaresNueva];

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

  // KAN-407: punto de entrada real del botón "Agregar" del mini-formulario
  // -- si `fn_buscar_personas_similares` encontró candidatos sin descartar
  // todavía, frena y muestra el modal en vez de crear directo.
  // `confirmarAgregarNueva` (abajo) sigue siendo el alta real.
  function intentarConfirmarAgregarNueva() {
    if (!nombreNueva.trim() || !apellidoPaternoNueva.trim() || !sexoNueva || !onAgregarNueva) return;
    if (!duplicadoDescartado && candidatosDuplicadoNueva.length > 0) {
      setMostrarConfirmDuplicado(true);
      return;
    }
    confirmarAgregarNueva();
  }

  function usarPersonaNuevaSimilar(persona: PersonaSimilar) {
    // Candidato "local": ya está agregada como visita nueva en este mismo
    // reporte, sin guardar todavía -- no tiene un persona_id real, así que
    // no se agrega de nuevo en vez de fabricar un id falso.
    if (esCandidatoLocal(persona.id)) {
      toast.info('Ya está en la lista de asistentes nuevos de este reporte.');
    } else {
      onSeleccionarGlobal?.(persona);
    }
    setMostrarConfirmDuplicado(false);
    setTexto('');
    onTextoCambia?.('');
    setNombreNueva('');
    setSegundoNombreNueva('');
    setApellidoPaternoNueva('');
    setApellidoMaternoNueva('');
    setSexoNueva('');
    setDomicilioNueva('');
    setTelefonoPaisNueva('+591');
    setTelefonoNumeroNueva('');
    setFechaNacimientoNueva('');
    setFechaDesconocidaNueva(false);
    setEdadAproximadaNueva('');
    setAceptoACristoNueva(false);
    setMostrarFormNueva(false);
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
      telefono: componerTelefono(telefonoPaisNueva, telefonoNumeroNueva),
      // KAN-406: nunca ambos a la vez -- con el checkbox tildado se manda
      // solo la edad aproximada, sin fecha_nacimiento (evita inventar una
      // fecha ficticia a partir de la edad).
      fecha_nacimiento: fechaDesconocidaNueva ? undefined : (fechaNacimientoNueva || undefined),
      edad_aproximada: fechaDesconocidaNueva && edadAproximadaNueva ? Number(edadAproximadaNueva) : undefined,
      acepto_a_cristo: aceptoACristoNueva,
    });
    setTexto('');
    onTextoCambia?.('');
    setNombreNueva('');
    setSegundoNombreNueva('');
    setApellidoPaternoNueva('');
    setApellidoMaternoNueva('');
    setSexoNueva('');
    setDomicilioNueva('');
    setTelefonoPaisNueva('+591');
    setTelefonoNumeroNueva('');
    setFechaNacimientoNueva('');
    setFechaDesconocidaNueva(false);
    setEdadAproximadaNueva('');
    setAceptoACristoNueva(false);
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
      <div className="flex items-center gap-2">
        <div className="relative flex-1" ref={contenedorRef}>
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            className="h-10 rounded-xl pl-9 text-sm"
            placeholder={placeholder}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              onTextoCambia?.(e.target.value);
            }}
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
                <>
                  {/* Búsqueda global (toda la iglesia): si ya existe, se
                      selecciona directo -- antes esto no existía y cada
                      alta acá creaba una persona nueva, aunque ya fuera
                      alguien conocido (visita de otra semana, evangelizado
                      previo), duplicando su ficha. */}
                  {(resultadosBusquedaGlobal ?? []).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={() => {
                        onSeleccionarGlobal?.(p);
                        setTexto('');
                        onTextoCambia?.('');
                        setAbierto(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent"
                    >
                      <Check className="h-3.5 w-3.5 shrink-0 text-chart-2" />
                      {p.nombre_completo}
                      {/* KAN-391: de qué CdP viene, cuando se sabe -- si no
                          tiene membresía principal (ej. evangelizado suelto),
                          se muestra el texto genérico de siempre. */}
                      <span className="text-xs text-muted-foreground">
                        {mostrarOrigenBusquedaGlobal && p.casa_de_paz_nombre ? `(de ${p.casa_de_paz_nombre})` : '(ya está en el sistema)'}
                      </span>
                    </button>
                  ))}
                  {buscandoGlobal && <p className="px-3 py-2 text-sm text-muted-foreground">Buscando...</p>}
                  {!buscandoGlobal && (resultadosBusquedaGlobal?.length ?? 0) === 0 && (
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
                  )}
                </>
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
                      {m.edad !== null && (
                        <span className="ml-1.5 text-xs text-muted-foreground">({RANGO_EDAD_LABEL_PERSONA[clasificarEdad(m.edad)]})</span>
                      )}
                    </span>
                    {seleccionadosSet.has(m.persona_id) && <Check className="h-3.5 w-3.5 text-chart-2" />}
                  </label>
                ))
              )}
            </div>
          </div>
        )}
        </div>

        {/* KAN-369 (2026-09-13, pedido del owner): antes esta opción solo
            aparecía después de escribir texto Y de que la búsqueda global no
            encontrara a nadie -- "botón directo" siempre visible, sin tener
            que escribir primero. Abre el mismo mini-formulario de siempre. */}
        {permitirAgregarNueva && (
          // KAN-367 (2026-09-17, pedido del owner): antes era un outline
          // plano que se perdía contra el fondo blanco -- tinte de color
          // (mismo patrón color-mix que el resto del proyecto, ver skill
          // frontend-style) para que se note sin ser un botón sólido invasivo.
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl border-transparent"
            style={{ backgroundColor: `color-mix(in oklab, ${VERDE} 14%, transparent)`, color: VERDE }}
            title="Agregar persona nueva"
            onClick={abrirFormNueva}
          >
            <UserPlus className="h-4 w-4" />
          </Button>
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
              <Input
                value={nombreNueva}
                onChange={(e) => setNombreNueva(e.target.value)}
                onBlur={(e) => setNombreNueva(normalizarNombre(e.target.value, true))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Segundo nombre</Label>
              <Input
                value={segundoNombreNueva}
                onChange={(e) => setSegundoNombreNueva(e.target.value)}
                onBlur={(e) => setSegundoNombreNueva(normalizarNombre(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Apellido paterno *</Label>
              <Input
                value={apellidoPaternoNueva}
                onChange={(e) => setApellidoPaternoNueva(e.target.value)}
                onBlur={(e) => setApellidoPaternoNueva(normalizarNombre(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Apellido materno</Label>
              <Input
                value={apellidoMaternoNueva}
                onChange={(e) => setApellidoMaternoNueva(e.target.value)}
                onBlur={(e) => setApellidoMaternoNueva(normalizarNombre(e.target.value))}
              />
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
            {/* Teléfono con código de país -- mismo patrón (Select con
                bandera + PAISES_TELEFONO, Bolivia +591 por defecto) que
                CamposMembresiaFields/MembresiaObligatoria, reutilizado tal
                cual en vez de un Input suelto (pedido KAN-406). */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Teléfono</Label>
              <div className="flex gap-2">
                <Select value={telefonoPaisNueva} onValueChange={setTelefonoPaisNueva}>
                  <SelectTrigger className="w-28 shrink-0 sm:w-32">
                    <SelectValue>
                      <span className={cn('fi', `fi-${PAISES_TELEFONO.find((p) => p.codigo === telefonoPaisNueva)?.iso ?? 'bo'}`, 'mr-1 shrink-0 rounded-[2px]')} />
                      {telefonoPaisNueva}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PAISES_TELEFONO.map((p) => (
                      <SelectItem key={p.codigo} value={p.codigo}>
                        <span className={cn('fi', `fi-${p.iso}`, 'mr-1 shrink-0 rounded-[2px]')} />
                        {p.codigo}
                        <span className="ml-1.5 text-muted-foreground">{p.nombre}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="tel"
                  inputMode="numeric"
                  placeholder="Opcional"
                  className="min-w-0 flex-1"
                  value={telefonoNumeroNueva}
                  onChange={(e) => setTelefonoNumeroNueva(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">{fechaDesconocidaNueva ? 'Edad aproximada' : 'Fecha de nacimiento'}</Label>
              {fechaDesconocidaNueva ? (
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={120}
                  placeholder="Ej. 8"
                  value={edadAproximadaNueva}
                  onChange={(e) => setEdadAproximadaNueva(e.target.value)}
                />
              ) : (
                <Input
                  type="date"
                  value={fechaNacimientoNueva}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setFechaNacimientoNueva(e.target.value)}
                />
              )}
              {/* KAN-406: no impide el alta cuando no se sabe la fecha exacta
                  -- la edad aproximada queda marcada como dato no confirmado,
                  a completarse con la fecha real en el proceso de bautismo. */}
              <label className="flex items-center gap-1.5 pt-0.5 text-[11px] text-muted-foreground">
                <Checkbox
                  checked={fechaDesconocidaNueva}
                  onCheckedChange={(v) => {
                    const marcado = v === true;
                    setFechaDesconocidaNueva(marcado);
                    if (marcado) setFechaNacimientoNueva('');
                    else setEdadAproximadaNueva('');
                  }}
                />
                Se desconoce la fecha de nacimiento
              </label>
            </div>
          </div>

          {/* KAN-435 (2026-09-23, pedido explícito del owner): decisión
              deliberada, nunca inferida -- por eso va aparte del resto del
              formulario, con su propio fondo, y no como un checkbox chico
              más entre los demás campos. */}
          <label
            className="flex cursor-pointer items-start gap-2.5 rounded-xl p-3 text-sm"
            style={{ backgroundColor: `color-mix(in oklab, ${MORADO} 8%, transparent)` }}
          >
            <Checkbox
              checked={aceptoACristoNueva}
              onCheckedChange={(v) => setAceptoACristoNueva(v === true)}
            />
            <span>
              <span className="font-medium" style={{ color: MORADO }}>¿Aceptó a Cristo?</span>
              <span className="block text-xs text-muted-foreground">
                Marcalo solo si de verdad aceptó a Cristo hoy -- queda directo como Nuevo Convertido (NC).
              </span>
            </span>
          </label>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setMostrarFormNueva(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={intentarConfirmarAgregarNueva}
              disabled={!nombreNueva.trim() || !apellidoPaternoNueva.trim() || !sexoNueva}
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar
            </Button>
          </div>
        </div>
      )}

      <ConfirmarPosibleDuplicadoDialog
        open={mostrarConfirmDuplicado}
        onOpenChange={setMostrarConfirmDuplicado}
        candidatos={candidatosDuplicadoNueva}
        nombreTentativo={[nombreNueva, segundoNombreNueva, apellidoPaternoNueva, apellidoMaternoNueva].filter(Boolean).join(' ')}
        onUsarExistente={usarPersonaNuevaSimilar}
        onNoEsLaMisma={() => {
          setDuplicadoDescartado(true);
          setMostrarConfirmDuplicado(false);
          confirmarAgregarNueva();
        }}
      />

      {!ocultarResultados && seleccionados.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {seleccionados.map((id) => {
            const persona = miembros.find((m) => m.persona_id === id);
            if (!persona) return null;
            const esOriginal = idsOriginales?.has(id) ?? false;
            const colorPastilla = esOriginal ? 'var(--destructive)' : colorChip;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                style={{ backgroundColor: `color-mix(in oklab, ${colorPastilla} 14%, transparent)`, color: colorPastilla }}
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

      {!ocultarResultados && <p className="text-[11px] text-muted-foreground">Total: {seleccionados.length}</p>}
    </div>
  );
}
