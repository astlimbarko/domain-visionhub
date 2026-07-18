import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { RolSistema } from '@/types/auth.types';
import type { IglesiaAdmin } from '@/types/admin.types';

const ROLES: { value: RolSistema; label: string }[] = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'PASTOR', label: 'Pastor' },
  { value: 'SUPERVISOR_VISION_ACCION', label: 'Supervisor de Visión en Acción' },
  { value: 'LIDER_RED', label: 'Líder de Red' },
  { value: 'LIDER_CDP', label: 'Líder de Casa de Paz' },
  { value: 'SUBLIDER_CDP', label: 'Sublíder de Casa de Paz' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  iglesias: IglesiaAdmin[];
  invitando: boolean;
  onInvitar: (correo: string, rol: RolSistema, iglesiaId: string | null) => void;
}

export function InvitarUsuarioDialog({ open, onOpenChange, iglesias, invitando, onInvitar }: Props) {
  const [correo, setCorreo] = useState('');
  const [rol, setRol] = useState<RolSistema | ''>('');
  const [iglesiaId, setIglesiaId] = useState('');

  const necesitaIglesia = rol !== '' && rol !== 'SUPER_ADMIN';
  const puedeEnviar = correo.trim().includes('@') && rol !== '' && (!necesitaIglesia || !!iglesiaId);

  function handleInvitar() {
    if (!puedeEnviar) return;
    onInvitar(correo.trim().toLowerCase(), rol, necesitaIglesia ? iglesiaId : null);
    setCorreo('');
    setRol('');
    setIglesiaId('');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Invitar usuario</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="correo_invitar">Correo</Label>
            <Input id="correo_invitar" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="nombre@gmail.com" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Cargo en el sistema</Label>
            <Select value={rol} onValueChange={(v) => setRol(v as RolSistema)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elegí un cargo" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {necesitaIglesia && (
            <div className="flex flex-col gap-1.5">
              <Label>Iglesia</Label>
              <Select value={iglesiaId} onValueChange={setIglesiaId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Elegí una iglesia" />
                </SelectTrigger>
                <SelectContent>
                  {iglesias.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleInvitar} disabled={invitando || !puedeEnviar}>
            {invitando ? 'Invitando...' : 'Invitar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
