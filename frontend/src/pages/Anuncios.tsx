// VisionHub -- KAN-101 (T3): pantalla de gestion de anuncios.
//
// Sin item de nav todavia (permisos.ts esta prohibido para esta sesion, ver
// KAN-101) -- se llega por URL directa, mismo criterio que tuvo Estructura
// Organizacional para Lider de Red antes de KAN-78. El propio guard de
// acceso vive aca adentro (useCapacidadAnuncio), no en RequiereRol.
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Megaphone, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SeccionIconHeader } from '@/components/shared/SeccionIconHeader';
import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';
import { AnuncioFormDialog } from '@/components/anuncios/AnuncioFormDialog';
import { useAuthStore } from '@/store/auth.store';
import { useCapacidadAnuncio, useEliminarAnuncio, useMisAnunciosGestion, useToggleActivoAnuncio, useUrlFirmadaAnuncio } from '@/hooks/useAnuncios';
import { ROUTES } from '@/utils/constants';
import type { AnuncioGestion, RolDestinatarioAnuncio } from '@/types/anuncio.types';

const ETIQUETA_ROL_CORTA: Record<RolDestinatarioAnuncio, string> = {
  LIDER_RED: 'Líder de Red',
  SUBLIDER_RED: 'Supervisor de Red',
  LIDER_CDP: 'Líder de CdP',
  SUBLIDER_CDP: 'Sublíder de CdP',
  MIEMBRO: 'Miembro',
};

function MiniaturaAnuncio({ imagenPath }: { imagenPath: string }) {
  const { data: url } = useUrlFirmadaAnuncio(imagenPath);
  return (
    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted">
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
    </div>
  );
}

function FilaAnuncio({
  anuncio,
  onEditar,
  onEliminar,
}: {
  anuncio: AnuncioGestion;
  onEditar: () => void;
  onEliminar: () => void;
}) {
  const toggleActivo = useToggleActivoAnuncio();

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3">
      <MiniaturaAnuncio imagenPath={anuncio.imagen_path} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-foreground">{anuncio.titulo}</p>
          <Badge variant="outline" className="shrink-0 text-[11px] text-muted-foreground">
            {anuncio.red_nombre ?? 'Toda la iglesia'}
          </Badge>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {anuncio.roles_destinatarios.map((rol) => (
            <Badge key={rol} variant="secondary" className="text-[10px]">
              {ETIQUETA_ROL_CORTA[rol]}
            </Badge>
          ))}
        </div>
        {anuncio.autor_nombre && <p className="mt-1 text-[11px] text-muted-foreground">Creado por {anuncio.autor_nombre}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <Switch
          checked={anuncio.activo}
          onCheckedChange={(activo) => toggleActivo.mutate({ anuncioId: anuncio.id, activo })}
          aria-label={anuncio.activo ? 'Desactivar anuncio' : 'Activar anuncio'}
        />
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="icon-sm" onClick={onEditar} aria-label="Editar">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-destructive hover:text-destructive"
            onClick={onEliminar}
            aria-label="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Anuncios() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);
  const { data: capacidad, isLoading: cargandoCapacidad } = useCapacidadAnuncio(iglesiaActivaId ?? undefined);
  const { data: anuncios = [], isLoading: cargandoAnuncios } = useMisAnunciosGestion(iglesiaActivaId ?? undefined);
  const eliminar = useEliminarAnuncio();

  const [mostrarForm, setMostrarForm] = useState(false);
  const [anuncioEditar, setAnuncioEditar] = useState<AnuncioGestion | null>(null);
  const [anuncioEliminar, setAnuncioEliminar] = useState<AnuncioGestion | null>(null);

  if (!iglesiaActivaId) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  if (cargandoCapacidad) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const puedeCrear = !!capacidad && (capacidad.puede_iglesia || capacidad.redes.length > 0);

  if (!puedeCrear) {
    return (
      <div className="flex flex-col gap-6">
        <SeccionIconHeader icon={Megaphone} color="#ff9500" titulo="Anuncios" descripcion="Comunicá información a tu Red o a toda la iglesia." />
        <ProximamentePlaceholder
          titulo="Sin acceso"
          descripcion="Solo el Supervisor de la Visión en Acción, el Líder de Red y el Supervisor de Red pueden crear anuncios."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <SeccionIconHeader icon={Megaphone} color="#ff9500" titulo="Anuncios" descripcion="Se muestran como modal al ingresar a VisionHub." />
        <Button
          type="button"
          className="shrink-0 gap-1.5"
          onClick={() => {
            setAnuncioEditar(null);
            setMostrarForm(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Anuncio
        </Button>
      </div>

      {cargandoAnuncios ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : anuncios.length === 0 ? (
        <ProximamentePlaceholder titulo="Todavía no hay anuncios" descripcion="Creá el primero con el botón de arriba." />
      ) : (
        <div className="flex flex-col gap-2">
          {anuncios.map((a) => (
            <FilaAnuncio
              key={a.id}
              anuncio={a}
              onEditar={() => {
                setAnuncioEditar(a);
                setMostrarForm(true);
              }}
              onEliminar={() => setAnuncioEliminar(a)}
            />
          ))}
        </div>
      )}

      {capacidad && (
        <AnuncioFormDialog
          open={mostrarForm}
          onOpenChange={setMostrarForm}
          iglesiaId={iglesiaActivaId}
          capacidad={capacidad}
          anuncio={anuncioEditar}
          onGuardado={() => setAnuncioEditar(null)}
        />
      )}

      <Dialog open={!!anuncioEliminar} onOpenChange={(open) => !open && setAnuncioEliminar(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar anuncio</DialogTitle>
            <DialogDescription>
              {anuncioEliminar ? `"${anuncioEliminar.titulo}" deja de mostrarse. No se puede deshacer.` : undefined}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="destructive"
              disabled={eliminar.isPending}
              onClick={async () => {
                if (!anuncioEliminar) return;
                try {
                  await eliminar.mutateAsync({ anuncioId: anuncioEliminar.id, imagenPath: anuncioEliminar.imagen_path });
                  toast.success('Anuncio eliminado');
                  setAnuncioEliminar(null);
                } catch (e) {
                  const mensaje = (e as { message?: string })?.message ?? '';
                  toast.error(mensaje || 'No se pudo eliminar el anuncio');
                }
              }}
            >
              {eliminar.isPending ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
