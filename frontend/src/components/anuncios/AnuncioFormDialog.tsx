// VisionHub -- KAN-101 (T3/T4): formulario de creacion/edicion de anuncios.
import { useEffect, useMemo, useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { cn } from '@/lib/utils';
import {
  detectarOrientacionImagen,
  validarImagenAnuncio,
} from '@/services/anuncio.service';
import { useCrearAnuncio, useActualizarAnuncio, useRolesDisponiblesAnuncio, useSubirImagenAnuncio, useUrlFirmadaAnuncio } from '@/hooks/useAnuncios';
import type { AnuncioGestion, CapacidadAnuncio, OrientacionImagenAnuncio, RolDestinatarioAnuncio } from '@/types/anuncio.types';

const ETIQUETA_ROL: Record<RolDestinatarioAnuncio, string> = {
  LIDER_RED: 'Líder de Red',
  SUBLIDER_RED: 'Supervisor de Red',
  LIDER_CDP: 'Líder de Casa de Paz',
  SUBLIDER_CDP: 'Sublíder de Casa de Paz',
  MIEMBRO: 'Miembro (próximamente)',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  iglesiaId: string;
  capacidad: CapacidadAnuncio;
  /** Si viene, es edición; si no, es alta. */
  anuncio?: AnuncioGestion | null;
  onGuardado: () => void;
}

export function AnuncioFormDialog({ open, onOpenChange, iglesiaId, capacidad, anuncio, onGuardado }: Props) {
  const esEdicion = !!anuncio;

  // Alcance: null = toda la iglesia (solo si capacidad.puede_iglesia), un id
  // de red puntual en caso contrario. En edición el alcance queda fijo (no se
  // puede "mover" un anuncio de Red -- se borra y se crea uno nuevo).
  const [redId, setRedId] = useState<string | null>(anuncio?.red_id ?? (capacidad.puede_iglesia ? null : capacidad.redes[0]?.id ?? null));
  const [titulo, setTitulo] = useState(anuncio?.titulo ?? '');
  const [mensaje, setMensaje] = useState(anuncio?.mensaje ?? '');
  const [rolesSeleccionados, setRolesSeleccionados] = useState<RolDestinatarioAnuncio[]>(anuncio?.roles_destinatarios ?? []);
  const [fechaFin, setFechaFin] = useState(anuncio?.fecha_fin ? anuncio.fecha_fin.slice(0, 16) : '');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [orientacionDetectada, setOrientacionDetectada] = useState<OrientacionImagenAnuncio | null>(anuncio?.imagen_orientacion ?? null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorImagen, setErrorImagen] = useState<string | null>(null);

  const { data: rolesDisponibles = [] } = useRolesDisponiblesAnuncio(iglesiaId, redId);
  const { data: imagenActualUrl } = useUrlFirmadaAnuncio(esEdicion && !archivo ? anuncio?.imagen_path : undefined);

  const subirImagen = useSubirImagenAnuncio();
  const crear = useCrearAnuncio();
  const actualizar = useActualizarAnuncio();
  const guardando = subirImagen.isPending || crear.isPending || actualizar.isPending;

  // Reset al abrir para un anuncio distinto (o al pasar de edicion a alta).
  useEffect(() => {
    if (!open) return;
    setRedId(anuncio?.red_id ?? (capacidad.puede_iglesia ? null : capacidad.redes[0]?.id ?? null));
    setTitulo(anuncio?.titulo ?? '');
    setMensaje(anuncio?.mensaje ?? '');
    setRolesSeleccionados(anuncio?.roles_destinatarios ?? []);
    setFechaFin(anuncio?.fecha_fin ? anuncio.fecha_fin.slice(0, 16) : '');
    setArchivo(null);
    setOrientacionDetectada(anuncio?.imagen_orientacion ?? null);
    setPreviewUrl(null);
    setErrorImagen(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, anuncio?.id]);

  // Solo mostrar el selector de Red cuando el usuario tiene mas de una
  // opcion real (Supervisor con al menos 1 Red propia ademas de "toda la
  // iglesia", o Lider/Supervisor con mas de una Red).
  const opcionesAlcance = useMemo(() => {
    const opciones: { valor: string; etiqueta: string }[] = [];
    if (capacidad.puede_iglesia) opciones.push({ valor: 'IGLESIA', etiqueta: 'Toda la iglesia' });
    for (const red of capacidad.redes) {
      opciones.push({ valor: red.id, etiqueta: `Red ${red.nombre}` });
    }
    return opciones;
  }, [capacidad]);

  function handleArchivo(file: File | null) {
    setArchivo(file);
    setErrorImagen(null);
    setOrientacionDetectada(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (!file) return;

    const error = validarImagenAnuncio(file);
    if (error) {
      setErrorImagen(error);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    const img = new Image();
    img.onload = () => {
      const orientacion = detectarOrientacionImagen(img.width, img.height);
      if (!orientacion) {
        setErrorImagen('La imagen debe ser cuadrada (1:1) o vertical -- horizontal no está soportado.');
      }
      setOrientacionDetectada(orientacion);
    };
    img.src = url;
  }

  function toggleRol(rol: RolDestinatarioAnuncio) {
    setRolesSeleccionados((prev) => (prev.includes(rol) ? prev.filter((r) => r !== rol) : [...prev, rol]));
  }

  const puedeGuardar =
    titulo.trim().length >= 2 &&
    rolesSeleccionados.length > 0 &&
    (esEdicion ? !!anuncio?.imagen_path || !!archivo : !!archivo) &&
    (!archivo || (!!orientacionDetectada && !errorImagen));

  async function handleGuardar() {
    if (!puedeGuardar) return;
    try {
      let imagenPath = anuncio?.imagen_path ?? '';
      let orientacion: OrientacionImagenAnuncio = anuncio?.imagen_orientacion ?? 'CUADRADA';
      if (archivo && orientacionDetectada) {
        imagenPath = await subirImagen.mutateAsync({ iglesiaId, archivo });
        orientacion = orientacionDetectada;
      }

      const fechaFinISO = fechaFin ? new Date(fechaFin).toISOString() : null;

      if (esEdicion && anuncio) {
        await actualizar.mutateAsync({
          anuncioId: anuncio.id,
          titulo: titulo.trim(),
          mensaje: mensaje.trim() || null,
          imagenPath,
          imagenOrientacion: orientacion,
          rolesDestinatarios: rolesSeleccionados,
          fechaFin: fechaFinISO,
        });
        toast.success('Anuncio actualizado');
      } else {
        await crear.mutateAsync({
          iglesiaId,
          redId: redId,
          titulo: titulo.trim(),
          mensaje: mensaje.trim() || null,
          imagenPath,
          imagenOrientacion: orientacion,
          rolesDestinatarios: rolesSeleccionados,
          fechaFin: fechaFinISO,
        });
        toast.success('Anuncio creado');
      }
      onGuardado();
      onOpenChange(false);
    } catch (e) {
      const mensajeError = (e as { message?: string })?.message ?? '';
      toast.error(mensajeError || 'No se pudo guardar el anuncio');
    }
  }

  const imagenAMostrar = previewUrl ?? imagenActualUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{esEdicion ? 'Editar anuncio' : 'Nuevo anuncio'}</DialogTitle>
          <DialogDescription>Imagen cuadrada (1:1) o vertical, máx. 5MB. Se muestra como modal al ingresar.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {!esEdicion && opcionesAlcance.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <Label>Alcance</Label>
              <Select value={redId ?? 'IGLESIA'} onValueChange={(v) => setRedId(v === 'IGLESIA' ? null : v)}>
                <SelectTrigger className={cn('w-full', CAMPO_ESTILO)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {opcionesAlcance.map((o) => (
                    <SelectItem key={o.valor} value={o.valor}>{o.etiqueta}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="anuncio_titulo">Título (uso interno)</Label>
            <Input
              id="anuncio_titulo"
              className={CAMPO_ESTILO}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej. Retiro anual de líderes"
              maxLength={150}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="anuncio_mensaje">Mensaje (opcional, se muestra debajo de la imagen)</Label>
            <Textarea
              id="anuncio_mensaje"
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Texto corto opcional"
              rows={2}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="anuncio_imagen">Imagen</Label>
            <Input
              id="anuncio_imagen"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className={CAMPO_ESTILO}
              onChange={(e) => handleArchivo(e.target.files?.[0] ?? null)}
            />
            {errorImagen && <p className="text-[12px] text-destructive">{errorImagen}</p>}
            {orientacionDetectada && !errorImagen && (
              <p className="text-[12px] text-muted-foreground">Detectada: {orientacionDetectada === 'CUADRADA' ? 'cuadrada (1:1)' : 'vertical'}</p>
            )}
            {imagenAMostrar && (
              <img src={imagenAMostrar} alt="Vista previa" className="mt-1 h-32 w-auto rounded-xl border border-border/60 object-cover" />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Destinatarios</Label>
            <div className="flex flex-col gap-2 rounded-xl border border-border/60 p-3">
              {rolesDisponibles.length === 0 && <p className="text-[12px] text-muted-foreground">Cargando roles disponibles...</p>}
              {rolesDisponibles.map((rol) => (
                <label key={rol} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={rolesSeleccionados.includes(rol)} onCheckedChange={() => toggleRol(rol)} />
                  {ETIQUETA_ROL[rol]}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="anuncio_fecha_fin">Fecha de fin (opcional)</Label>
            <Input
              id="anuncio_fecha_fin"
              type="datetime-local"
              className={CAMPO_ESTILO}
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={handleGuardar} disabled={!puedeGuardar || guardando}>
            {guardando ? <Spinner className="mr-1.5" /> : null}
            {esEdicion ? 'Guardar cambios' : 'Crear anuncio'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
