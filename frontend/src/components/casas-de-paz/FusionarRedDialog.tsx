import { useState } from 'react';
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
import { useAuthStore } from '@/store/auth.store';
import type { RedResumen } from '@/types/casas-de-paz.types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redes: RedResumen[];
  procesando: boolean;
  onFusionar: (origenIds: string[], destinoId: string, motivo: string, pin?: string) => void;
}

export function FusionarRedDialog({ open, onOpenChange, redes, procesando, onFusionar }: Props) {
  const esSuperAdmin = useAuthStore((s) => s.esSuperAdmin);
  const [destinoId, setDestinoId] = useState('');
  const [origenIds, setOrigenIds] = useState<Set<string>>(new Set());
  const [motivo, setMotivo] = useState('');
  const [pin, setPin] = useState('');

  const activas = redes.filter((r) => r.activo);
  const pinValido = !esSuperAdmin || /^[0-9]{6}$/.test(pin);
  const puedeFusionar = !!destinoId && origenIds.size > 0 && motivo.trim().length > 0 && pinValido;

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
    setDestinoId('');
    setOrigenIds(new Set());
    setMotivo('');
    setPin('');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Fusionar Redes</DialogTitle>
          <DialogDescription>
            Las que se marquen como "a absorber" se desactivan y sus Casas de Paz pasan a la que quede.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Queda</Label>
            <Select value={destinoId} onValueChange={setDestinoId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elegí la Red que queda" />
              </SelectTrigger>
              <SelectContent>
                {activas.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Se absorben (elegí una o más)</Label>
            <div className="flex flex-col gap-1 rounded-lg border border-border p-2">
              {activas
                .filter((r) => r.id !== destinoId)
                .map((r) => (
                  <label key={r.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm">
                    <Checkbox checked={origenIds.has(r.id)} onCheckedChange={(v) => toggleOrigen(r.id, v === true)} />
                    {r.nombre}
                  </label>
                ))}
              {activas.length <= 1 && <p className="px-1.5 py-1 text-sm text-muted-foreground">No hay otras redes activas.</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="motivo_fusion_red">Motivo (obligatorio)</Label>
            <Textarea id="motivo_fusion_red" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Por qué se fusionan" />
          </div>

          {esSuperAdmin && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pin_fusion_red">Tu PIN de Super Admin</Label>
              <Input
                id="pin_fusion_red"
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
          <Button type="button" onClick={handleFusionar} disabled={procesando || !puedeFusionar}>
            {procesando ? 'Fusionando...' : 'Fusionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
