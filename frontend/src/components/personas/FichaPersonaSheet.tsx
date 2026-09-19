import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowRightLeft, Eye, EyeOff, Pencil, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/store/auth.store';
import { useMisRoles } from '@/hooks/useDashboard';
import { useMoverPersonaRed, usePersonaFicha, useToggleOculto } from '@/hooks/usePersonas';
import { FichaIdentidad, type FichaIdentidadHandle } from './FichaIdentidad';
import { FichaDirecciones } from './FichaDirecciones';
import { FichaTelefonos } from './FichaTelefonos';
import { FichaLlegada } from './FichaLlegada';
import { FichaFamilia } from './FichaFamilia';
import { FichaEvangelismo } from './FichaEvangelismo';
import { FichaMinisterios } from './FichaMinisterios';
import { FichaMilagros } from './FichaMilagros';
import { MoverPersonaRedDialog } from './MoverPersonaRedDialog';

interface Props {
  personaId: string | undefined;
  onOpenChange: (open: boolean) => void;
}

/** El código de regla va antes de ": " en el mensaje del backend (RAISE
 * EXCEPTION 'CODIGO: texto legible'). El texto que sigue ya es español
 * legible para el usuario -- no hace falta mapear cada código a mano. */
function mensajeAmigable(e: unknown, generico: string): string {
  const mensaje = (e as { message?: string } | null)?.message ?? '';
  const partes = mensaje.split(': ');
  if (partes.length > 1 && /^[A-Z_]+$/.test(partes[0])) return partes.slice(1).join(': ');
  if (mensaje.includes('permission denied') || mensaje.includes('row-level security')) return 'No tenés permiso para hacer este cambio';
  return generico;
}

/**
 * KAN-403: modal único centrado -- reemplaza la cascada anterior de 3
 * componentes (FichaPersonaSheet resumido -> FichaPersonaExtendida "ver
 * completa" -> FichaPersonaEditorSheet "editar"), cada uno un panel/overlay
 * distinto que había que ir abriendo en cadena. Ahora todo vive en un solo
 * Dialog centrado con un booleano `modoEdicion`: por defecto de solo
 * lectura, el botón "Editar" activa la edición in-place de las mismas 8
 * secciones (no hay una vista "resumida" aparte que mostrar/ocultar).
 *
 * `key={modoEdicion}` en cada sección: al cancelar la edición (volver a
 * modoEdicion=false sin guardar), las secciones se remontan y descartan
 * cualquier campo tocado a mano que no se haya guardado -- ninguna sección
 * tiene su propio botón "Cancelar" a nivel de fila, así que esta es la
 * forma limpia de que "Cancelar" realmente descarte cambios.
 */
