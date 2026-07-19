import { useState } from 'react';
import { X } from 'lucide-react';
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
import { BuscadorPersona } from './BuscadorPersona';
import type { PersonaBusqueda } from '@/types/casas-de-paz.types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redNombre: string | undefined;
  iglesiaId: string | undefined;
  creando: boolean;
  onCrear: (nombre: string | undefined, sublideresIds: string[]) => void;
}

export function CrearCdpDialog({ open, onOpenChange, redNombre, iglesiaId, creando, onCrear }: Props) {
  const [nombre, setNombre] = useState('');
  const [sublideres, setSublideres] = useState<PersonaBusqueda[]>([]);

  function limpiar() {
    setNombre('');
    setSublideres([]);
  }

  function handleCrear() {
    onCrear(
      nombre.trim() || undefined,
      sublideres.map((s) => s.id)
    );
    limpiar();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) limpiar(); onOpenChange(o); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nueva Casa de Paz</DialogTitle>
          <DialogDescription>En la red {redNombre}.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nombre_cdp">Nombre (opcional)</Label>
            <Input
              id="nombre_cdp"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Se identifica por su líder si se deja vacío"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Sublíderes (opcional)</Label>
            {sublideres.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {sublideres.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-1.5 text-sm">
                    {s.nombre_completo}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setSublideres((prev) => prev.filter((p) => p.id !== s.id))}
                      aria-label="Quitar"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <BuscadorPersona
              iglesiaId={iglesiaId}
              excluirIds={sublideres.map((s) => s.id)}
              onSeleccionar={(p) => setSublideres((prev) => [...prev, p])}
            />
          </div>
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
