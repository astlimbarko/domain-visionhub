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

  function limpiar() {
    setOrigenId('');
    setNombreNueva('');
    setPersonaIds(new Set());
    setLiderNuevoId('');
    setMotivo('');
    setPin('');
  }

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
    limpiar();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) limpiar(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Multiplicar Casa de Paz</DialogTitle>
          <DialogDescription>
            La Casa de Paz elegida se queda con quien no se mueve. Los que marqués pasan a una Casa de Paz nueva, en la misma red.
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <Label>Casa de Paz que se multiplica</Label>
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
              <Label>Se van a la nueva (elegí una o más)</Label>
              <div className="flex flex-col gap-1 rounded-lg border border-border p-2">
                {cargandoMiembros && <p className="px-1.5 py-1 text-sm text-muted-foreground">Cargando...</p>}
                {!cargandoMiembros && miembros.length === 0 && (
                  <p className="px-1.5 py-1 text-sm text-muted-foreground">Esta Casa de Paz no tiene miembros todavía.</p>
                )}
                {miembros.map((m) => (
                  <label key={m.persona_id} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm">
                    <Checkbox checked={personaIds.has(m.persona_id)} onCheckedChange={(v) => toggleMiembro(m.persona_id, v === true)} />
                    {m.nombre_completo}
                  </label>
                ))}
              </div>
            </div>
          )}

          {origenId && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nombre_cdp_nueva">Nombre de la nueva (opcional)</Label>
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
              <Label>Líder de la nueva (opcional)</Label>
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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="motivo_multiplicar_cdp">Motivo (obligatorio)</Label>
            <Textarea
              id="motivo_multiplicar_cdp"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Por qué se multiplica"
            />
          </div>

          {esSuperAdmin && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pin_multiplicar_cdp">Tu PIN de Super Admin</Label>
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
          <Button type="button" onClick={handleMultiplicar} disabled={procesando || !puedeMultiplicar}>
            {procesando ? 'Multiplicando...' : 'Multiplicar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
