import { useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useSubirFotoPerfil } from '@/hooks/usePersonaFoto';

/** Lado del recorte final -- KAN-209 pide 250x250 exacto, antes de que
 * KAN-207 lo comprima a JPG 80%. */
const LADO_RECORTE = 250;

function recortarAOffscreen(imagen: HTMLImageElement, area: Area): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = LADO_RECORTE;
  canvas.height = LADO_RECORTE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo obtener el contexto 2D del canvas');
  ctx.drawImage(imagen, area.x, area.y, area.width, area.height, 0, 0, LADO_RECORTE, LADO_RECORTE);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar el recorte'))), 'image/png');
  });
}

function cargarImagen(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
    img.src = url;
  });
}

interface EditorFotoPerfilDialogProps {
  archivo: File;
  iglesiaId: string;
  personaId: string;
  onCerrar: () => void;
  onSubida: () => void;
}

/** Recorte 1:1 con arrastre y zoom (KAN-209) -- al confirmar, genera un
 * recorte exacto de 250x250 y lo pasa a `subirFotoPerfil`, que ya hace pasar
 * ese resultado por el compresor reusable de KAN-207 (JPG calidad 80%) antes
 * de subirlo a Storage (KAN-210). */
export function EditorFotoPerfilDialog({ archivo, iglesiaId, personaId, onCerrar, onSubida }: EditorFotoPerfilDialogProps) {
  const [urlArchivo] = useState(() => URL.createObjectURL(archivo));
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaRecorte, setAreaRecorte] = useState<Area | null>(null);
  const subir = useSubirFotoPerfil();

  async function confirmar() {
    if (!areaRecorte) return;
    try {
      const imagen = await cargarImagen(urlArchivo);
      const recorte = await recortarAOffscreen(imagen, areaRecorte);
      await subir.mutateAsync({ iglesiaId, personaId, archivo: recorte });
      toast.success('Foto de perfil actualizada');
      URL.revokeObjectURL(urlArchivo);
      onSubida();
    } catch {
      toast.error('No se pudo subir la foto de perfil');
    }
  }

  function cerrar() {
    URL.revokeObjectURL(urlArchivo);
    onCerrar();
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && cerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar foto de perfil</DialogTitle>
          <DialogDescription>Arrastrá para mover, usá el control para acercar o alejar.</DialogDescription>
        </DialogHeader>

        <div className="relative h-72 w-full overflow-hidden rounded-2xl bg-muted">
          <Cropper
            image={urlArchivo}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_area, areaPixeles) => setAreaRecorte(areaPixeles)}
          />
        </div>

        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full accent-primary"
          aria-label="Zoom"
        />

        <DialogFooter>
          <Button variant="outline" onClick={cerrar} disabled={subir.isPending}>Cancelar</Button>
          <Button onClick={confirmar} disabled={subir.isPending || !areaRecorte}>
            {subir.isPending ? <Spinner className="h-4 w-4" /> : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
