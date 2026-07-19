import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/store/auth.store';
import { usePersonaFicha, useToggleOculto } from '@/hooks/usePersonas';
import { FichaIdentidad } from './FichaIdentidad';
import { FichaDirecciones } from './FichaDirecciones';
import { FichaTelefonos } from './FichaTelefonos';
import { FichaLlegada } from './FichaLlegada';
import { FichaFamilia } from './FichaFamilia';

interface Props {
  personaId: string | undefined;
  onOpenChange: (open: boolean) => void;
}

export function FichaPersonaSheet({ personaId, onOpenChange }: Props) {
  const iglesias = useAuthStore((s) => s.iglesias);
  const { data: ficha, isLoading } = usePersonaFicha(personaId);
  const toggleOculto = useToggleOculto(personaId ?? '');

  const puedeEditar = ficha ? (iglesias.find((i) => i.id === ficha.persona.iglesia_id)?.es_operativo ?? false) : false;

  return (
    <Sheet open={!!personaId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        {isLoading || !ficha ? (
          <div className="flex flex-col gap-4 p-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
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
              {puedeEditar && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit gap-1.5"
                  disabled={toggleOculto.isPending}
                  onClick={() =>
                    toggleOculto.mutate(!ficha.persona.oculto, {
                      onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo cambiar la visibilidad'),
                    })
                  }
                >
                  {ficha.persona.oculto ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  {ficha.persona.oculto ? 'Quitar de ocultas' : 'Ocultar de búsquedas normales'}
                </Button>
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
                  <FichaIdentidad personaId={ficha.persona.id} ficha={ficha} puedeEditar={puedeEditar} />
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
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
