import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { CampoOtp } from '@/components/shared/CampoOtp';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import type { RolSistema } from '@/types/auth.types';
import type { IglesiaAdmin, UsuarioListado } from '@/types/admin.types';

// Mismo alcance de roles administrativos que InvitarUsuarioDialog (decisión
// del owner, 2026-07-19 -- "acotar Super Admin"): editar un cargo tampoco
// permite convertirlo en Líder de Red/CdP desde acá.
const ROLES: { value: RolSistema; label: string }[] = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'PASTOR', label: 'Pastor' },
  { value: 'SUPERVISOR_VISION_ACCION', label: 'Supervisor de Visión en Acción' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usuario: UsuarioListado | null;
  iglesias: IglesiaAdmin[];
  guardando: boolean;
  /** Tema oscuro del diálogo (hoy solo lo usa el panel de Super Admin). */
  oscuro?: boolean;
  onGuardar: (rol: RolSistema, iglesiaId: string | null, pin?: string) => void;
}

export function EditarUsuarioDialog({ open, onOpenChange, usuario, iglesias, guardando, oscuro, onGuardar }: Props) {
  const esSuperAdmin = useAuthStore((s) => s.esSuperAdmin);
  const [rol, setRol] = useState<RolSistema | ''>('');
  const [iglesiaId, setIglesiaId] = useState('');
  const [pin, setPin] = useState('');

  useEffect(() => {
    if (usuario && open) {
      setRol(usuario.rol);
      setIglesiaId(usuario.iglesia_id ?? '');
      setPin('');
    }
  }, [usuario, open]);

  const necesitaIglesia = rol !== '' && rol !== 'SUPER_ADMIN';
  const pinValido = !esSuperAdmin || /^[0-9]{6}$/.test(pin);
  const puedeGuardar = rol !== '' && (!necesitaIglesia || !!iglesiaId) && pinValido;

  function handleGuardar() {
    if (!puedeGuardar) return;
    onGuardar(rol as RolSistema, necesitaIglesia ? iglesiaId : null, esSuperAdmin ? pin : undefined);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('max-w-sm', oscuro && 'dark')}>
        <DialogHeader>
          <DialogTitle>Editar cargo</DialogTitle>
          {usuario && <DialogDescription>{usuario.correo}</DialogDescription>}
        </DialogHeader>
        <div className="flex flex-col gap-3">
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
          {esSuperAdmin && <CampoOtp value={pin} onChange={setPin} />}
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleGuardar} disabled={guardando || !puedeGuardar}>
            {guardando ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
