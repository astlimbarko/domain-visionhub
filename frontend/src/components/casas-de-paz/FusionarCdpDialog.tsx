import { useEffect, useState } from 'react';
import { GitMerge, Home, KeyRound, MessageSquareText } from 'lucide-react';
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
import type { CdpResumen } from '@/types/casas-de-paz.types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cdps: CdpResumen[];
  procesando: boolean;
  onFusionar: (origenIds: string[], destinoId: string, motivo: string, pin?: string) => void;
}

export function FusionarCdpDialog({ open, onOpenChange, cdps, procesando, onFusionar }: Props) {
  const esSuperAdmin = useAuthStore((s) => s.esSuperAdmin);
  const [destinoId, setDestinoId] = useState('');
  const [origenIds, setOrigenIds] = useState<Set<string>>(new Set());
  const [motivo, setMotivo] = useState('');
  const [pin, setPin] = useState('');

  const activas = cdps.filter((c) => c.activo);
  const pinValido = !esSuperAdmin || /^[0-9]{6}$/.test(pin);
  const puedeFusionar = !!destinoId && origenIds.size > 0 && motivo.trim().length > 0 && pinValido;

  // Se resetea al abrir, no al enviar -- si el backend rechaza la fusion (PIN
  // incorrecto, sin permiso), el dialogo se queda abierto y perder la
  // seleccion + el motivo ya escrito obligaria a rehacer todo de cero.
  useEffect(() => {
    if (open) {
      setDestinoId('');
      setOrigenIds(new Set());
      setMotivo('');
      setPin('');
    }
  }, [open]);

  function toggleOrigen(id: string, marcado: boolean) {
    setOrigenIds((prev) => {
      const next = new Set(prev);
      if (marcado) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function handleFusionar() {
    if (!puedeFusionar) return;
    onFusionar(Array.from(origenIds), destinoId, motivo.trim(), esSuperAdmin ? pin : undefined);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="sr-only">Fusionar Casas de Paz</DialogTitle>
          <SeccionIconHeader icon={GitMerge} color={MORADO} titulo="Fusionar Casas de Paz" />
          <DialogDescription className="pt-1">
            Las que se marquen como "a absorber" se desactivan y sus miembros pasan a la que quede como líder.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Queda como líder</Label>
            <Select value={destinoId} onValueChange={setDestinoId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elegí la Casa de Paz que queda" />
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

          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Se absorben (elegí una o más)</Label>
            <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-muted/20 p-2">
              {activas
                .filter((c) => c.id !== destinoId)
                .map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-background/80"
                  >
                    <Checkbox checked={origenIds.has(c.id)} onCheckedChange={(v) => toggleOrigen(c.id, v === true)} />
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: `color-mix(in oklab, ${MORADO} 14%, transparent)` }}
                    >
                      <Home className="h-3.5 w-3.5" style={{ color: MORADO }} />
                    </span>
                    {c.etiqueta}
                  </label>
                ))}
              {activas.length <= 1 && <p className="px-1.5 py-1 text-sm text-muted-foreground">No hay otras Casas de Paz activas.</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 border-t border-border/60 pt-3.5">
            <Label htmlFor="motivo_fusion_cdp" className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              <MessageSquareText className="h-3.5 w-3.5" /> Motivo (obligatorio)
            </Label>
            <Textarea id="motivo_fusion_cdp" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Por qué se fusionan" />
          </div>

          {esSuperAdmin && (
            <div className="flex flex-col gap-1.5 rounded-xl border p-3" style={{ borderColor: `color-mix(in oklab, ${AMBAR} 30%, transparent)`, backgroundColor: `color-mix(in oklab, ${AMBAR} 6%, transparent)` }}>
              <Label htmlFor="pin_fusion_cdp" className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase" style={{ color: AMBAR }}>
                <KeyRound className="h-3.5 w-3.5" /> Tu PIN de Super Admin
              </Label>
              <Input
                id="pin_fusion_cdp"
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
          <Button type="button" onClick={handleFusionar} disabled={procesando || !puedeFusionar} className="gap-1.5">
            <GitMerge className="h-4 w-4" />
            {procesando ? 'Fusionando...' : 'Fusionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
