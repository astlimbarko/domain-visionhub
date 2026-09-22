import { useState } from 'react';
import { Cake } from 'lucide-react';
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
  onGuardarFecha: (fechaNacimiento: string) => void;
  onGuardarEdadAproximada: (edad: number) => void;
  onSaltar: () => void;
}

/**
 * KAN-422 (2026-09-22, pedido explícito del owner): al agregar a alguien sin
 * fecha de nacimiento registrada en el Reporte de Casa de Paz, se pregunta
 * directo en vez de dejarlo para después -- completado progresivo (ver
 * KAN-417). "Aún se desconoce" guarda solo `edad_aproximada` (KAN-406) para
 * estadísticas rápidas -- a propósito no cuenta como "ya completo": la
 * próxima vez que esta persona aparezca en un reporte se le vuelve a
 * preguntar, porque `fecha_nacimiento` sigue en null.
 */
export function ModalFechaNacimientoFaltante({
  open,
  onOpenChange,
  nombrePersona,
  guardando,
  onGuardarFecha,
  onGuardarEdadAproximada,
  onSaltar,
}: Props) {
  const [fecha, setFecha] = useState('');
  const [seDesconoce, setSeDesconoce] = useState(false);
  const [edadAproximada, setEdadAproximada] = useState('');

  function limpiarYCerrar(cb: () => void) {
    cb();
    setFecha('');
    setSeDesconoce(false);
    setEdadAproximada('');
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
    <Dialog open={open} onOpenChange={(v) => !v && limpiarYCerrar(() => onOpenChange(false))}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="sr-only">Falta la fecha de nacimiento</DialogTitle>
          <SeccionIconHeader icon={Cake} color={MORADO} titulo="¿Cuándo nació?" />
          <DialogDescription className="pt-1">
            <span className="font-medium text-foreground">{nombrePersona}</span> todavía no tiene fecha de
            nacimiento registrada -- indicala para completar su ficha.
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
            Aún se desconoce la fecha de nacimiento
          </label>

          {seDesconoce && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="modal-edad-aproximada">Edad aproximada</Label>
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
              <p className="text-[11px] text-muted-foreground">
                La próxima vez que aparezca en un reporte, se le va a volver a pedir la fecha real.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="ghost" onClick={() => limpiarYCerrar(onSaltar)} disabled={guardando}>
            Saltar por ahora
          </Button>
          <Button type="button" onClick={confirmar} disabled={!puedeConfirmar || guardando}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