export function FichaPersonaSheet({ personaId, onOpenChange }: Props) {
  const iglesias = useAuthStore((s) => s.iglesias);
  const { data: ficha, isLoading } = usePersonaFicha(personaId);
  const toggleOculto = useToggleOculto(personaId ?? '');
  const moverRed = useMoverPersonaRed(personaId ?? '');
  const [mostrarMoverRed, setMostrarMoverRed] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const identidadRef = useRef<FichaIdentidadHandle>(null);

  // Al seleccionar una persona nueva (o reabrir), siempre arranca en modo
  // lectura -- si no, quedaba "pegado" en el modo de la persona anterior.
  useEffect(() => {
    setModoEdicion(false);
  }, [personaId]);

  // Pedido del owner (2026-09-02): además de los operativos (Pastor/Supervisor
  // de la Visión), el Líder y el Supervisor de Red pueden editar la ficha de las
  // personas de SU Red. `redes_lider` (fn_mis_roles_dashboard) ya cubre a ambos
  // cargos (incluye SUBLIDER_RED). El RLS de `persona`/`persona_detalle` es
  // iglesia-wide, así que este candado del frontend es lo único que hay que
  // ampliar. Se acota a la Red de la persona (su Casa de Paz), no a toda la
  // iglesia -- para eso están los operativos.
  const { data: misRoles } = useMisRoles(ficha?.persona.iglesia_id);
  const esOperativo = ficha ? (iglesias.find((i) => i.id === ficha.persona.iglesia_id)?.es_operativo ?? false) : false;
  const esLiderDeSuRed =
    !!ficha?.casa_de_paz?.red_id && (misRoles?.redes_lider ?? []).some((r) => r.id === ficha.casa_de_paz?.red_id);
  const puedeEditar = esOperativo || esLiderDeSuRed;
  const editando = puedeEditar && modoEdicion;

  // Cargos vigentes que quedan atados a la Red/Casa de Paz que la persona
  // deja si se traslada -- no se "llevan" a la Red nueva (ver fn_mover_persona_red).
  const cargosOrigen = ficha
    ? ficha.cargos.filter(
        (c) =>
          (c.ambito === 'RED' && c.entidad === ficha.casa_de_paz?.red_nombre) ||
          (c.ambito === 'CDP' && c.entidad === ficha.casa_de_paz?.etiqueta)
      )
    : [];

  function manejarMover(params: { casaDePazDestinoId: string; motivo: string; confirmarCierreCargos: boolean; pin?: string }) {
    moverRed.mutate(params, {
      onSuccess: ({ pendiente }) => {
        toast.success(pendiente ? 'Quedó pendiente de autorización del Líder de Red' : 'Persona trasladada de Red');
        setMostrarMoverRed(false);
      },
      onError: (e) => toast.error(mensajeAmigable(e, 'No se pudo trasladar a la persona')),
    });
  }

  function manejarToggleOculto() {
    if (!ficha) return;
    toggleOculto.mutate(!ficha.persona.oculto, {
      onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo cambiar la visibilidad'),
    });
  }

  async function confirmarGuardar() {
    setGuardando(true);
    try {
      await identidadRef.current?.guardar();
      setModoEdicion(false);
    } finally {
      setGuardando(false);
      setMostrarConfirmar(false);
    }
  }

  return (
    <>
      <Dialog open={!!personaId} onOpenChange={(open) => !open && onOpenChange(false)}>
        <DialogContent className="flex h-[92dvh] flex-col sm:max-w-3xl">
          {isLoading || !ficha ? (
            <div className="flex flex-col gap-4 p-4">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2 pr-8 text-lg">
                  {ficha.persona.nombre_completo}
                  {ficha.estado_actual && <Badge variant="outline">{ficha.estado_actual.sigla}</Badge>}
                  {ficha.persona.oculto && (
                    <Badge variant="outline" className="gap-1">
                      <EyeOff className="h-3 w-3" />
                      Oculta
                    </Badge>
                  )}
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {ficha.persona.edad !== null ? `${ficha.persona.edad} años` : 'Edad no registrada'}
                  {ficha.casa_de_paz && ` · ${ficha.casa_de_paz.etiqueta}${ficha.casa_de_paz.red_nombre ? ` (${ficha.casa_de_paz.red_nombre})` : ''}`}
                </p>
              </DialogHeader>

              {puedeEditar && (
                <div className="flex flex-wrap gap-2 border-b border-border/60 pb-4">
                  {modoEdicion ? (
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setModoEdicion(false)}>
                      <X className="h-3.5 w-3.5" />
                      Cancelar edición
                    </Button>
                  ) : (
                    <Button type="button" size="sm" className="gap-1.5" onClick={() => setModoEdicion(true)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                  )}
                  {ficha.casa_de_paz && (
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setMostrarMoverRed(true)}>
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                      Cambiar de Red
                    </Button>
                  )}
                  <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={toggleOculto.isPending} onClick={manejarToggleOculto}>
                    {ficha.persona.oculto ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    {ficha.persona.oculto ? 'Quitar de ocultas' : 'Ocultar de búsquedas'}
                  </Button>
                </div>
              )}

              <div className="flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
                {ficha.evangelismo && (
                  <Card className="rounded-2xl shrink-0">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Evangelismo</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FichaEvangelismo evangelismo={ficha.evangelismo} />
                    </CardContent>
                  </Card>
                )}

                {ficha.cargos.length > 0 && (
                  <Card className="rounded-2xl shrink-0">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Cargos vigentes</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      {ficha.cargos.map((c, i) => (
                        <Badge key={i} variant="secondary">
                          {c.cargo_nombre} — {c.entidad}
                        </Badge>
                      ))}
                    </CardContent>
                  </Card>
                )}

                <Card className="rounded-2xl shrink-0">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Identidad y censo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FichaIdentidad key={modoEdicion ? 'edit' : 'view'} ref={identidadRef} personaId={ficha.persona.id} ficha={ficha} puedeEditar={editando} />
                  </CardContent>
                </Card>

                <Card className="rounded-2xl shrink-0">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Direcciones</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FichaDirecciones
                      key={modoEdicion ? 'edit' : 'view'}
                      personaId={ficha.persona.id}
                      iglesiaId={ficha.persona.iglesia_id}
                      direcciones={ficha.direcciones}
                      puedeEditar={editando}
                    />
                  </CardContent>
                </Card>

                <Card className="rounded-2xl shrink-0">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Teléfonos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FichaTelefonos
                      key={modoEdicion ? 'edit' : 'view'}
                      personaId={ficha.persona.id}
                      iglesiaId={ficha.persona.iglesia_id}
                      telefonos={ficha.telefonos}
                      puedeEditar={editando}
                    />
                  </CardContent>
                </Card>

                <Card className="rounded-2xl shrink-0">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Llegada a la iglesia</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FichaLlegada
                      key={modoEdicion ? 'edit' : 'view'}
                      personaId={ficha.persona.id}
                      iglesiaId={ficha.persona.iglesia_id}
                      llegadas={ficha.llegadas}
                      puedeEditar={editando}
                    />
                  </CardContent>
                </Card>

                <Card className="rounded-2xl shrink-0">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Familia</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FichaFamilia
                      key={modoEdicion ? 'edit' : 'view'}
                      personaId={ficha.persona.id}
                      iglesiaId={ficha.persona.iglesia_id}
                      ficha={ficha}
                      puedeEditar={editando}
                    />
                  </CardContent>
                </Card>

                <Card className="rounded-2xl shrink-0">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Ministerios</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FichaMinisterios
                      key={modoEdicion ? 'edit' : 'view'}
                      personaId={ficha.persona.id}
                      iglesiaId={ficha.persona.iglesia_id}
                      ministerios={ficha.ministerios ?? []}
                      puedeEditar={editando}
                    />
                  </CardContent>
                </Card>

                <Card className="rounded-2xl shrink-0">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Milagros</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FichaMilagros key={modoEdicion ? 'edit' : 'view'} personaId={ficha.persona.id} milagros={ficha.milagros ?? []} puedeEditar={editando} />
                  </CardContent>
                </Card>
              </div>

              {editando && (
                <div className="sticky bottom-0 -mx-0 border-t border-border bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80">
                  <Button type="button" onClick={() => setMostrarConfirmar(true)} className="w-full sm:w-fit">
                    Guardar cambios
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {ficha && (
        <MoverPersonaRedDialog
          open={mostrarMoverRed}
          onOpenChange={setMostrarMoverRed}
          iglesiaId={ficha.persona.iglesia_id}
          personaNombre={ficha.persona.nombre_completo}
          redOrigenId={ficha.casa_de_paz?.red_id ?? null}
          cargosOrigen={cargosOrigen}
          procesando={moverRed.isPending}
          onMover={manejarMover}
        />
      )}

      <Dialog open={mostrarConfirmar} onOpenChange={(o) => !guardando && setMostrarConfirmar(o)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Guardar cambios</DialogTitle>
            <DialogDescription>¿Estás seguro de que querés guardar estos cambios?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMostrarConfirmar(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void confirmarGuardar()} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
