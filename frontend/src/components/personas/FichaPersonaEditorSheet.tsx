import { useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { FichaIdentidad, type FichaIdentidadHandle } from './FichaIdentidad';
import { FichaDirecciones } from './FichaDirecciones';
import { FichaTelefonos } from './FichaTelefonos';
import { FichaLlegada } from './FichaLlegada';
import { FichaFamilia } from './FichaFamilia';
import { FichaEvangelismo } from './FichaEvangelismo';
import { FichaMinisterios } from './FichaMinisterios';
import { FichaMilagros } from './FichaMilagros';
import type { PersonaFicha } from '@/types/persona.types';

interface Props {
  ficha: PersonaFicha;
  puedeEditar: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * KAN-227: editor completo de la ficha (todas las secciones editables),
 * separado del modo extendido de solo lectura -- se abre con el lápiz
 * "Editar" desde ahí. El único botón "Guardar cambios" (el de Identidad y
 * censo, el resto de las secciones guardan cada acción al toque) vive en un
 * pie fijo abajo con confirmación, en vez de aparecer en medio de la hoja.
 */
export function FichaPersonaEditorSheet({ ficha, puedeEditar, open, onOpenChange }: Props) {
  const identidadRef = useRef<FichaIdentidadHandle>(null);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [guardando, setGuardando] = useState(false);

  async function confirmarGuardar() {
    setGuardando(true);
    try {
      await identidadRef.current?.guardar();
    } finally {
      setGuardando(false);
      setMostrarConfirmar(false);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle className="pr-8 text-lg">Editar a {ficha.persona.nombre_completo}</SheetTitle>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-4 px-4 pb-6">
            {ficha.evangelismo && (
              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Evangelismo</CardTitle>
                </CardHeader>
                <CardContent>
                  <FichaEvangelismo evangelismo={ficha.evangelismo} />
                </CardContent>
              </Card>
            )}

            {ficha.cargos.length > 0 && (
              <Card className="rounded-2xl">
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

            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Identidad y censo</CardTitle>
              </CardHeader>
              <CardContent>
                <FichaIdentidad ref={identidadRef} personaId={ficha.persona.id} ficha={ficha} puedeEditar={puedeEditar} />
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Direcciones</CardTitle>
              </CardHeader>
              <CardContent>
                <FichaDirecciones
                  personaId={ficha.persona.id}
                  iglesiaId={ficha.persona.iglesia_id}
                  direcciones={ficha.direcciones}
                  puedeEditar={puedeEditar}
                />
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Teléfonos</CardTitle>
              </CardHeader>
              <CardContent>
                <FichaTelefonos
                  personaId={ficha.persona.id}
                  iglesiaId={ficha.persona.iglesia_id}
                  telefonos={ficha.telefonos}
                  puedeEditar={puedeEditar}
                />
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Llegada a la iglesia</CardTitle>
              </CardHeader>
              <CardContent>
                <FichaLlegada
                  personaId={ficha.persona.id}
                  iglesiaId={ficha.persona.iglesia_id}
                  llegadas={ficha.llegadas}
                  puedeEditar={puedeEditar}
                />
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Familia</CardTitle>
              </CardHeader>
              <CardContent>
                <FichaFamilia personaId={ficha.persona.id} iglesiaId={ficha.persona.iglesia_id} ficha={ficha} puedeEditar={puedeEditar} />
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Ministerios</CardTitle>
              </CardHeader>
              <CardContent>
                <FichaMinisterios
                  personaId={ficha.persona.id}
                  iglesiaId={ficha.persona.iglesia_id}
                  ministerios={ficha.ministerios ?? []}
                  puedeEditar={puedeEditar}
                />
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Milagros</CardTitle>
              </CardHeader>
              <CardContent>
                <FichaMilagros personaId={ficha.persona.id} milagros={ficha.milagros ?? []} puedeEditar={puedeEditar} />
              </CardContent>
            </Card>
          </div>

          {puedeEditar && (
            <div className="sticky bottom-0 -mx-0 border-t border-border bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80">
              <Button type="button" onClick={() => setMostrarConfirmar(true)} className="w-full sm:w-fit">
                Guardar cambios
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

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
