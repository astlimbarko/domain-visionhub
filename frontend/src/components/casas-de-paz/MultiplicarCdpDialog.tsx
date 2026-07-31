import { useEffect, useState } from 'react';
import { Home, KeyRound, MessageSquareText, Split, UserRound } from 'lucide-react';
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
import { AMBAR, AZUL } from '@/components/dashboard/DashboardUI';
import { useAuthStore } from '@/store/auth.store';
import { useMiembrosCdp } from '@/hooks/useReporte';
import type { CdpResumen } from '@/types/casas-de-paz.types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cdps: CdpResumen[];
  procesando: boolean;
  onMultiplicar: (params: {
    origenId: string;
    nombreNueva?: string;
    personaIds: string[];
    liderNuevoId?: string;
    motivo: string;
    pin?: string;
  }) => void;
}

export function MultiplicarCdpDialog({ open, onOpenChange, cdps, procesando, onMultiplicar }: Props) {
  const esSuperAdmin = useAuthStore((s) => s.esSuperAdmin);
  const [origenId, setOrigenId] = useState('');
  const [nombreNueva, setNombreNueva] = useState('');
  const [personaIds, setPersonaIds] = useState<Set<string>>(new Set());
  const [liderNuevoId, setLiderNuevoId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [pin, setPin] = useState('');

  const { data: miembros = [], isLoading: cargandoMiembros } = useMiembrosCdp(origenId || undefined);
  const activas = cdps.filter((c) => c.activo);

  const pinValido = !esSuperAdmin || /^[0-9]{6}$/.test(pin);
  const puedeMultiplicar = !!origenId && personaIds.size > 0 && motivo.trim().length > 0 && pinValido;

  function elegirOrigen(id: string) {
    setOrigenId(id);
    setPersonaIds(new Set());
    setLiderNuevoId('');
  }

  function toggleMiembro(id: string, marcado: boolean) {
    setPersonaIds((prev) => {
      const next = new Set(prev);
      if (marcado) next.add(id);
      else {
        next.delete(id);
        if (liderNuevoId === id) setLiderNuevoId('');
      }
      return next;
    });
  }

  // Se resetea al abrir, no al enviar -- si el backend rechaza la
  // multiplicacion (PIN incorrecto, sin permiso), el dialogo se queda
  // abierto y perder los miembros ya marcados obligaria a rehacer todo.
  useEffect(() => {
    if (open) {
      setOrigenId('');
      setNombreNueva('');
      setPersonaIds(new Set());
      setLiderNuevoId('');
      setMotivo('');
      setPin('');
    }
  }, [open]);

  function handleMultiplicar() {
    if (!puedeMultiplicar) return;
    onMultiplicar({
      origenId,
      nombreNueva: nombreNueva.trim() || undefined,
      personaIds: Array.from(personaIds),
      liderNuevoId: liderNuevoId || undefined,
      motivo: motivo.trim(),
      pin: esSuperAdmin ? pin : undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="sr-only">Multiplicar Casa de Paz</DialogTitle>
          <SeccionIconHeader icon={Split} color={AZUL} titulo="Multiplicar Casa de Paz" />
          <DialogDescription className="pt-1">
            La Casa de Paz elegida se queda con quien no se mueve. Los que marqués pasan a una Casa de Paz nueva, en la misma red.
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Casa de Paz que se multiplica</Label>
            <Select value={origenId} onValueChange={elegirOrigen}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elegí la Casa de Paz" />
              </SelectTrigger>
              <SelectContent>
                {activas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {origenId && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Se van a la nueva (elegí una o más)</Label>
              <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-muted/20 p-2">
                {cargandoMiembros && <p className="px-1.5 py-1 text-sm text-muted-foreground">Cargando...</p>}
                {!cargandoMiembros && miembros.length === 0 && (
                  <p className="px-1.5 py-1 text-sm text-muted-foreground">Esta Casa de Paz no tiene miembros todavía.</p>
                )}
                {miembros.map((m) => (
                  <label
                    key={m.persona_id}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-background/80"
                  >
                    <Checkbox checked={personaIds.has(m.persona_id)} onCheckedChange={(v) => toggleMiembro(m.persona_id, v === true)} />
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: `color-mix(in oklab, ${AZUL} 14%, transparent)` }}
                    >
                      <UserRound className="h-3.5 w-3.5" style={{ color: AZUL }} />
                    </span>
                    {m.nombre_completo}
                  </label>
                ))}
              </div>
            </div>
          )}

          {origenId && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nombre_cdp_nueva" className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                <Home className="h-3.5 w-3.5" /> Nombre de la nueva (opcional)
              </Label>
              <Input
                id="nombre_cdp_nueva"
                value={nombreNueva}
                onChange={(e) => setNombreNueva(e.target.value)}
                placeholder="Se identifica por su líder si se deja vacío"
              />
            </div>
          )}

          {personaIds.size > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Líder de la nueva (opcional)</Label>
              <Select value={liderNuevoId} onValueChange={setLiderNuevoId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sin líder por ahora" />
                </SelectTrigger>
                <SelectContent>
                  {miembros
                    .filter((m) => personaIds.has(m.persona_id))
                    .map((m) => (
                      <SelectItem key={m.persona_id} value={m.persona_id}>
                        {m.nombre_completo}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1.5 border-t border-border/60 pt-3.5">
            <Label htmlFor="motivo_multiplicar_cdp" className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              <MessageSquareText className="h-3.5 w-3.5" /> Motivo (obligatorio)
            </Label>
            <Textarea
              id="motivo_multiplicar_cdp"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Por qué se multiplica"
            />
          </div>

          {esSuperAdmin && (
            <div className="flex flex-col gap-1.5 rounded-xl border p-3" style={{ borderColor: `color-mix(in oklab, ${AMBAR} 30%, transparent)`, backgroundColor: `color-mix(in oklab, ${AMBAR} 6%, transparent)` }}>
              <Label htmlFor="pin_multiplicar_cdp" className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase" style={{ color: AMBAR }}>
                <KeyRound className="h-3.5 w-3.5" /> Tu PIN de Super Admin
              </Label>
              <Input
                id="pin_multiplicar_cdp"
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
          <Button type="button" onClick={handleMultiplicar} disabled={procesando || !puedeMultiplicar} className="gap-1.5">
            <Split className="h-4 w-4" />
            {procesando ? 'Multiplicando...' : 'Multiplicar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
