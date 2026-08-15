// VisionHub -- KAN-101 (T3/T4): formulario de creacion/edicion de anuncios.
// Pagina propia (2026-08-15, pedido explicito del owner: mas control que un
// modal) -- reemplaza a AnuncioFormDialog.tsx. Alcance multiple (Redes/CdP),
// Guardar borrador vs Publicar, duraciones rapidas, "mostrar de nuevo" al
// reeditar un publicado -- ver anuncios.txt SS40.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { SeccionIconHeader } from '@/components/shared/SeccionIconHeader';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { ROUTES } from '@/utils/constants';
import {
  detectarOrientacionImagen,
  validarImagenAnuncio,
} from '@/services/anuncio.service';
import {
  useCapacidadAnuncio,
  useCrearAnuncio,
  useActualizarAnuncio,
  useMisAnunciosGestion,
  usePublicarAnuncio,
  useRolesDisponiblesAnuncio,
  useSubirImagenAnuncio,
  useUrlFirmadaAnuncio,
} from '@/hooks/useAnuncios';
import type { AlcanceTipoAnuncio, OrientacionImagenAnuncio, RolDestinatarioAnuncio } from '@/types/anuncio.types';

const ETIQUETA_ROL: Record<RolDestinatarioAnuncio, string> = {
  LIDER_RED: 'Líder de Red',
  SUBLIDER_RED: 'Supervisor de Red',
  LIDER_CDP: 'Líder de Casa de Paz',
  SUBLIDER_CDP: 'Sublíder de Casa de Paz',
  MIEMBRO: 'Miembro (próximamente)',
};

const DURACIONES_RAPIDAS = [
  { dias: 1, etiqueta: '1 día' },
  { dias: 3, etiqueta: '3 días' },
  { dias: 7, etiqueta: '7 días' },
  { dias: 21, etiqueta: '21 días' },
  { dias: 30, etiqueta: '30 días' },
] as const;

function aInputDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AnuncioForm() {
  const navigate = useNavigate();
  const { anuncioId } = useParams<{ anuncioId?: string }>();
  const esEdicion = !!anuncioId;
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);

  const { data: capacidad, isLoading: cargandoCapacidad } = useCapacidadAnuncio(iglesiaActivaId ?? undefined);
  const { data: anuncios, isLoading: cargandoAnuncios } = useMisAnunciosGestion(iglesiaActivaId ?? undefined);
  const anuncio = esEdicion ? anuncios?.find((a) => a.id === anuncioId) ?? null : null;
  const cargando = cargandoCapacidad || (esEdicion && cargandoAnuncios);

  function volver() {
    navigate(ROUTES.ANUNCIOS);
  }

  function alcanceInicial(): AlcanceTipoAnuncio {
    if (anuncio) return anuncio.alcance_tipo;
    if (capacidad?.puede_iglesia) return 'IGLESIA';
    if (capacidad && capacidad.redes.length > 0) return 'RED';
    return 'CDP';
  }

  const [alcanceTipo, setAlcanceTipo] = useState<AlcanceTipoAnuncio>('IGLESIA');
  const [redIds, setRedIds] = useState<string[]>([]);
  const [cdpIds, setCdpIds] = useState<string[]>([]);
  const [titulo, setTitulo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [rolesSeleccionados, setRolesSeleccionados] = useState<RolDestinatarioAnuncio[]>([]);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [duracionPersonalizada, setDuracionPersonalizada] = useState(true);
  const [mostrarNuevamente, setMostrarNuevamente] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [orientacionDetectada, setOrientacionDetectada] = useState<OrientacionImagenAnuncio | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorImagen, setErrorImagen] = useState<string | null>(null);
  const [inicializado, setInicializado] = useState(false);

  // Inicializa los campos una sola vez, apenas los datos (capacidad y, si es
  // edicion, el anuncio) estan disponibles -- no puede ser un simple useState
  // inicial porque en edicion la pagina puede abrirse por URL directa, sin
  // que fn_mis_anuncios_gestion haya resuelto todavia.
  useEffect(() => {
    if (inicializado || cargando) return;
    if (esEdicion && !anuncio) return;
    setAlcanceTipo(alcanceInicial());
    setRedIds(anuncio?.redes.map((r) => r.id) ?? (capacidad?.puede_iglesia ? [] : (capacidad?.redes.map((r) => r.id).slice(0, 1) ?? [])));
    setCdpIds(anuncio?.casas_de_paz.map((c) => c.id) ?? []);
    setTitulo(anuncio?.titulo ?? '');
    setMensaje(anuncio?.mensaje ?? '');
    setRolesSeleccionados(anuncio?.roles_destinatarios ?? []);
    setFechaInicio(anuncio?.fecha_publicacion ? aInputDatetimeLocal(anuncio.fecha_publicacion) : '');
    setFechaFin(anuncio?.fecha_fin ? aInputDatetimeLocal(anuncio.fecha_fin) : '');
    setOrientacionDetectada(anuncio?.imagen_orientacion ?? null);
    setInicializado(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicializado, cargando, esEdicion, anuncio, capacidad]);

  const { data: rolesDisponibles = [] } = useRolesDisponiblesAnuncio(iglesiaActivaId ?? undefined, alcanceTipo, redIds, cdpIds);
  const { data: imagenActualUrl } = useUrlFirmadaAnuncio(esEdicion && !archivo ? anuncio?.imagen_path : undefined);

  const subirImagen = useSubirImagenAnuncio();
  const crear = useCrearAnuncio();
  const actualizar = useActualizarAnuncio();
  const publicar = usePublicarAnuncio();
  const guardando = subirImagen.isPending || crear.isPending || actualizar.isPending || publicar.isPending;

  const tiposAlcanceDisponibles = useMemo(() => {
    if (!capacidad) return [];
    const tipos: { valor: AlcanceTipoAnuncio; etiqueta: string }[] = [];
    if (capacidad.puede_iglesia) tipos.push({ valor: 'IGLESIA', etiqueta: 'Toda la iglesia' });
    if (capacidad.redes.length > 0 || capacidad.puede_iglesia) tipos.push({ valor: 'RED', etiqueta: 'Redes específicas' });
    if (capacidad.casas_de_paz.length > 0 || capacidad.puede_iglesia) tipos.push({ valor: 'CDP', etiqueta: 'Casas de Paz específicas' });
    return tipos;
  }, [capacidad]);

  const redesSeleccionables = capacidad?.redes ?? [];
  const cdpsSeleccionables = useMemo(
    () => (redIds.length > 0 ? (capacidad?.casas_de_paz ?? []).filter((c) => redIds.includes(c.red_id)) : (capacidad?.casas_de_paz ?? [])),
    [capacidad, redIds]
  );

  function toggleRed(id: string) {
    setRedIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  }

  function toggleCdp(id: string) {
    setCdpIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

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

  function aplicarDuracionRapida(dias: number) {
    setDuracionPersonalizada(false);
    const base = fechaInicio ? new Date(fechaInicio) : new Date();
    const fin = new Date(base.getTime() + dias * 24 * 60 * 60 * 1000);
    setFechaFin(aInputDatetimeLocal(fin.toISOString()));
  }

  const alcanceCompleto =
    alcanceTipo === 'IGLESIA' ? true : alcanceTipo === 'RED' ? redIds.length > 0 : cdpIds.length > 0;

  const puedeGuardar =
    titulo.trim().length >= 2 &&
    alcanceCompleto &&
    rolesSeleccionados.length > 0 &&
    (esEdicion ? !!anuncio?.imagen_path || !!archivo : !!archivo) &&
    (!archivo || (!!orientacionDetectada && !errorImagen));

  async function subirImagenSiHaceFalta() {
    let imagenPath = anuncio?.imagen_path ?? '';
    let orientacion: OrientacionImagenAnuncio = anuncio?.imagen_orientacion ?? 'CUADRADA';
    if (archivo && orientacionDetectada && iglesiaActivaId) {
      imagenPath = await subirImagen.mutateAsync({ iglesiaId: iglesiaActivaId, archivo });
      orientacion = orientacionDetectada;
    }
    return { imagenPath, orientacion };
  }

  async function handleGuardar(esBorrador: boolean) {
    if (!puedeGuardar || !iglesiaActivaId) return;
    try {
      const { imagenPath, orientacion } = await subirImagenSiHaceFalta();
      const fechaInicioISO = fechaInicio ? new Date(fechaInicio).toISOString() : null;
      const fechaFinISO = fechaFin ? new Date(fechaFin).toISOString() : null;

      if (esEdicion && anuncio) {
        await actualizar.mutateAsync({
          anuncioId: anuncio.id,
          alcanceTipo,
          redIds,
          cdpIds,
          titulo: titulo.trim(),
          mensaje: mensaje.trim() || null,
          imagenPath,
          imagenOrientacion: orientacion,
          rolesDestinatarios: rolesSeleccionados,
          fechaPublicacion: fechaInicioISO,
          fechaFin: fechaFinISO,
          mostrarNuevamente,
        });
        if (anuncio.es_borrador && !esBorrador) {
          await publicar.mutateAsync({ anuncioId: anuncio.id, fechaPublicacion: fechaInicioISO });
        }
        toast.success(esBorrador ? 'Borrador guardado' : 'Anuncio actualizado');
      } else {
        await crear.mutateAsync({
          iglesiaId: iglesiaActivaId,
          alcanceTipo,
          redIds,
          cdpIds,
          titulo: titulo.trim(),
          mensaje: mensaje.trim() || null,
          imagenPath,
          imagenOrientacion: orientacion,
          rolesDestinatarios: rolesSeleccionados,
          fechaPublicacion: fechaInicioISO,
          fechaFin: fechaFinISO,
          esBorrador,
        });
        toast.success(esBorrador ? 'Borrador guardado' : 'Anuncio publicado');
      }
      volver();
    } catch (e) {
      const mensajeError = (e as { message?: string })?.message ?? '';
      toast.error(mensajeError || 'No se pudo guardar el anuncio');
    }
  }

  if (!iglesiaActivaId) {
    volver();
    return null;
  }

  if (cargando || !inicializado) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (esEdicion && !anuncio) {
    return (
      <div className="flex flex-col gap-6">
        <SeccionIconHeader icon={Megaphone} color="#ff9500" titulo="Anuncio no encontrado" descripcion="Puede que ya se haya eliminado." />
        <Button type="button" variant="outline" className="w-fit gap-1.5" onClick={volver}>
          <ArrowLeft className="h-4 w-4" />
          Volver a Anuncios
        </Button>
      </div>
    );
  }

  const imagenAMostrar = previewUrl ?? imagenActualUrl;
  const esBorradorActual = esEdicion ? !!anuncio?.es_borrador : true;

  return (
    <div className="flex flex-col gap-6 pb-24">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon" onClick={volver} aria-label="Volver a Anuncios">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <SeccionIconHeader
          icon={Megaphone}
          color="#ff9500"
          titulo={esEdicion ? 'Editar anuncio' : 'Nuevo anuncio'}
          descripcion="Imagen cuadrada (1:1) o vertical, máx. 5MB. Se muestra como modal al ingresar."
        />
      </div>

      <section className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-5 max-w-2xl">
        {tiposAlcanceDisponibles.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <Label>Alcance</Label>
            <Select value={alcanceTipo} onValueChange={(v) => setAlcanceTipo(v as AlcanceTipoAnuncio)}>
              <SelectTrigger className={cn('w-full', CAMPO_ESTILO)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tiposAlcanceDisponibles.map((o) => (
                  <SelectItem key={o.valor} value={o.valor}>{o.etiqueta}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {alcanceTipo === 'RED' && (
          <div className="flex flex-col gap-1.5">
            <Label>Redes ({redIds.length} seleccionada{redIds.length === 1 ? '' : 's'})</Label>
            <div className="flex max-h-40 flex-col gap-2 overflow-y-auto rounded-xl border border-border/60 p-3">
              {redesSeleccionables.length === 0 && <p className="text-[12px] text-muted-foreground">No administrás ninguna Red.</p>}
              {redesSeleccionables.map((red) => (
                <label key={red.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={redIds.includes(red.id)} onCheckedChange={() => toggleRed(red.id)} />
                  {red.nombre}
                </label>
              ))}
            </div>
          </div>
        )}

        {alcanceTipo === 'CDP' && (
          <div className="flex flex-col gap-1.5">
            <Label>Casas de Paz ({cdpIds.length} seleccionada{cdpIds.length === 1 ? '' : 's'})</Label>
            <div className="flex max-h-40 flex-col gap-2 overflow-y-auto rounded-xl border border-border/60 p-3">
              {cdpsSeleccionables.length === 0 && <p className="text-[12px] text-muted-foreground">No hay Casas de Paz disponibles.</p>}
              {cdpsSeleccionables.map((cdp) => (
                <label key={cdp.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={cdpIds.includes(cdp.id)} onCheckedChange={() => toggleCdp(cdp.id)} />
                  {cdp.nombre}
                </label>
              ))}
            </div>
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
            <img src={imagenAMostrar} alt="Vista previa" className="mt-1 h-40 w-auto rounded-xl border border-border/60 object-cover" />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Destinatarios</Label>
          <div className="flex flex-col gap-2 rounded-xl border border-border/60 p-3">
            {rolesDisponibles.length === 0 && <p className="text-[12px] text-muted-foreground">Elegí el alcance para ver los roles disponibles.</p>}
            {rolesDisponibles.map((rol) => (
              <label key={rol} className="flex items-center gap-2 text-sm">
                <Checkbox checked={rolesSeleccionados.includes(rol)} onCheckedChange={() => toggleRol(rol)} />
                {ETIQUETA_ROL[rol]}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="anuncio_fecha_inicio">Fecha de inicio (opcional, por defecto ahora)</Label>
          <Input
            id="anuncio_fecha_inicio"
            type="datetime-local"
            className={CAMPO_ESTILO}
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Duración</Label>
          <div className="flex flex-wrap gap-1.5">
            {DURACIONES_RAPIDAS.map((d) => (
              <Button key={d.dias} type="button" variant="outline" size="sm" onClick={() => aplicarDuracionRapida(d.dias)}>
                {d.etiqueta}
              </Button>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setDuracionPersonalizada(true)}>
              Personalizado
            </Button>
          </div>
          {duracionPersonalizada && (
            <Input
              id="anuncio_fecha_fin"
              type="datetime-local"
              className={cn('mt-1', CAMPO_ESTILO)}
              placeholder="Fecha de fin (opcional, sin vencimiento si se deja vacío)"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
            />
          )}
          {!duracionPersonalizada && fechaFin && (
            <p className="text-[12px] text-muted-foreground">Termina el {new Date(fechaFin).toLocaleString('es-BO')}</p>
          )}
        </div>

        {esEdicion && !esBorradorActual && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={mostrarNuevamente} onCheckedChange={(v) => setMostrarNuevamente(v === true)} />
            Mostrar de nuevo a quienes ya lo vieron
          </label>
        )}
      </section>

      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border/60 bg-background/95 py-3 backdrop-blur-sm max-w-2xl">
        <Button type="button" variant="outline" onClick={volver} disabled={guardando}>
          Cancelar
        </Button>
        {esBorradorActual && (
          <Button type="button" variant="outline" onClick={() => handleGuardar(true)} disabled={!puedeGuardar || guardando}>
            {guardando ? <Spinner className="mr-1.5" /> : null}
            Guardar borrador
          </Button>
        )}
        <Button type="button" onClick={() => handleGuardar(false)} disabled={!puedeGuardar || guardando}>
          {guardando ? <Spinner className="mr-1.5" /> : null}
          {esBorradorActual ? 'Publicar' : 'Guardar cambios'}
        </Button>
      </div>
    </div>
  );
}
