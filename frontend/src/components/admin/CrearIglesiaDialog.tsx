import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmarCambioDialog } from '@/components/shared/ConfirmarCambioDialog';
import { SelectorCiudad } from '@/components/admin/SelectorCiudad';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import type { IglesiaAdmin } from '@/types/admin.types';

type TipoIglesia = 'HIJA' | 'SATELITE';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  iglesias: IglesiaAdmin[];
  creando: boolean;
  /** Tema oscuro del diálogo (hoy solo lo usa el panel de Super Admin). */
  oscuro?: boolean;
  onCrear: (
    sufijo: string,
    ciudad: string,
    iglesiaPadreId: string | null,
    tipo: TipoIglesia,
    pastorUsuarioId: string | null,
    pastorCorreoNuevo: string | null,
    pin?: string
  ) => Promise<{ id: string; error?: string }>;
  /** KAN-155: la iglesia se crea sola; esto abre el paso de asignar Pastor
   * (reusa InvitarUsuarioDialog desde Administracion.tsx, con su propia
   * confirmación de 6 dígitos) recién si el usuario elige hacerlo ahora. */
  onIglesiaCreada?: (iglesiaId: string, nombre: string) => void;
}

/**
 * Crear iglesia -- flujo integrado (15-gestion-administrativa, Panel 4).
 * Por defecto toda iglesia nueva es hija o satélite de una iglesia madre
 * existente; el check "Iglesia raíz" (KAN-152/KAN-155, pedido 2026-08-10,
 * marcado por defecto) permite crear una nueva iglesia autónoma sin madre --
 * `fn_crear_iglesia` ya acepta `p_iglesia_padre_id = NULL`.
 *
 * KAN-155: la confirmación con código de 6 dígitos ya NO va inline en este
 * formulario -- se pide en un segundo paso (`ConfirmarCambioDialog`, el
 * mismo patrón "enviar código, luego confirmar" que ya usan Remover/
 * Eliminar/Suspender en este panel) recién al confirmar la creación. La
 * asignación de Pastor pasa a ser un paso posterior y opcional, no parte de
 * este formulario -- ver `onIglesiaCreada`.
 */
export function CrearIglesiaDialog({
  open,
  onOpenChange,
  iglesias,
  creando,
  oscuro,
  onCrear,
  onIglesiaCreada,
}: Props) {
  const esSuperAdmin = useAuthStore((s) => s.esSuperAdmin);

  const [esRaiz, setEsRaiz] = useState(true);
  const [iglesiaPadreId, setIglesiaPadreId] = useState('');
  const [tipo, setTipo] = useState<TipoIglesia>('HIJA');
  const [sufijo, setSufijo] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [pasoConfirmar, setPasoConfirmar] = useState(false);
  const [iglesiaCreada, setIglesiaCreada] = useState<{ id: string; nombre: string } | null>(null);

  const puedeCrear = !!(sufijo.trim() && ciudad.trim() && (esRaiz || iglesiaPadreId));

  // Si hay algo cargado, un clic afuera (o Escape) no debe tirar todo.
  const hayContenido = sufijo.trim() !== '' || ciudad.trim() !== '' || iglesiaPadreId !== '';

  function limpiarTodo() {
    setEsRaiz(true);
    setIglesiaPadreId('');
    setTipo('HIJA');
    setSufijo('');
    setCiudad('');
    setPasoConfirmar(false);
    setIglesiaCreada(null);
  }

  function handleCerrar(abierto: boolean) {
    if (!abierto) limpiarTodo();
    onOpenChange(abierto);
  }

  function handleClickCrear() {
    if (!puedeCrear) return;
    setPasoConfirmar(true);
  }

  async function confirmarCreacion(_motivo: string, pin?: string) {
    try {
      const resultado = await onCrear(
        sufijo.trim(),
        ciudad.trim(),
        esRaiz ? null : iglesiaPadreId,
        tipo,
        null,
        null,
        esSuperAdmin ? pin : undefined
      );
      setPasoConfirmar(false);
      setIglesiaCreada({ id: resultado.id, nombre: `Centro de Vida ${sufijo.trim()}` });
    } catch {
      // El error ya se mostró (toast) en el llamador; el modal de
      // confirmación queda abierto para reintentar.
    }
  }

  return (
    <>
      <Dialog open={open && !iglesiaCreada} onOpenChange={handleCerrar}>
        <DialogContent
          className={cn('max-w-sm', oscuro && 'dark')}
          onInteractOutside={(e) => { if (hayContenido) e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (hayContenido) e.preventDefault(); }}
        >
          <DialogHeader>
            <DialogTitle>Nueva Iglesia</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="es-raiz"
                checked={esRaiz}
                onCheckedChange={(checked) => { setEsRaiz(checked === true); if (checked) setIglesiaPadreId(''); }}
              />
              <Label htmlFor="es-raiz" className="cursor-pointer font-normal">
                Iglesia raíz (sin iglesia madre, autónoma)
              </Label>
            </div>
            {!esRaiz && (
              <div className="flex flex-col gap-1.5">
                <Label>Iglesia madre</Label>
                <Select value={iglesiaPadreId} onValueChange={setIglesiaPadreId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Elegí la iglesia madre" />
                  </SelectTrigger>
                  <SelectContent>
                    {iglesias.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoIglesia)} disabled={esRaiz}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HIJA">Iglesia hija</SelectItem>
                  <SelectItem value="SATELITE">Iglesia satélite</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Hoy se comportan igual; la diferencia es conceptual.</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sufijo">Nombre</Label>
              <Input id="sufijo" value={sufijo} onChange={(e) => setSufijo(e.target.value)} placeholder="Ej. Santa Cruz" />
              <p className="text-xs text-muted-foreground">Va a quedar como "Centro de Vida {sufijo || '...'}"</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ciudad">Ciudad</Label>
              <SelectorCiudad value={ciudad} onChange={setCiudad} />
            </div>
            <p className="text-xs text-muted-foreground">
              Al Pastor se lo asigna en un paso aparte, después de crear la iglesia.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleClickCrear} disabled={creando || !puedeCrear}>
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmarCambioDialog
        open={pasoConfirmar}
        onOpenChange={setPasoConfirmar}
        titulo="Confirmar creación de iglesia"
        descripcion={`Se va a crear "Centro de Vida ${sufijo.trim()}".`}
        requiereMotivo={false}
        oscuro={oscuro}
        procesando={creando}
        onConfirmar={confirmarCreacion}
      />

      <Dialog open={!!iglesiaCreada} onOpenChange={(abierto) => { if (!abierto) handleCerrar(false); }}>
        <DialogContent className={cn('max-w-sm', oscuro && 'dark')}>
          <DialogHeader>
            <DialogTitle>Iglesia creada</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {iglesiaCreada?.nombre} ya está lista. ¿Querés asignarle un Pastor ahora?
          </p>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" onClick={() => handleCerrar(false)}>
              Ahora no
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (iglesiaCreada) onIglesiaCreada?.(iglesiaCreada.id, iglesiaCreada.nombre);
                handleCerrar(false);
              }}
            >
              Asignar Pastor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
