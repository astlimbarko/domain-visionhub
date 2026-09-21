// VisionHub -- KAN-408 (2026-09-21, pedido explícito del owner): el dueño
// de la cuenta ve/edita SU PROPIA membresía como página completa, no como
// modal/Sheet superpuesto -- por eso este archivo existe separado de
// FichaPersonaSheet.tsx (que sí es modal, usado por operativos/líderes
// para ver la ficha de OTRAS personas). Reusa los mismos componentes
// Ficha* que ya arma la ficha de Afirmación/CdP/Supervisión (KAN-227) para
// no duplicar UI ni lógica de guardado -- solo cambia el contenedor.
//
// Nombre completo, sexo y fecha de nacimiento quedan SIEMPRE bloqueados acá
// (puedeEditarIdentidadBasica={false} fijo, sin importar el rol de quien
// entra) -- esos 3 campos solo se tocan desde la herramienta de edición de
// siempre (Afirmación/CdP/Supervisión), y solo por Pastor/Supervisor o
// Líder de Afirmación. Ver el mismo prop en FichaIdentidad.tsx.
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, IdCard, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { MORADO } from '@/components/dashboard/DashboardUI';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { usePersonaFicha } from '@/hooks/usePersonas';
import { FichaIdentidad, type FichaIdentidadHandle } from '@/components/personas/FichaIdentidad';
import { FichaDirecciones } from '@/components/personas/FichaDirecciones';
import { FichaTelefonos } from '@/components/personas/FichaTelefonos';
import { FichaLlegada } from '@/components/personas/FichaLlegada';
import { FichaFamilia } from '@/components/personas/FichaFamilia';
import { FichaEvangelismo } from '@/components/personas/FichaEvangelismo';
import { FichaMinisterios } from '@/components/personas/FichaMinisterios';
import { FichaMilagros } from '@/components/personas/FichaMilagros';
import { ROUTES } from '@/utils/constants';

// Botón rojo fuerte (mismo criterio puntual que KAN-403, ver comentario
// original en FichaPersonaSheet.tsx de esa rama): pedido explícito del
// owner para que "Editar"/"Actualizar" se sientan como una acción que
// modifica datos reales, aunque rompa la convención general del proyecto
// de reservar --destructive para errores.
const BOTON_ROJO_FUERTE =
  'border-transparent bg-destructive text-white shadow-sm shadow-destructive/20 hover:bg-destructive/90 hover:shadow-md hover:shadow-destructive/25';

export function MiMembresia() {
  const personaId = useAuthStore((s) => s.personaId);
  const { data: ficha, isLoading } = usePersonaFicha(personaId ?? undefined);
  const [editando, setEditando] = useState(false);
  const [mostrarAdvertencia, setMostrarAdvertencia] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const identidadRef = useRef<FichaIdentidadHandle>(null);

  async function confirmarGuardar() {
    setGuardando(true);
    try {
      await identidadRef.current?.guardar();
      setEditando(false);
    } finally {
      setGuardando(false);
      setMostrarConfirmar(false);
    }
  }

  if (isLoading || !ficha) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link to={ROUTES.CUENTA} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Volver a Mi cuenta
        </Link>
        {!editando && (
          <Button
            type="button"
            size="sm"
            className={cn('gap-1.5', BOTON_ROJO_FUERTE)}
            onClick={() => setMostrarAdvertencia(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar membresía
          </Button>
        )}
      </div>

      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader
          icon={IdCard}
          color={MORADO}
          titulo="Membresía"
          descripcion={editando ? 'Editando tus datos -- nombre, sexo y fecha de nacimiento no se pueden cambiar acá' : 'Tus datos personales, censo y familia'}
        />
        <div className="flex flex-col gap-4 p-5">
          {ficha.cargos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {ficha.cargos.map((c, i) => (
                <Badge key={i} variant="secondary">
                  {c.cargo_nombre} — {c.entidad}
                </Badge>
              ))}
            </div>
          )}

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

          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Identidad y censo</CardTitle>
            </CardHeader>
            <CardContent>
              <FichaIdentidad
                ref={identidadRef}
                personaId={ficha.persona.id}
                ficha={ficha}
                puedeEditar={editando}
                puedeEditarIdentidadBasica={false}
              />
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Direcciones</CardTitle>
            </CardHeader>
            <CardContent>
              <FichaDirecciones personaId={ficha.persona.id} iglesiaId={ficha.persona.iglesia_id} direcciones={ficha.direcciones} puedeEditar={editando} />
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Teléfonos</CardTitle>
            </CardHeader>
            <CardContent>
              <FichaTelefonos personaId={ficha.persona.id} iglesiaId={ficha.persona.iglesia_id} telefonos={ficha.telefonos} puedeEditar={editando} />
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Llegada a la iglesia</CardTitle>
            </CardHeader>
            <CardContent>
              <FichaLlegada personaId={ficha.persona.id} iglesiaId={ficha.persona.iglesia_id} llegadas={ficha.llegadas} puedeEditar={editando} />
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Familia</CardTitle>
            </CardHeader>
            <CardContent>
              <FichaFamilia personaId={ficha.persona.id} iglesiaId={ficha.persona.iglesia_id} ficha={ficha} puedeEditar={editando} />
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Ministerios</CardTitle>
            </CardHeader>
            <CardContent>
              <FichaMinisterios personaId={ficha.persona.id} iglesiaId={ficha.persona.iglesia_id} ministerios={ficha.ministerios ?? []} puedeEditar={editando} />
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Milagros</CardTitle>
            </CardHeader>
            <CardContent>
              <FichaMilagros personaId={ficha.persona.id} milagros={ficha.milagros ?? []} puedeEditar={editando} />
            </CardContent>
          </Card>

          {editando && (
            <div className="flex flex-col items-center gap-2 border-t border-border pt-4">
              <Button type="button" size="lg" onClick={() => setMostrarConfirmar(true)} className={cn('w-full max-w-xs text-base', BOTON_ROJO_FUERTE)}>
                Actualizar
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditando(false)}>
                Cancelar
              </Button>
            </div>
          )}
        </div>
      </section>

      <Dialog open={mostrarAdvertencia} onOpenChange={setMostrarAdvertencia}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Vas a editar tus datos</DialogTitle>
            <DialogDescription>
              Sos responsable de que los datos que cambies sean correctos -- una vez guardados, reemplazan a los actuales.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMostrarAdvertencia(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className={BOTON_ROJO_FUERTE}
              onClick={() => {
                setMostrarAdvertencia(false);
                setEditando(true);
              }}
            >
              Entiendo, editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mostrarConfirmar} onOpenChange={(o) => !guardando && setMostrarConfirmar(o)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Actualizar datos</DialogTitle>
            <DialogDescription>¿Estás seguro de que querés guardar estos cambios?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMostrarConfirmar(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button type="button" className={BOTON_ROJO_FUERTE} onClick={() => void confirmarGuardar()} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Actualizar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
