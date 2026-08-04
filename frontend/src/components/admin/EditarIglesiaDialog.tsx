import { useEffect, useState } from 'react';
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
import { CampoOtp } from '@/components/shared/CampoOtp';
import { SelectorCiudad } from '@/components/admin/SelectorCiudad';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import type { IglesiaAdmin } from '@/types/admin.types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  iglesia: IglesiaAdmin | null;
  guardando: boolean;
  /** Tema oscuro del diálogo (hoy solo lo usa el panel de Super Admin). */
  oscuro?: boolean;
  onGuardar: (sufijo: string, ciudad: string, correo: string | null, pin?: string) => void;
}

export function EditarIglesiaDialog({ open, onOpenChange, iglesia, guardando, oscuro, onGuardar }: Props) {
  const esSuperAdmin = useAuthStore((s) => s.esSuperAdmin);
  const [sufijo, setSufijo] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [correo, setCorreo] = useState('');
  const [pin, setPin] = useState('');

  useEffect(() => {
    if (iglesia && open) {
      setSufijo(iglesia.sufijo);
      setCiudad(iglesia.ciudad);
      setCorreo(iglesia.correo ?? '');
      setPin('');
    }
  }, [iglesia, open]);

  const pinValido = !esSuperAdmin || /^[0-9]{6}$/.test(pin);

  function handleGuardar() {
    if (!sufijo.trim() || !ciudad.trim() || !pinValido) return;
    onGuardar(sufijo.trim(), ciudad.trim(), correo.trim() || null, esSuperAdmin ? pin : undefined);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('max-w-sm', oscuro && 'dark')}>
        <DialogHeader>
          <DialogTitle>Editar iglesia</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sufijo_editar">Nombre</Label>
            <Input id="sufijo_editar" value={sufijo} onChange={(e) => setSufijo(e.target.value)} />
            <p className="text-xs text-muted-foreground">Va a quedar como "Centro de Vida {sufijo || '...'}"</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ciudad_editar">Ciudad</Label>
            <SelectorCiudad value={ciudad} onChange={setCiudad} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="correo_editar">Correo (opcional)</Label>
            <Input id="correo_editar" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="nombre@somoscdv.com" />
          </div>
          {esSuperAdmin && <CampoOtp value={pin} onChange={setPin} />}
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleGuardar} disabled={guardando || !sufijo.trim() || !ciudad.trim() || !pinValido}>
            {guardando ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
