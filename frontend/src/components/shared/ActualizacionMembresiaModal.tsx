// VisionHub -- KAN-252 Parte B: personas que ya tenían la membresía
// completada ANTES de que existieran Teléfono/Ministerio no deben volver a
// llenar toda la ficha -- este modal pide SOLO el dato que les falte
// (nunca los dos si a la persona ya no le faltaba alguno). Se muestra
// encima del panel, igual que ModalAnuncios -- `modal={false}` para no
// competir con ese si coinciden (mismo bug ya corregido en
// MembresiaObligatoria.tsx).
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { cn } from '@/lib/utils';
import { PAISES_TELEFONO } from '@/utils/paises-telefono';
import { useMinisterios } from '@/hooks/useMinisterios';
import {
  guardarActualizacionMinisterios,
  guardarActualizacionTelefono,
} from '@/services/membresia-extendida.service';

interface Props {
  iglesiaId: string;
  faltaTelefono: boolean;
  faltaMinisterio: boolean;
  onGuardado: () => void;
  onSaltar: () => void;
}

export function ActualizacionMembresiaModal({ iglesiaId, faltaTelefono, faltaMinisterio, onGuardado, onSaltar }: Props) {
  const [telefonoPais, setTelefonoPais] = useState('+591');
  const [telefonoNumero, setTelefonoNumero] = useState('');
  const [telefonoNoTiene, setTelefonoNoTiene] = useState(false);
  const [ministeriosElegidos, setMinisteriosElegidos] = useState<string[]>([]);
  const [ministerioNinguno, setMinisterioNinguno] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const { data: ministerios = [], isLoading: cargandoMinisterios } = useMinisterios(faltaMinisterio ? iglesiaId : undefined);

  function alternarMinisterio(id: string, marcado: boolean) {
    setMinisterioNinguno(false);
    setMinisteriosElegidos((actual) => (marcado ? [...actual, id] : actual.filter((m) => m !== id)));
  }

  function marcarNinguno(marcado: boolean) {
    setMinisterioNinguno(marcado);
    if (marcado) setMinisteriosElegidos([]);
  }

  async function guardar() {
    if (faltaTelefono && !telefonoNoTiene && !telefonoNumero.trim()) {
      toast.error('Escribí tu número, o marcá "No tengo teléfono"');
      return;
    }
    if (faltaMinisterio && !ministerioNinguno && ministeriosElegidos.length === 0) {
      toast.error('Elegí al menos un ministerio, o marcá "Ninguno"');
      return;
    }

    setEnviando(true);
    try {
      if (faltaTelefono) {
        const numero = telefonoNoTiene || !telefonoNumero.trim() ? null : `${telefonoPais}${telefonoNumero.trim()}`;
        await guardarActualizacionTelefono(numero);
      }
      if (faltaMinisterio) {
        await guardarActualizacionMinisterios(ministerioNinguno ? [] : ministeriosElegidos);
      }
      toast.success('Datos guardados');
      onGuardado();
    } catch {
      toast.error('No se pudo guardar, revisá tu conexión e intentá de nuevo');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open onOpenChange={() => {}} modal={false}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl">Un par de datos más</DialogTitle>
          <DialogDescription>
            Nos falta {faltaTelefono && faltaMinisterio ? 'tu teléfono y tu ministerio' : faltaTelefono ? 'tu teléfono' : 'tu ministerio'} para terminar de actualizar tu membresía.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {faltaTelefono && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="actualizacion_telefono">Teléfono</Label>
              {/* En móvil el selector de país iba en w-32 (128px) y dejaba el
                  campo del número aplastado (~80px en pantallas de 320px), sin
                  espacio real para tipear. Se achica el selector en móvil
                  (w-24) y el número toma el resto con flex-1/min-w-0. */}
              <div className="flex gap-2">
                <Select value={telefonoPais} disabled={telefonoNoTiene} onValueChange={setTelefonoPais}>
                  <SelectTrigger className={cn('w-28 shrink-0 sm:w-32', CAMPO_ESTILO)}>
                    <SelectValue>
                      <span className={cn('fi', `fi-${PAISES_TELEFONO.find((p) => p.codigo === telefonoPais)?.iso ?? 'bo'}`, 'mr-1 shrink-0 rounded-[2px]')} />
                      {telefonoPais}
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
                  id="actualizacion_telefono"
                  inputMode="numeric"
                  className={cn('min-w-0 flex-1', CAMPO_ESTILO)}
                  disabled={telefonoNoTiene}
                  placeholder={telefonoNoTiene ? 'No tiene teléfono' : undefined}
                  value={telefonoNumero}
                  onChange={(e) => setTelefonoNumero(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <label className="flex items-center gap-2 pt-0.5 text-xs text-muted-foreground">
                <Checkbox
                  checked={telefonoNoTiene}
                  onCheckedChange={(v) => {
                    const marcado = v === true;
                    setTelefonoNoTiene(marcado);
                    if (marcado) setTelefonoNumero('');
                  }}
                />
                No tengo teléfono
              </label>
            </div>
          )}

          {faltaMinisterio && (
            <div className="flex flex-col gap-2">
              <Label>Ministerio(s)</Label>
              {cargandoMinisterios ? (
                <Skeleton className="h-24 w-full rounded-lg" />
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={ministerioNinguno} onCheckedChange={(v) => marcarNinguno(v === true)} />
                    Ninguno
                  </label>
                  {/* El catálogo estándar son 14 ministerios: en móvil, una
                      columna de 15 filas empujaba "Guardar" muy abajo. Se
                      contiene la lista en una caja de altura acotada con scroll
                      propio, así el botón queda siempre a la vista. items-start
                      + mt-0.5 mantiene el check alineado si un nombre largo se
                      parte en dos líneas en pantallas angostas. */}
                  <div className="grid max-h-52 grid-cols-1 gap-x-4 gap-y-1.5 overflow-x-hidden overflow-y-auto overscroll-contain rounded-lg border border-border/60 p-2.5 sm:grid-cols-2">
                    {ministerios
                      .filter((m) => m.activo)
                      .map((m) => (
                        <label key={m.id} className="flex items-start gap-2 text-sm">
                          <Checkbox
                            className="mt-0.5"
                            checked={ministeriosElegidos.includes(m.id)}
                            onCheckedChange={(v) => alternarMinisterio(m.id, v === true)}
                          />
                          <span>{m.nombre}</span>
                        </label>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <Button type="button" variant="ghost" className="text-muted-foreground" onClick={onSaltar} disabled={enviando}>
            Ahora no
          </Button>
          <Button type="button" onClick={() => void guardar()} disabled={enviando} className="min-w-32">
            {enviando ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
