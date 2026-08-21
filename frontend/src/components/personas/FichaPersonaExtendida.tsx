import { ArrowRightLeft, Eye, EyeOff, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FichaIdentidad } from './FichaIdentidad';
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
  onEditar: () => void;
  onToggleOculto: () => void;
  ocultando: boolean;
  onCambiarRed?: () => void;
}

/**
 * KAN-227: modo extendido -- overlay a pantalla casi completa con TODOS los
 * datos de la persona en una sola vista (pedido del owner: "en la misma
 * hoja"), de solo lectura. Reusa los mismos Ficha* del editor forzando
 * puedeEditar=false (ya soportan ese modo -- ocultan inputs/botones y
 * dejan listas limpias), así no hay que mantener un renderer de solo
 * lectura aparte. Para modificar algo hay que tocar el lápiz "Editar", que
 * abre FichaPersonaEditorSheet encima de este overlay.
 */
export function FichaPersonaExtendida({ ficha, puedeEditar, open, onOpenChange, onEditar, onToggleOculto, ocultando, onCambiarRed }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92dvh] flex-col sm:max-w-3xl">
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
            <Button type="button" size="sm" className="gap-1.5" onClick={onEditar}>
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Button>
            {ficha.casa_de_paz && onCambiarRed && (
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onCambiarRed}>
                <ArrowRightLeft className="h-3.5 w-3.5" />
                Cambiar de Red
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={ocultando} onClick={onToggleOculto}>
              {ficha.persona.oculto ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              {ficha.persona.oculto ? 'Quitar de ocultas' : 'Ocultar de búsquedas'}
            </Button>
          </div>
        )}

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
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
              <FichaIdentidad personaId={ficha.persona.id} ficha={ficha} puedeEditar={false} />
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Direcciones</CardTitle>
            </CardHeader>
            <CardContent>
              <FichaDirecciones personaId={ficha.persona.id} iglesiaId={ficha.persona.iglesia_id} direcciones={ficha.direcciones} puedeEditar={false} />
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Teléfonos</CardTitle>
            </CardHeader>
            <CardContent>
              <FichaTelefonos personaId={ficha.persona.id} iglesiaId={ficha.persona.iglesia_id} telefonos={ficha.telefonos} puedeEditar={false} />
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Llegada a la iglesia</CardTitle>
            </CardHeader>
            <CardContent>
              <FichaLlegada personaId={ficha.persona.id} iglesiaId={ficha.persona.iglesia_id} llegadas={ficha.llegadas} puedeEditar={false} />
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Familia</CardTitle>
            </CardHeader>
            <CardContent>
              <FichaFamilia personaId={ficha.persona.id} iglesiaId={ficha.persona.iglesia_id} ficha={ficha} puedeEditar={false} />
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
                puedeEditar={false}
              />
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Milagros</CardTitle>
            </CardHeader>
            <CardContent>
              <FichaMilagros personaId={ficha.persona.id} milagros={ficha.milagros ?? []} puedeEditar={false} />
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
