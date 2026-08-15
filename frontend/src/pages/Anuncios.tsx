// VisionHub -- KAN-101 (T3): pantalla de gestion de anuncios.
//
// Sin item de nav todavia -- se llega por URL directa, mismo criterio que
// tuvo Estructura Organizacional para Lider de Red antes de KAN-78. El
// propio guard de acceso vive aca adentro (useCapacidadAnuncio), no en
// RequiereRol. Crear/editar viven en pagina propia (AnuncioForm.tsx,
// 2026-08-15, pedido explicito del owner: mas control que un modal).
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Megaphone, Pencil, Plus, Trash2, UserCog, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { BuscadorPersona } from '@/components/casas-de-paz/BuscadorPersona';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { useAuthStore } from '@/store/auth.store';
import {
  useAsignarEncargadoAnuncio,
  useCapacidadAnuncio,
  useEliminarAnuncio,
  useEncargadosAnuncio,
  useMisAnunciosGestion,
  useMoverPrioridadAnuncio,
  useQuitarEncargadoAnuncio,
  useToggleActivoAnuncio,
  useUrlFirmadaAnuncio,
} from '@/hooks/useAnuncios';
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

function etiquetaAlcance(anuncio: AnuncioGestion): string {
  if (anuncio.alcance_tipo === 'IGLESIA') return 'Toda la iglesia';
  if (anuncio.alcance_tipo === 'RED') {
    if (anuncio.redes.length === 0) return 'Red';
    if (anuncio.redes.length === 1) return anuncio.redes[0].nombre;
    return `${anuncio.redes.length} Redes`;
  }
  if (anuncio.casas_de_paz.length === 0) return 'Casa de Paz';
  if (anuncio.casas_de_paz.length === 1) return anuncio.casas_de_paz[0].nombre;
  return `${anuncio.casas_de_paz.length} Casas de Paz`;
}

