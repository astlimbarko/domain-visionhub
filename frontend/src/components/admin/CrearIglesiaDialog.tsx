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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creando: boolean;
  onCrear: (sufijo: string, ciudad: string) => void;
}

export function CrearIglesiaDialog({ open, onOpenChange, creando, onCrear }: Props) {
  const [sufijo, setSufijo] = useState('');
  const [ciudad, setCiudad] = useState('');

  function handleCrear() {
    if (!sufijo.trim() || !ciudad.trim()) return;
    onCrear(sufijo.trim(), ciudad.trim());
    setSufijo('');
    setCiudad('');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nueva Iglesia</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sufijo">Nombre</Label>
            <Input id="sufijo" value={sufijo} onChange={(e) => setSufijo(e.target.value)} placeholder="Ej. Santa Cruz" />
            <p className="text-xs text-muted-foreground">Va a quedar como "Centro de Vida {sufijo || '...'}"</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ciudad">Ciudad</Label>
            <Input id="ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="Ej. Santa Cruz de la Sierra" />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleCrear} disabled={creando || !sufijo.trim() || !ciudad.trim()}>
            {creando ? 'Creando...' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
