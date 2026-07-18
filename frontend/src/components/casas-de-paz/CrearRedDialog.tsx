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
  onCrear: (nombre: string) => void;
}

export function CrearRedDialog({ open, onOpenChange, creando, onCrear }: Props) {
  const [nombre, setNombre] = useState('');

  function handleCrear() {
    if (!nombre.trim()) return;
    onCrear(nombre.trim());
    setNombre('');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nueva Red</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nombre_red">Nombre</Label>
          <Input id="nombre_red" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Red Norte" />
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleCrear} disabled={creando || !nombre.trim()}>
            {creando ? 'Creando...' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
