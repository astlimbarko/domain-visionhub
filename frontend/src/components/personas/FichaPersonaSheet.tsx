import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { EyeOff, IdCard, Mail, Maximize2, Phone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/store/auth.store';
import { useMoverPersonaRed, usePersonaFicha, useToggleOculto } from '@/hooks/usePersonas';
import { FichaPersonaExtendida } from './FichaPersonaExtendida';
import { FichaPersonaEditorSheet } from './FichaPersonaEditorSheet';
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

function FilaDato({ icon: Icon, label, valor }: { icon: LucideIcon; label: string; valor: string | null }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="truncate font-medium text-foreground">{valor ?? '—'}</span>
    </div>
  );
}

/**
 * KAN-227: orquestador de los 3 modos de la ficha de persona -- misma firma
 * de props que antes (personaId + onOpenChange) para no tocar los 3 call
 * sites (pages/Personas.tsx, pages/AfirmacionPersonas.tsx,
 * PersonasDeRedVista.tsx).
 *
 * - Resumido (acá mismo): sidebar liviana de solo lectura -- identidad,
 *   estado, contacto y cargos. Botón "Ver ficha completa" pasa a extendido.
 * - Extendido (FichaPersonaExtendida): overlay grande con TODOS los datos,
 *   solo lectura, con lápiz "Editar" y las acciones rápidas (Cambiar de
 *   Red, Ocultar) que antes vivían acá.
 * - Editor (FichaPersonaEditorSheet): el contenido editable de siempre,
 *   se abre desde el lápiz del extendido.
 */
export function FichaPersonaSheet({ personaId, onOpenChange }: Props) {
  const iglesias = useAuthStore((s) => s.iglesias);
  const { data: ficha, isLoading } = usePersonaFicha(personaId);
  const toggleOculto = useToggleOculto(personaId ?? '');
  const moverRed = useMoverPersonaRed(personaId ?? '');
  const [mostrarMoverRed, setMostrarMoverRed] = useState(false);
  const [extendidoAbierto, setExtendidoAbierto] = useState(false);
  const [editorAbierto, setEditorAbierto] = useState(false);

  // Al seleccionar una persona nueva (o reabrir), siempre arranca en modo
  // resumido -- si no, quedaba "pegado" en el modo de la persona anterior.
  useEffect(() => {
    setExtendidoAbierto(false);
    setEditorAbierto(false);
  }, [personaId]);

  const puedeEditar = ficha ? (iglesias.find((i) => i.id === ficha.persona.iglesia_id)?.es_operativo ?? false) : false;

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

  const telefonoPrincipal = ficha?.telefonos.find((t) => t.es_principal && t.activo)?.numero ?? null;

  return (
    <>
      <Sheet open={!!personaId && !extendidoAbierto} onOpenChange={(open) => !open && onOpenChange(false)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {isLoading || !ficha ? (
            <div className="flex flex-col gap-4 p-4">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <>
              <SheetHeader>
                <SheetTitle className="flex flex-wrap items-center gap-2 pr-8 text-lg">
                  {ficha.persona.nombre_completo}
                  {ficha.estado_actual && <Badge variant="outline">{ficha.estado_actual.sigla}</Badge>}
                  {ficha.persona.oculto && (
                    <Badge variant="outline" className="gap-1">
                      <EyeOff className="h-3 w-3" />
                      Oculta
                    </Badge>
                  )}
                </SheetTitle>
                <p className="text-sm text-muted-foreground">
                  {ficha.persona.edad !== null ? `${ficha.persona.edad} años` : 'Edad no registrada'}
                  {ficha.casa_de_paz && ` · ${ficha.casa_de_paz.etiqueta}${ficha.casa_de_paz.red_nombre ? ` (${ficha.casa_de_paz.red_nombre})` : ''}`}
                </p>
              </SheetHeader>

              <div className="flex flex-col gap-4 px-4 pb-6">
                <div className="flex flex-col gap-2.5 rounded-2xl border border-border/60 bg-muted/20 p-3.5">
                  <FilaDato icon={IdCard} label="CI" valor={ficha.persona.ci} />
                  <FilaDato icon={Phone} label="Teléfono" valor={telefonoPrincipal} />
                  <FilaDato icon={Mail} label="Correo" valor={ficha.persona.correo} />
                </div>

                {ficha.cargos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {ficha.cargos.map((c, i) => (
                      <Badge key={i} variant="secondary">
                        {c.cargo_nombre} — {c.entidad}
                      </Badge>
                    ))}
                  </div>
                )}

                <Button type="button" className="w-full gap-1.5" onClick={() => setExtendidoAbierto(true)}>
                  <Maximize2 className="h-4 w-4" />
                  Ver ficha completa
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {ficha && (
        <>
          <FichaPersonaExtendida
            ficha={ficha}
            puedeEditar={puedeEditar}
            open={extendidoAbierto}
            onOpenChange={(open) => {
              setExtendidoAbierto(open);
              if (!open) onOpenChange(false);
            }}
            onEditar={() => setEditorAbierto(true)}
            onToggleOculto={manejarToggleOculto}
            ocultando={toggleOculto.isPending}
            onCambiarRed={ficha.casa_de_paz ? () => setMostrarMoverRed(true) : undefined}
          />

          <FichaPersonaEditorSheet ficha={ficha} puedeEditar={puedeEditar} open={editorAbierto} onOpenChange={setEditorAbierto} />

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
        </>
      )}
    </>
  );
}
