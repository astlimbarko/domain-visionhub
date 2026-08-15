import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCiudades, useGuardarDomicilioCdp } from '@/hooks/useCasasDePaz';
import type { DomicilioCdp } from '@/types/casas-de-paz.types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cdpId: string;
  iglesiaId: string;
  domicilio?: DomicilioCdp | null;
}

const VACIO = { ciudadId: '', zona: '', calle: '', numero: '', referencia: '', urlGps: '' };

export function DomicilioAnfitrionDialog({ open, onOpenChange, cdpId, iglesiaId, domicilio }: Props) {
  const [form, setForm] = useState(VACIO);
  const { data: ciudades = [], isLoading: cargandoCiudades } = useCiudades();
  const guardar = useGuardarDomicilioCdp(iglesiaId);

  useEffect(() => {
    if (!open) return;
    setForm({
      ciudadId: domicilio?.ciudad_id ?? '',
      zona: domicilio?.zona ?? '',
      calle: domicilio?.calle ?? '',
      numero: domicilio?.numero ?? '',
      referencia: domicilio?.referencia ?? '',
      urlGps: domicilio?.url_gps ?? '',
    });
  }, [open, domicilio]);

  function handleGuardar(e?: FormEvent) {
    e?.preventDefault();
    if (!form.ciudadId) return;
    guardar.mutate(
      {
        cdpId,
        datos: {
          ciudadId: form.ciudadId,
          zona: form.zona.trim() || null,
          calle: form.calle.trim() || null,
          numero: form.numero.trim() || null,
          referencia: form.referencia.trim() || null,
          url_gps: form.urlGps.trim() || null,
        },
      },
      {
        onSuccess: () => {
          toast.success('Domicilio guardado');
          onOpenChange(false);
        },
        onError: () => toast.error('No se pudo guardar el domicilio'),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Domicilio del anfitrión</DialogTitle>
          <DialogDescription>Solo la ciudad es obligatoria; el resto ayuda a ubicar la casa.</DialogDescription>
        </DialogHeader>

        {/* Bug real (2026-08-15, mismo patron de KAN-202): sin un <form>,
            Enter en cualquier campo de texto no hacia nada -- solo funcionaba
            con el mouse/boton "Guardar". Relevante en movil, donde el boton
            "Ir"/"Listo" del teclado virtual dispara el submit del form. */}
        <form onSubmit={handleGuardar} className="contents">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="domicilio_ciudad">Ciudad *</Label>
            <Select value={form.ciudadId} onValueChange={(v) => setForm((f) => ({ ...f, ciudadId: v }))}>
              <SelectTrigger id="domicilio_ciudad" className="w-full">
                <SelectValue placeholder={cargandoCiudades ? 'Cargando...' : 'Elegí una ciudad'} />
              </SelectTrigger>
              <SelectContent>
                {ciudades.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="domicilio_zona">Zona o barrio</Label>
              <Input id="domicilio_zona" value={form.zona} onChange={(e) => setForm((f) => ({ ...f, zona: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="domicilio_numero">Número de casa</Label>
              <Input id="domicilio_numero" value={form.numero} onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="domicilio_calle">Calle o avenida</Label>
            <Input id="domicilio_calle" value={form.calle} onChange={(e) => setForm((f) => ({ ...f, calle: e.target.value }))} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="domicilio_referencia">Referencia</Label>
            <Textarea
              id="domicilio_referencia"
              rows={2}
              placeholder="Ej. Portón verde, frente a la plaza"
              value={form.referencia}
              onChange={(e) => setForm((f) => ({ ...f, referencia: e.target.value }))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="domicilio_gps">Enlace de ubicación (Google Maps)</Label>
            <Input
              id="domicilio_gps"
              type="url"
              inputMode="url"
              placeholder="https://maps.app.goo.gl/…"
              value={form.urlGps}
              onChange={(e) => setForm((f) => ({ ...f, urlGps: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="submit" disabled={guardar.isPending || !form.ciudadId}>
            {guardar.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
