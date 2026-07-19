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
import { useCdps } from '@/hooks/useCasasDePaz';
import { BuscadorPersona } from './BuscadorPersona';
import type { RedResumen, PersonaBusqueda } from '@/types/casas-de-paz.types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  iglesiaId: string | undefined;
  redes: RedResumen[];
  procesando: boolean;
  onMultiplicar: (params: {
    origenId: string;
    nombreNueva: string;
    cdpIds: string[];
    liderNuevoId?: string;
    motivo: string;
    pin?: string;
  }) => void;
}

export function MultiplicarRedDialog({ open, onOpenChange, iglesiaId, redes, procesando, onMultiplicar }: Props) {
  const esSuperAdmin = useAuthStore((s) => s.esSuperAdmin);
  const [origenId, setOrigenId] = useState('');
  const [nombreNueva, setNombreNueva] = useState('');
  const [cdpIds, setCdpIds] = useState<Set<string>>(new Set());
  const [lider, setLider] = useState<PersonaBusqueda | null>(null);
  const [motivo, setMotivo] = useState('');
  const [pin, setPin] = useState('');

  const { data: cdps = [] } = useCdps(iglesiaId, origenId || undefined);
  const activas = redes.filter((r) => r.activo);

  const pinValido = !esSuperAdmin || /^[0-9]{6}$/.test(pin);
  const puedeMultiplicar = !!origenId && !!nombreNueva.trim() && cdpIds.size > 0 && motivo.trim().length > 0 && pinValido;

  function elegirOrigen(id: string) {
    setOrigenId(id);
    setCdpIds(new Set());
  }

  function toggleCdp(id: string, marcado: boolean) {
    setCdpIds((prev) => {
      const next = new Set(prev);
      if (marcado) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function limpiar() {
    setOrigenId('');
    setNombreNueva('');
    setCdpIds(new Set());
    setLider(null);
    setMotivo('');
    setPin('');
  }

  function handleMultiplicar() {
    if (!puedeMultiplicar) return;
    onMultiplicar({
      origenId,
      nombreNueva: nombreNueva.trim(),
      cdpIds: Array.from(cdpIds),
      liderNuevoId: lider?.id,
      motivo: motivo.trim(),
      pin: esSuperAdmin ? pin : undefined,
    });
    limpiar();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) limpiar(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Multiplicar Red</DialogTitle>
          <DialogDescription>
            La Red elegida se queda con las Casas de Paz que no marqués. Las que marqués pasan a una Red nueva.
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <Label>Red que se multiplica</Label>
            <Select value={origenId} onValueChange={elegirOrigen}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elegí la Red" />
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

          {origenId && (
            <div className="flex flex-col gap-1.5">
              <Label>Se van a la nueva (elegí una o más)</Label>
              <div className="flex flex-col gap-1 rounded-lg border border-border p-2">
                {cdps.length === 0 && (
                  <p className="px-1.5 py-1 text-sm text-muted-foreground">Esta Red no tiene Casas de Paz todavía.</p>
                )}
                {cdps.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm">
                    <Checkbox checked={cdpIds.has(c.id)} onCheckedChange={(v) => toggleCdp(c.id, v === true)} />
                    {c.etiqueta}
                  </label>
                ))}
              </div>
            </div>
          )}

          {origenId && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nombre_red_nueva">Nombre de la nueva Red</Label>
              <Input id="nombre_red_nueva" value={nombreNueva} onChange={(e) => setNombreNueva(e.target.value)} placeholder="Ej. Red Sur" />
            </div>
          )}

          {origenId && (
            <div className="flex flex-col gap-1.5">
              <Label>Líder de la nueva Red (opcional)</Label>
              {lider ? (
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-1.5 text-sm">
                  {lider.nombre_completo}
                  <Button type="button" variant="ghost" size="sm" onClick={() => setLider(null)}>
                    Quitar
                  </Button>
                </div>
              ) : (
                <BuscadorPersona iglesiaId={iglesiaId} onSeleccionar={setLider} />
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="motivo_multiplicar_red">Motivo (obligatorio)</Label>
            <Textarea
              id="motivo_multiplicar_red"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Por qué se multiplica"
            />
          </div>

          {esSuperAdmin && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pin_multiplicar_red">Tu PIN de Super Admin</Label>
              <Input
                id="pin_multiplicar_red"
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
          <Button type="button" onClick={handleMultiplicar} disabled={procesando || !puedeMultiplicar}>
            {procesando ? 'Multiplicando...' : 'Multiplicar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
