import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, ArrowRightLeft, Eye, EyeOff, Pencil, TriangleAlert, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { useMisRoles } from '@/hooks/useDashboard';
import { useEsLiderAfirmacion } from '@/hooks/useEsLiderAfirmacion';
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

/** Rojo fuerte a propósito (pedido explícito del owner, KAN-403 seguimiento
 * 2026-09-18) para "Editar"/"Guardar cambios" -- refuerza que tocar estos
 * datos es una acción que pesa, no un botón más. Nota: esto se aparta a
 * propósito de la convención general del proyecto ("destructive es solo
 * para errores reales", ver frontend-style skill) -- acá se usa el mismo
 * tono para señalizar "cuidado, estás por cambiar datos reales de una
 * persona", pedido puntual del owner para esta pantalla, no un cambio de
 * la convención global. */
const BOTON_ROJO_FUERTE =
  'border-transparent bg-destructive text-white shadow-sm shadow-destructive/20 hover:bg-destructive/90 hover:shadow-md hover:shadow-destructive/25';

/** KAN-403 seguimiento 2026-09-18 (pedido explícito del owner: "que entre
 * todo en la misma pantalla, con paginado y un botón Siguiente, guardar
 * solo al final con un botón Actualizar grande centrado"). 9 páginas --
 * Identidad y censo se separa en 2 porque sus 15 campos no entran en una
 * pantalla de celular sin scroll ni agrupando de a 2. */
