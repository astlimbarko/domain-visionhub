import { useState } from 'react';
import { Cake, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SeccionIconHeader } from '@/components/shared/SeccionIconHeader';
import { MORADO } from '@/components/dashboard/DashboardUI';
import { CAMPO_ESTILO } from '@/lib/estilos';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nombrePersona: string;
  guardando: boolean;
  edadMinima: number;
  onGuardarFecha: (fechaNacimiento: string) => void;
  onGuardarEdadAproximada: (edad: number) => void;
  onResolverEsMenor: (esMenor: boolean) => void;
  /** KAN-435 (2026-09-23): la X del modal no solo lo cierra -- deshace la
   * selección de esta persona (la saca de la asistencia), para el caso de
   * haberla elegido por error en el buscador. Sin esto, cerrar el modal
   * dejaría a la persona agregada pero sin edad resuelta. */
  onCancelar: () => void;
}

/**
 * KAN-422 (2026-09-22, pedido explícito del owner): al agregar a alguien sin
 * fecha de nacimiento registrada en el Reporte de Casa de Paz, se pregunta
 * directo en vez de dejarlo para después -- completado progresivo (ver
 * KAN-417). "Aún se desconoce" guarda solo `edad_aproximada` (KAN-406) para
 * estadísticas rápidas -- a propósito no cuenta como "ya completo": la
 * próxima vez que esta persona aparezca en un reporte se le vuelve a
 * preguntar, porque `fecha_nacimiento` sigue en null.
 *
 * KAN-435 (2026-09-23, pedido explícito del owner): el modal ya no se puede
 * "saltar" dejando la pregunta pendiente para una alerta aparte en la
 * página -- eso se sentía como un error, no como parte del flujo. Si ni
 * siquiera se sabe la edad aproximada, "Tampoco lo sé" abre un SEGUNDO
 * modal con una única pregunta binaria (¿es menor de la edad mínima?) que
 * resuelve la clasificación de este reporte sin guardar nada en la ficha
 * -- todo queda resuelto acá, nunca en la página. Son 2 `<Dialog>`
 * separados (no un solo modal con contenido condicional) a pedido
 * explícito del owner, para que se sienta como pasar a otra pantalla, no
 * como un formulario que cambia de forma.
 */
export function ModalFechaNacimientoFaltante({
  open,
  onOpenChange,
  nombrePersona,
  guardando,
  edadMinima,
  onGuardarFecha,
  onGuardarEdadAproximada,
  onResolverEsMenor,
  onCancelar,
}: Props) {
  const [fecha, setFecha] = useState('');
  const [seDesconoce, setSeDesconoce] = useState(false);
  const [edadAproximada, setEdadAproximada] = useState('');
  const [paso, setPaso] = useState<'fecha' | 'es_menor'>('fecha');

  function limpiarYCerrar(cb: () => void) {
    cb();
    setFecha('');
    setSeDesconoce(false);
    setEdadAproximada('');
    setPaso('fecha');
  }

  function confirmar() {
    if (seDesconoce) {
      const edad = Number(edadAproximada);
      if (!edadAproximada || Number.isNaN(edad)) return;
      limpiarYCerrar(() => onGuardarEdadAproximada(edad));
    } else {
      if (!fecha) return;
      limpiarYCerrar(() => onGuardarFecha(fecha));
    }
  }

  const puedeConfirmar = seDesconoce ? edadAproximada.trim() !== '' : fecha !== '';

  return (
    <>
      <Dialog open={open && paso === 'fecha'} onOpenChange={(v) => !v && limpiarYCerrar(() => onOpenChange(false))}>
        <DialogContent
          className="max-w-sm"
          showCloseButton={false}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-2 right-2"
            onClick={() => limpiarYCerrar(onCancelar)}
            title="No era esta persona, sacarla de la asistencia"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Cancelar, no era esta persona</span>
          </Button>
          <DialogHeader>
            <DialogTitle className="sr-only">Falta la fecha de nacimiento</DialogTitle>
            <SeccionIconHeader icon={Cake} color={MORADO} titulo="¿Cuándo nació?" />
            <DialogDescription className="pt-1">
              <span className="font-medium text-foreground">{nombrePersona}</span> todavía no tiene fecha de
              nacimiento registrada, indicala para completar su ficha.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            {!seDesconoce && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="modal-fecha-nacimiento">Fecha de nacimiento</Label>
                <Input
                  id="modal-fecha-nacimiento"
                  type="date"
                  className={CAMPO_ESTILO}
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                />
              </div>
            )}

            <label className="flex items-center gap-2 text-sm text-muted-foreground" onClick={(e) => e.stopPropagation()}>
              <Checkbox checked={seDesconoce} onCheckedChange={(v) => setSeDesconoce(v === true)} />
              {/* Pedido explícito del owner (2026-09-25): "se desconoce" sonaba
                  a que nadie sabe la fecha -- pero también pasa con niños que
                  se registran sin sus padres presentes, donde sí se sabe pero
                  no hay quién la confirme en el momento. */}
              No se puede confirmar la fecha de nacimiento ahora
            </label>

            {seDesconoce && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="modal-edad-aproximada">Edad aproximada</Label>
                <div className="flex gap-2">
                  <Input
                    id="modal-edad-aproximada"
                    type="number"
                    min={0}
                    max={120}
                    className={CAMPO_ESTILO}
                    placeholder="Solo para estadísticas rápidas"
                    value={edadAproximada}
                    onChange={(e) => setEdadAproximada(e.target.value)}
                  />
                  <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setPaso('es_menor')} disabled={guardando}>
                    Tampoco lo sé
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  La próxima vez que aparezca en un reporte, se le va a volver a pedir la fecha real.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" onClick={confirmar} disabled={!puedeConfirmar || guardando} className="w-full sm:w-auto">
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open && paso === 'es_menor'} onOpenChange={(v) => !v && limpiarYCerrar(() => onOpenChange(false))}>
        <DialogContent
          className="max-w-sm"
          showCloseButton={false}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-2 right-2"
            onClick={() => limpiarYCerrar(onCancelar)}
            title="No era esta persona, sacarla de la asistencia"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Cancelar, no era esta persona</span>
          </Button>
          <DialogHeader>
            <DialogTitle className="sr-only">¿Es menor?</DialogTitle>
            <SeccionIconHeader
              icon={Cake}
              color={MORADO}
              titulo="¿Es menor?"
              descripcion={`${nombrePersona} -- ni la fecha ni la edad aproximada se conocen`}
            />
          </DialogHeader>

          <p className="text-sm text-muted-foreground">Al menos decinos si es menor de {edadMinima} años:</p>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <div className="flex w-full gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => limpiarYCerrar(() => onResolverEsMenor(true))}
                disabled={guardando}
              >
                Sí, es menor
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => limpiarYCerrar(() => onResolverEsMenor(false))}
                disabled={guardando}
              >
                No
              </Button>
            </div>
            <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setPaso('fecha')}>
              Atrás
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
