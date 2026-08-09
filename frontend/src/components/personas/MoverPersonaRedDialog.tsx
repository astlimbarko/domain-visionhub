import { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, KeyRound, MessageSquareText, TriangleAlert } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SeccionIconHeader } from '@/components/shared/SeccionIconHeader';
import { AMBAR, MORADO } from '@/components/dashboard/DashboardUI';
import { useAuthStore } from '@/store/auth.store';
import { useRedes, useCdps } from '@/hooks/useCasasDePaz';
import type { CargoFicha } from '@/types/persona.types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  iglesiaId: string | undefined;
  personaNombre: string;
  redOrigenId: string | null;
  /** Cargos vigentes de la persona en la Red/Casa de Paz que deja -- no se
   * "llevan" a la Red nueva, así que hay que avisar y pedir confirmación
   * explícita antes de que se cierren (Requisitos 4-6 de KAN-32). */
  cargosOrigen: CargoFicha[];
  procesando: boolean;
  onMover: (params: { casaDePazDestinoId: string; motivo: string; confirmarCierreCargos: boolean; pin?: string }) => void;
}

/**
 * "Cambiar de Red" (KAN-32): elegir Red de destino y, dentro de ella, la
 * Casa de Paz concreta a la que se une la persona (el modelo no tiene
 * pertenencia directa a Red -- ver harness/03-estructura/design.md). Si tiene
 * cargos de liderazgo vigentes en la Red/CdP que deja, se muestran como
 * advertencia y hay que tildar la confirmación para poder continuar.
 */
export function MoverPersonaRedDialog({
  open,
  onOpenChange,
  iglesiaId,
  personaNombre,
  redOrigenId,
  cargosOrigen,
  procesando,
  onMover,
}: Props) {
  const esSuperAdmin = useAuthStore((s) => s.esSuperAdmin);
  const [redDestinoId, setRedDestinoId] = useState('');
  const [cdpDestinoId, setCdpDestinoId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [confirmarCierre, setConfirmarCierre] = useState(false);
  const [pin, setPin] = useState('');

  const { data: redes = [] } = useRedes(iglesiaId);
  const { data: cdps = [] } = useCdps(iglesiaId, redDestinoId || undefined);

  const redesDestino = useMemo(() => redes.filter((r) => r.activo && r.id !== redOrigenId), [redes, redOrigenId]);
  const cdpsDestino = useMemo(() => cdps.filter((c) => c.activo), [cdps]);

  const hayCargos = cargosOrigen.length > 0;
  const pinValido = !esSuperAdmin || /^[0-9]{6}$/.test(pin);
  const puedeMover = !!redDestinoId && !!cdpDestinoId && motivo.trim().length > 0 && (!hayCargos || confirmarCierre) && pinValido;

  useEffect(() => {
    if (open) {
      setRedDestinoId('');
      setCdpDestinoId('');
      setMotivo('');
      setConfirmarCierre(false);
      setPin('');
    }
  }, [open]);

  function elegirRedDestino(id: string) {
    setRedDestinoId(id);
    setCdpDestinoId('');
  }

  function handleMover() {
    if (!puedeMover) return;
    onMover({
      casaDePazDestinoId: cdpDestinoId,
      motivo: motivo.trim(),
      confirmarCierreCargos: hayCargos ? confirmarCierre : false,
      pin: esSuperAdmin ? pin : undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="sr-only">Cambiar de Red</DialogTitle>
          <SeccionIconHeader icon={ArrowRightLeft} color={MORADO} titulo="Cambiar de Red" />
          <DialogDescription className="pt-1">
            {personaNombre} se traslada a una Casa de Paz de otra Red, conservando su historial en la Red actual.
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Red de destino</Label>
            <Select value={redDestinoId} onValueChange={elegirRedDestino}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elegí la Red de destino" />
              </SelectTrigger>
              <SelectContent>
                {redesDestino.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {redDestinoId && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Casa de Paz de destino</Label>
              <Select value={cdpDestinoId} onValueChange={setCdpDestinoId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Elegí la Casa de Paz" />
                </SelectTrigger>
                <SelectContent>
                  {cdpsDestino.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">Esa Red no tiene Casas de Paz activas todavía.</div>
                  )}
                  {cdpsDestino.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.etiqueta}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {hayCargos && (
            <div
              className="flex flex-col gap-2 rounded-xl border p-3"
              style={{ borderColor: `color-mix(in oklab, ${AMBAR} 35%, transparent)`, backgroundColor: `color-mix(in oklab, ${AMBAR} 7%, transparent)` }}
            >
              <p className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: AMBAR }}>
                <TriangleAlert className="h-3.5 w-3.5" /> Cargos que no se mantienen
              </p>
              <p className="text-[12px] text-muted-foreground">
                No se "llevan" a la Red nueva -- se cierran con el traslado:
              </p>
              <ul className="flex flex-col gap-0.5 text-[13px]">
                {cargosOrigen.map((c, i) => (
                  <li key={i} className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">{c.cargo_nombre}</span>
                    <span className="truncate text-muted-foreground">{c.entidad}</span>
                  </li>
                ))}
              </ul>
              <label className="mt-1 flex items-start gap-2 text-[12px]">
                <Checkbox checked={confirmarCierre} onCheckedChange={(v) => setConfirmarCierre(v === true)} className="mt-0.5" />
                Entiendo que estos cargos se cierran al confirmar el traslado.
              </label>
            </div>
          )}

          <div className="flex flex-col gap-1.5 border-t border-border/60 pt-3.5">
            <Label htmlFor="motivo_mover_persona" className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              <MessageSquareText className="h-3.5 w-3.5" /> Motivo (obligatorio)
            </Label>
            <Textarea
              id="motivo_mover_persona"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Por qué se traslada de Red"
            />
          </div>

          {esSuperAdmin && (
            <div className="flex flex-col gap-1.5 rounded-xl border p-3" style={{ borderColor: `color-mix(in oklab, ${AMBAR} 30%, transparent)`, backgroundColor: `color-mix(in oklab, ${AMBAR} 6%, transparent)` }}>
              <Label htmlFor="pin_mover_persona" className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase" style={{ color: AMBAR }}>
                <KeyRound className="h-3.5 w-3.5" /> Tu PIN de Super Admin
              </Label>
              <Input
                id="pin_mover_persona"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6 dígitos"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleMover} disabled={procesando || !puedeMover} className="gap-1.5">
            <ArrowRightLeft className="h-4 w-4" />
            {procesando ? 'Trasladando...' : 'Trasladar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