const TITULOS_PAGINA = [
  'Evangelismo y cargos',
  'Identidad y censo — Datos personales',
  'Identidad y censo — Censo eclesiástico',
  'Direcciones',
  'Teléfonos',
  'Llegada a la iglesia',
  'Familia',
  'Ministerios',
  'Milagros',
] as const;
const TOTAL_PAGINAS = TITULOS_PAGINA.length;

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
  const [mostrarAdvertenciaEditar, setMostrarAdvertenciaEditar] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [pagina, setPagina] = useState(0);
  const identidadRef = useRef<FichaIdentidadHandle>(null);

  // Al seleccionar una persona nueva (o reabrir), siempre arranca en modo
  // lectura y en la página 1 -- si no, quedaba "pegado" en el modo/página
  // de la persona anterior.
  useEffect(() => {
    setModoEdicion(false);
    setPagina(0);
  }, [personaId]);

  const esPrimeraPagina = pagina === 0;
  const esUltimaPagina = pagina === TOTAL_PAGINAS - 1;

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
  // KAN-408 (2026-09-21): "Mi cuenta" reusa esta misma ficha para que
  // CUALQUIER usuario (no solo operativos/líderes) pueda editar su PROPIA
  // persona -- sin esto, un miembro sin cargo que abriera su propia ficha
  // veía todo de solo lectura, sin poder tocar nada.
  const miPersonaId = useAuthStore((s) => s.personaId);
  const esUnoMismo = !!ficha && ficha.persona.id === miPersonaId;
  const puedeEditar = esOperativo || esLiderDeSuRed || esUnoMismo;
  // KAN-408 (pedido explícito del owner): nombre completo, sexo y fecha de
  // nacimiento son un permiso MÁS ANGOSTO que el resto -- ni esUnoMismo ni
  // esLiderDeSuRed alcanzan para tocarlos, solo operativos (Pastor/
  // Supervisor) o Líder de Afirmación.
  const esLiderAfirmacion = useEsLiderAfirmacion();
  const puedeEditarIdentidadBasica = esOperativo || esLiderAfirmacion;
  const editando = puedeEditar && modoEdicion;
  // Igual criterio que `editando`, pero para el permiso más angosto de
  // arriba -- se usa en la sección Identidad/censo (KAN-403 la unificó en
  // una sola FichaIdentidad paginada, ver más abajo).
  const editandoIdentidadBasica = puedeEditarIdentidadBasica && modoEdicion;

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
                    <Button type="button" size="sm" className={cn('gap-1.5', BOTON_ROJO_FUERTE)} onClick={() => setMostrarAdvertenciaEditar(true)}>
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

              {/* KAN-403 seguimiento 2026-09-18: paginado en vez de todo con
                  scroll (pedido explícito del owner) -- las 9 páginas están
                  TODAS montadas siempre (solo se ocultan con `hidden`), no
                  se desmontan al navegar, para no perder lo que la persona
                  ya tipeó en otra página al ir y volver. Cada Ficha* sigue
                  usando `key={modoEdicion}` para descartar cambios sin
                  guardar al tocar "Cancelar edición" -- eso no cambia. */}
              <div className="flex flex-1 flex-col overflow-y-auto pr-1">
                <p className="mb-3 shrink-0 text-xs font-medium text-muted-foreground">
                  Página {pagina + 1} de {TOTAL_PAGINAS} — {TITULOS_PAGINA[pagina]}
                </p>

                <div className={cn('flex flex-col gap-4', pagina !== 0 && 'hidden')}>
                  {ficha.evangelismo ? (
                    <Card className="rounded-2xl shrink-0">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Evangelismo</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <FichaEvangelismo evangelismo={ficha.evangelismo} />
                      </CardContent>
                    </Card>
                  ) : null}
                  {ficha.cargos.length > 0 ? (
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
                  ) : null}
                  {!ficha.evangelismo && ficha.cargos.length === 0 && (
                    <p className="text-sm text-muted-foreground">Sin datos de evangelismo ni cargos vigentes.</p>
                  )}
                </div>

                {/* Una sola instancia/estado de FichaIdentidad para las 2
                    páginas (Datos personales + Censo eclesiástico) -- si se
                    montara 2 veces (una por página) cada una tendría su
                    propio form interno por separado, y guardar() desde el
                    ref solo vería la mitad de lo tipeado. Se muestra en
                    ambas páginas, cambiando qué mitad de sus propios campos
                    renderiza según el número de página actual. */}
                <div className={cn(pagina !== 1 && pagina !== 2 && 'hidden')}>
                  <Card className="rounded-2xl shrink-0">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">
                        Identidad y censo — {pagina === 2 ? 'Censo eclesiástico' : 'Datos personales'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FichaIdentidad
                        key={modoEdicion ? 'edit' : 'view'}
                        ref={identidadRef}
                        personaId={ficha.persona.id}
                        ficha={ficha}
                        puedeEditar={editando}
                        puedeEditarIdentidadBasica={editandoIdentidadBasica}
                        pagina={pagina === 2 ? 2 : 1}
                      />
                    </CardContent>
                  </Card>
                </div>

                <div className={cn(pagina !== 3 && 'hidden')}>
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
                </div>

                <div className={cn(pagina !== 4 && 'hidden')}>
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
                </div>

                <div className={cn(pagina !== 5 && 'hidden')}>
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
                </div>

                <div className={cn(pagina !== 6 && 'hidden')}>
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
                </div>

                <div className={cn(pagina !== 7 && 'hidden')}>
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
                </div>

                <div className={cn(pagina !== 8 && 'hidden')}>
                  <Card className="rounded-2xl shrink-0">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Milagros</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FichaMilagros
                        key={modoEdicion ? 'edit' : 'view'}
                        personaId={ficha.persona.id}
                        milagros={ficha.milagros ?? []}
                        puedeEditar={editando}
                      />
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Última página + editando: "Actualizar" grande y centrado
                  (pedido explícito del owner) en vez del footer normal de
                  Atrás/Siguiente -- "Atrás" queda disponible más chico
                  debajo por si se quiere revisar algo antes de guardar. */}
              {esUltimaPagina && editando ? (
                <div className="sticky bottom-0 -mx-0 flex flex-col items-center gap-2 border-t border-border bg-background/95 px-4 py-4 backdrop-blur supports-backdrop-filter:bg-background/80">
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => setMostrarConfirmar(true)}
                    className={cn('w-full max-w-xs text-base', BOTON_ROJO_FUERTE)}
                  >
                    Actualizar
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={() => setPagina((p) => p - 1)}>
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Atrás
                  </Button>
                </div>
              ) : (
                <div className="sticky bottom-0 -mx-0 flex items-center justify-between border-t border-border bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={esPrimeraPagina}
                    onClick={() => setPagina((p) => p - 1)}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Atrás
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5"
                    disabled={esUltimaPagina}
                    onClick={() => setPagina((p) => p + 1)}
                  >
                    Siguiente
                    <ArrowRight className="h-3.5 w-3.5" />
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
            <DialogTitle>Actualizar datos</DialogTitle>
            <DialogDescription>¿Estás seguro de que querés actualizar estos datos?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMostrarConfirmar(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button type="button" className={BOTON_ROJO_FUERTE} onClick={() => void confirmarGuardar()} disabled={guardando}>
              {guardando ? 'Actualizando...' : 'Actualizar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mostrarAdvertenciaEditar} onOpenChange={setMostrarAdvertenciaEditar}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <TriangleAlert className="h-5 w-5" />
              Vas a editar datos reales
            </DialogTitle>
            <DialogDescription>
              Estás por modificar la información de <strong>{ficha?.persona.nombre_completo}</strong>. Sos responsable de que
              los datos que cambies sean correctos -- una vez guardados, reemplazan a los actuales.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMostrarAdvertenciaEditar(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className={BOTON_ROJO_FUERTE}
              onClick={() => {
                setModoEdicion(true);
                setMostrarAdvertenciaEditar(false);
              }}
            >
              Entiendo, editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
