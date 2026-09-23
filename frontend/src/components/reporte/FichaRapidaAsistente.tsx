import { useState } from 'react';
import { Cake, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SeccionIconHeader } from '@/components/shared/SeccionIconHeader';
import { AZUL, MORADO, VERDE, AMBAR } from '@/components/dashboard/DashboardUI';
import { CAMPO_ESTILO } from '@/lib/estilos';

const NOMBRE_ESTADO: Record<string, string> = { SIM: 'Simpatizante', NC: 'Nuevo Convertido', CRE: 'Creyente', RE: 'Reconciliado' };
const COLOR_ESTADO: Record<string, string> = { SIM: AMBAR, NC: MORADO, CRE: VERDE, RE: AZUL };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personaId: string;
  nombreCompleto: string;
  estadoSigla?: string | null;
  edad: number | null;
  tieneFechaNacimiento: boolean;
  esMenor: boolean | undefined;
  edadMinima: number;
  esReconciliado: boolean;
  asisteCdp: boolean;
  guardandoFecha: boolean;
  onGuardarFecha: (fecha: string) => void;
  onGuardarEdadAproximada: (edad: number) => void;
  onCambiarEsMenor: (esMenor: boolean) => void;
  onCambiarReconciliacion: (esReconciliado: boolean) => void;
  onCambiarAsisteCdp: (asiste: boolean) => void;
  onQuitarDelReporte: () => void;
  onAbrirFichaCompleta: () => void;
}

/**
 * KAN-435 (2026-09-23, pedido explícito del owner): las pastillas de
 * asistencia venían con demasiados controles sueltos encima (checkbox "es
 * menor", toggle RE, menú "más opciones", botón quitar) -- "mucho bulto de
 * datos". Esta ficha centraliza todo eso en un solo panel que se abre al
 * tocar la pastilla: la pastilla en sí vuelve a mostrar solo el nombre y el
 * estado SSVA vigente.
 *
 * La corrección de una fecha de nacimiento YA cargada pero mal cargada no
 * vive acá -- ese caso va a "Editar ficha completa" (FichaPersonaSheet),
 * que es la fuente de verdad real para editar datos de identidad. Esta
 * ficha rápida solo resuelve el caso de fecha de nacimiento AUSENTE (mismo
 * mecanismo que ModalFechaNacimientoFaltante, ver KAN-422/KAN-435), para no
 * duplicar dos editores de fecha distintos.
 */
export function FichaRapidaAsistente({
  open,
  onOpenChange,
  nombreCompleto,
  estadoSigla,
  edad,
  tieneFechaNacimiento,
  esMenor,
  edadMinima,
  esReconciliado,
  asisteCdp,
  guardandoFecha,
  onGuardarFecha,
  onGuardarEdadAproximada,
  onCambiarEsMenor,
  onCambiarReconciliacion,
  onCambiarAsisteCdp,
  onQuitarDelReporte,
  onAbrirFichaCompleta,
}: Props) {
  const [fecha, setFecha] = useState('');
  const [edadAproximada, setEdadAproximada] = useState('');
  const colorEstado = estadoSigla ? (COLOR_ESTADO[estadoSigla] ?? AZUL) : null;

  function guardarFecha() {
    if (!fecha) return;
    onGuardarFecha(fecha);
    setFecha('');
  }

  function guardarEdadAproximada() {
    const edadNumero = Number(edadAproximada);
    if (!edadAproximada || Number.isNaN(edadNumero)) return;
    onGuardarEdadAproximada(edadNumero);
    setEdadAproximada('');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="sr-only">Ficha rápida de {nombreCompleto}</DialogTitle>
          <SeccionIconHeader
            icon={Cake}
            color={colorEstado ?? AZUL}
            titulo={nombreCompleto}
            descripcion={estadoSigla ? NOMBRE_ESTADO[estadoSigla] ?? estadoSigla : undefined}
          />
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {tieneFechaNacimiento ? (
            <p className="text-sm text-muted-foreground">
              {edad !== null ? `${edad} años` : 'Edad no disponible'} -- si la fecha de nacimiento está mal cargada, corregila desde
              "Editar ficha completa".
            </p>
          ) : (
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3">
              <Label htmlFor="ficha-rapida-fecha" className="text-xs">
                No tiene fecha de nacimiento -- indicala:
              </Label>
              <div className="flex gap-2">
                <Input
                  id="ficha-rapida-fecha"
                  type="date"
                  className={CAMPO_ESTILO}
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                />
                <Button type="button" size="sm" onClick={guardarFecha} disabled={!fecha || guardandoFecha}>
                  Guardar
                </Button>
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  max={120}
                  placeholder="O edad aproximada"
                  className={CAMPO_ESTILO}
                  value={edadAproximada}
                  onChange={(e) => setEdadAproximada(e.target.value)}
                />
                <Button type="button" size="sm" variant="outline" onClick={guardarEdadAproximada} disabled={!edadAproximada || guardandoFecha}>
                  Guardar
                </Button>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox checked={esMenor ?? false} onCheckedChange={(v) => onCambiarEsMenor(v === true)} />
                Es menor de {edadMinima} años
              </label>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
            <div>
              <p className="text-sm font-medium">Se reconcilió con la fe hoy (RE)</p>
              <p className="text-xs text-muted-foreground">Solo si lo confirmó ahora -- nunca se marca solo.</p>
            </div>
            <Switch checked={esReconciliado} onCheckedChange={onCambiarReconciliacion} />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
            <div>
              <p className="text-sm font-medium">Asiste a esta Casa de Paz</p>
              <p className="text-xs text-muted-foreground">Desmarcá si vino de visita desde otra CdP.</p>
            </div>
            <Switch checked={asisteCdp} onCheckedChange={onCambiarAsisteCdp} />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button type="button" variant="outline" className="w-full justify-start gap-2" onClick={onAbrirFichaCompleta}>
            <Pencil className="h-4 w-4" />
            Editar ficha completa
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              onQuitarDelReporte();
              onOpenChange(false);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Quitar de este reporte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
