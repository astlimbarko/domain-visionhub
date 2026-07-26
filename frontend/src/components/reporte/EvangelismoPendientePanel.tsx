import { useState } from 'react';
import { toast } from 'sonner';
import { Check, Plus, Search, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBuscarPersonas } from '@/hooks/useCasasDePaz';
import { useTiposEvangelismo } from '@/hooks/useEvangelismo';
import type { EvangelizadoPendiente } from '@/types/reporte.types';

interface Props {
  iglesiaId: string | undefined;
  pendientes: EvangelizadoPendiente[];
  onAgregar: (p: EvangelizadoPendiente) => void;
  onQuitar: (clave: string) => void;
}

/**
 * Buscar una persona ya existente en la iglesia o, si no aparece, cargarla
 * con un mini formulario — igual al flujo de evangelismo de
 * temporal_pages/NuevoReporte, con estilo Apple y búsqueda real
 * (useBuscarPersonas) en vez de datos de mentira. El tipo de evangelismo acá
 * es un combobox simple (a diferencia del selector de engranajes del módulo
 * de Evangelismo) — lo que se agregue queda etiquetado con el tipo elegido.
 */
export function EvangelismoPendientePanel({ iglesiaId, pendientes, onAgregar, onQuitar }: Props) {
  const { data: tipos = [] } = useTiposEvangelismo(iglesiaId);
  const [tipoEvangelismoId, setTipoEvangelismoId] = useState('');

  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [mostrarFormNueva, setMostrarFormNueva] = useState(false);
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [sexo, setSexo] = useState<'M' | 'F' | ''>('');
  const [domicilio, setDomicilio] = useState('');
  const [telefono, setTelefono] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');

  const { data: resultados = [], isFetching } = useBuscarPersonas(iglesiaId, texto);
  const tipoActual = tipos.find((t) => t.id === tipoEvangelismoId);

  function agregarExistente(persona: { id: string; nombre_completo: string }) {
    if (tipos.length > 0 && !tipoEvangelismoId) {
      toast.error('Elegí primero el tipo de evangelismo');
      return;
    }
    onAgregar({
      clave: `p-${persona.id}`,
      persona_id: persona.id,
      nombre_completo: persona.nombre_completo,
      tipo_evangelismo_id: tipoActual?.id,
      tipo_evangelismo_nombre: tipoActual?.nombre,
      tipo_evangelismo_color: tipoActual?.color,
    });
    setTexto('');
    setAbierto(false);
  }

  function agregarNueva() {
    if (!nombre.trim() || !apellido.trim() || !sexo) return;
    if (tipos.length > 0 && !tipoEvangelismoId) {
      toast.error('Elegí primero el tipo de evangelismo');
      return;
    }
    onAgregar({
      clave: `n-${Date.now()}`,
      nombre_completo: `${nombre.trim()} ${apellido.trim()}`,
      primer_nombre: nombre.trim(),
      primer_apellido: apellido.trim(),
      sexo,
      domicilio: domicilio.trim() || undefined,
      telefono: telefono.trim() || undefined,
      fecha_nacimiento: fechaNacimiento || undefined,
      tipo_evangelismo_id: tipoActual?.id,
      tipo_evangelismo_nombre: tipoActual?.nombre,
      tipo_evangelismo_color: tipoActual?.color,
    });
    setNombre('');
    setApellido('');
    setSexo('');
    setDomicilio('');
    setTelefono('');
    setFechaNacimiento('');
    setMostrarFormNueva(false);
  }

  // El texto que ya escribió para buscar no debería perderse: se precarga
  // como nombre/apellido para no hacerle escribir todo de nuevo.
  function abrirFormNueva() {
    const partes = texto.trim().split(/\s+/).filter(Boolean);
    setNombre(partes[0] ?? '');
    setApellido(partes.slice(1).join(' '));
    setMostrarFormNueva(true);
    setAbierto(false);
  }

  return (
    <div className="flex flex-col gap-3">
      {tipos.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Tipo de evangelismo</Label>
          <Select value={tipoEvangelismoId} onValueChange={setTipoEvangelismoId}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Elegí un tipo..." />
            </SelectTrigger>
            <SelectContent>
              {tipos.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
        <Input
          className="h-10 rounded-xl pl-9 text-sm"
          placeholder="Buscar persona evangelizada por nombre..."
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          onBlur={() => setTimeout(() => setAbierto(false), 150)}
        />

        {abierto && texto.trim().length >= 2 && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
            {isFetching ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">Buscando...</p>
            ) : resultados.length === 0 ? (
              <button
                type="button"
                onMouseDown={abrirFormNueva}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-primary hover:bg-accent"
              >
                <UserPlus className="h-4 w-4" />
                No está en el sistema: agregarla como persona nueva
              </button>
            ) : (
              <div className="max-h-56 overflow-y-auto py-1">
                {resultados.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={() => agregarExistente(p)}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    {p.nombre_completo}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {mostrarFormNueva && (
        <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground">Nueva persona evangelizada</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Nombre *</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Apellido *</Label>
              <Input value={apellido} onChange={(e) => setApellido(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Sexo *</Label>
              <Select value={sexo} onValueChange={(v) => setSexo(v as 'M' | 'F')}>
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
              <Input value={domicilio} onChange={(e) => setDomicilio(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Teléfono</Label>
              <Input type="tel" placeholder="Opcional" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Fecha de nacimiento</Label>
              <Input type="date" value={fechaNacimiento} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setFechaNacimiento(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setMostrarFormNueva(false)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" className="gap-1.5" onClick={agregarNueva} disabled={!nombre.trim() || !apellido.trim() || !sexo}>
              <Plus className="h-3.5 w-3.5" />
              Agregar
            </Button>
          </div>
        </div>
      )}

      {pendientes.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {pendientes.map((p) => (
            <div key={p.clave} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                {p.persona_id ? <Check className="h-3.5 w-3.5 shrink-0 text-chart-2" /> : <UserPlus className="h-3.5 w-3.5 shrink-0 text-primary" />}
                <span className="truncate">{p.nombre_completo}</span>
                {!p.persona_id && <span className="shrink-0 text-xs text-muted-foreground">(persona nueva)</span>}
                {p.tipo_evangelismo_nombre && (
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{
                      backgroundColor: `color-mix(in oklab, ${p.tipo_evangelismo_color ?? '#6B7280'} 14%, transparent)`,
                      color: p.tipo_evangelismo_color ?? undefined,
                    }}
                  >
                    {p.tipo_evangelismo_nombre}
                  </span>
                )}
              </span>
              <button type="button" onClick={() => onQuitar(p.clave)} className="shrink-0 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">Total evangelizados: {pendientes.length}</p>
    </div>
  );
}
