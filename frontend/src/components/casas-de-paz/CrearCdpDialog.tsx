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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redNombre: string | undefined;
  creando: boolean;
  onCrear: (nombre?: string) => void;
}

export function CrearCdpDialog({ open, onOpenChange, redNombre, creando, onCrear }: Props) {
  const [nombre, setNombre] = useState('');

  function handleCrear() {
    onCrear(nombre.trim() || undefined);
    setNombre('');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nueva Casa de Paz</DialogTitle>
          <DialogDescription>En la red {redNombre}.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nombre_cdp">Nombre (opcional)</Label>
          <Input
            id="nombre_cdp"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Se identifica por su líder si se deja vacío"
          />
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleCrear} disabled={creando}>
            {creando ? 'Creando...' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