function FilaAnuncio({
  anuncio,
  puedeSubir,
  puedeBajar,
  onEditar,
  onEliminar,
}: {
  anuncio: AnuncioGestion;
  puedeSubir: boolean;
  puedeBajar: boolean;
  onEditar: () => void;
  onEliminar: () => void;
}) {
  const toggleActivo = useToggleActivoAnuncio();
  const mover = useMoverPrioridadAnuncio();

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3">
      <div className="flex shrink-0 flex-col gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={!puedeSubir || mover.isPending}
          onClick={() => mover.mutate({ anuncioId: anuncio.id, direccion: 'SUBIR' })}
          aria-label="Subir prioridad"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={!puedeBajar || mover.isPending}
          onClick={() => mover.mutate({ anuncioId: anuncio.id, direccion: 'BAJAR' })}
          aria-label="Bajar prioridad"
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </Button>
      </div>
      <MiniaturaAnuncio imagenPath={anuncio.imagen_path} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-foreground">{anuncio.titulo}</p>
          {anuncio.es_borrador && (
            <Badge variant="outline" className="shrink-0 text-[11px] text-amber-600">Borrador</Badge>
          )}
          <Badge variant="outline" className="shrink-0 text-[11px] text-muted-foreground">
            {etiquetaAlcance(anuncio)}
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
  const navigate = useNavigate();
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);
  const { data: capacidad, isLoading: cargandoCapacidad } = useCapacidadAnuncio(iglesiaActivaId ?? undefined);
  const { data: anuncios = [], isLoading: cargandoAnuncios } = useMisAnunciosGestion(iglesiaActivaId ?? undefined);
  const eliminar = useEliminarAnuncio();

  const [anuncioEliminar, setAnuncioEliminar] = useState<AnuncioGestion | null>(null);
  const [mostrarEncargados, setMostrarEncargados] = useState(false);

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

  const puedeCrear = !!capacidad && (capacidad.puede_iglesia || capacidad.redes.length > 0 || capacidad.casas_de_paz.length > 0);

  if (!puedeCrear) {
    return (
      <div className="flex flex-col gap-6">
        <SeccionIconHeader icon={Megaphone} color="#ff9500" titulo="Anuncios" descripcion="Comunicá información a tu Red o a toda la iglesia." />
        <ProximamentePlaceholder
          titulo="Sin acceso"
          descripcion="Solo el Pastor, el Supervisor de la Visión en Acción, un Encargado de Anuncios, el Líder de Red y el Supervisor de Red pueden crear anuncios."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <SeccionIconHeader icon={Megaphone} color="#ff9500" titulo="Anuncios" descripcion="Se muestran como modal al ingresar a VisionHub." />
        <div className="flex shrink-0 gap-2">
          {capacidad?.puede_designar_encargados && (
            <Button type="button" variant="outline" className="gap-1.5" onClick={() => setMostrarEncargados(true)}>
              <UserCog className="h-4 w-4" />
              Encargados
            </Button>
          )}
          <Button type="button" className="gap-1.5" onClick={() => navigate(ROUTES.ANUNCIO_NUEVO)}>
            <Plus className="h-4 w-4" />
            Anuncio
          </Button>
        </div>
      </div>

      {cargandoAnuncios ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : anuncios.length === 0 ? (
        <ProximamentePlaceholder titulo="Todavía no hay anuncios" descripcion="Creá el primero con el botón de arriba." />
      ) : (
        <div className="flex flex-col gap-2">
          {anuncios.map((a, i) => (
            <FilaAnuncio
              key={a.id}
              anuncio={a}
              puedeSubir={i > 0}
              puedeBajar={i < anuncios.length - 1}
              onEditar={() => navigate(ROUTES.ANUNCIO_EDITAR.replace(':anuncioId', a.id))}
              onEliminar={() => setAnuncioEliminar(a)}
            />
          ))}
        </div>
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

      {capacidad?.puede_designar_encargados && (
        <GestionarEncargadosDialog open={mostrarEncargados} onOpenChange={setMostrarEncargados} iglesiaId={iglesiaActivaId} />
      )}
    </div>
  );
}

/**
 * Encargado de Anuncios (2026-08-15, KAN-103): cargo delegado que el
 * Supervisor de la Visión en Acción (o el Pastor) puede otorgar a 0..N
 * personas, sin importar su rol organizacional -- si no hay nadie designado,
 * Supervisor/Pastor conservan la capacidad completa (default sin cambios).
 */
function GestionarEncargadosDialog({
  open,
  onOpenChange,
  iglesiaId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  iglesiaId: string;
}) {
  const { data: encargados = [], isLoading } = useEncargadosAnuncio(iglesiaId);
  const asignar = useAsignarEncargadoAnuncio();
  const quitar = useQuitarEncargadoAnuncio();
  const [otp, setOtp] = useState('');
  const [personaAAgregar, setPersonaAAgregar] = useState<{ id: string; nombre_completo: string } | null>(null);

  function manejarAgregar() {
    if (!personaAAgregar || otp.length !== 6) return;
    asignar.mutate(
      { iglesiaId, personaId: personaAAgregar.id, otp },
      {
        onSuccess: () => {
          toast.success(`${personaAAgregar.nombre_completo} ahora es Encargado de Anuncios`);
          setPersonaAAgregar(null);
          setOtp('');
        },
        onError: (e) => toast.error(e.message || 'No se pudo asignar el cargo'),
      }
    );
  }

  function manejarQuitar(personaId: string, nombre: string) {
    if (otp.length !== 6) {
      toast.error('Ingresá el código de confirmación primero');
      return;
    }
    quitar.mutate(
      { iglesiaId, personaId, otp },
      {
        onSuccess: () => {
          toast.success(`${nombre} ya no es Encargado de Anuncios`);
          setOtp('');
        },
        onError: (e) => toast.error(e.message || 'No se pudo quitar el cargo'),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Encargados de Anuncios</DialogTitle>
          <DialogDescription>
            Personas designadas para gestionar los anuncios de la iglesia en tu nombre. Sin nadie designado, vos
            conservás el control total.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {isLoading ? (
            <Skeleton className="h-16 w-full rounded-xl" />
          ) : encargados.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">Todavía no hay nadie designado.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {encargados.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm">
                  {e.nombre}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:text-destructive"
                    disabled={quitar.isPending}
                    onClick={() => manejarQuitar(e.persona_id, e.nombre)}
                    aria-label="Quitar"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-1.5 border-t border-border/60 pt-3">
            <BuscadorPersona
              iglesiaId={iglesiaId}
              excluirIds={encargados.map((e) => e.persona_id)}
              onSeleccionar={(p) => setPersonaAAgregar(p)}
            />
            {personaAAgregar && (
              <p className="text-[12px] text-muted-foreground">Agregar a <strong>{personaAAgregar.nombre_completo}</strong>:</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Input
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Código de confirmación (6 dígitos)"
              className={CAMPO_ESTILO}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" disabled={!personaAAgregar || otp.length !== 6 || asignar.isPending} onClick={manejarAgregar}>
            {asignar.isPending ? 'Agregando...' : 'Agregar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
