import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CampoOtp } from '@/components/shared/CampoOtp';
import { SelectorCiudad } from '@/components/admin/SelectorCiudad';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { useBuscarCuentas } from '@/hooks/useAdmin';
import type { CuentaBusqueda, IglesiaAdmin } from '@/types/admin.types';

type TipoIglesia = 'HIJA' | 'SATELITE';
type ModoPastor = 'ninguno' | 'buscar' | 'invitar';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  iglesias: IglesiaAdmin[];
  creando: boolean;
  invitandoPastor: boolean;
  onCrear: (
    sufijo: string,
    ciudad: string,
    iglesiaPadreId: string | null,
    tipo: TipoIglesia,
    pastorUsuarioId: string | null,
    pin?: string
  ) => Promise<{ id: string }>;
  onInvitarPastor: (correo: string, iglesiaId: string, pin?: string) => Promise<void>;
}

/**
 * Crear iglesia -- flujo integrado (15-gestion-administrativa, Panel 4
 * adelantado): además del alta independiente de siempre, permite crearla
 * como hija/satélite de una iglesia madre existente, y asignarle el Pastor
 * en el mismo paso. Si el Pastor se busca entre cuentas existentes, es una
 * sola llamada con un solo código; si se invita por correo (cuenta nueva),
 * el código ya se gastó creando la iglesia -- se pide un segundo código
 * para ese paso, encadenado dentro del mismo diálogo ("paso 2 de 2").
 */
export function CrearIglesiaDialog({
  open,
  onOpenChange,
  iglesias,
  creando,
  invitandoPastor,
  onCrear,
  onInvitarPastor,
}: Props) {
  const esSuperAdmin = useAuthStore((s) => s.esSuperAdmin);

  const [dependeDeOtra, setDependeDeOtra] = useState(false);
  const [iglesiaPadreId, setIglesiaPadreId] = useState('');
  const [tipo, setTipo] = useState<TipoIglesia>('HIJA');
  const [sufijo, setSufijo] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [pin, setPin] = useState('');

  const [modoPastor, setModoPastor] = useState<ModoPastor>('ninguno');
  const [busquedaPastor, setBusquedaPastor] = useState('');
  const [pastorElegido, setPastorElegido] = useState<CuentaBusqueda | null>(null);
  const [correoPastor, setCorreoPastor] = useState('');

  // Paso 2: la iglesia ya se creó, falta invitar al Pastor por correo.
  const [iglesiaCreada, setIglesiaCreada] = useState<{ id: string; nombre: string } | null>(null);
  const [pin2, setPin2] = useState('');

  const pinValido = !esSuperAdmin || /^[0-9]{6}$/.test(pin);
  const pin2Valido = !esSuperAdmin || /^[0-9]{6}$/.test(pin2);

  // Alta de doble vía (REQ-C-1): busca entre TODAS las cuentas existentes.
  const { data: resultadosBusqueda = [] } = useBuscarCuentas(modoPastor === 'buscar' ? busquedaPastor : '');

  const puedeCrear =
    sufijo.trim() &&
    ciudad.trim() &&
    (!dependeDeOtra || !!iglesiaPadreId) &&
    (modoPastor !== 'buscar' || !!pastorElegido) &&
    (modoPastor !== 'invitar' || correoPastor.trim().includes('@')) &&
    pinValido;

  function limpiarTodo() {
    setDependeDeOtra(false);
    setIglesiaPadreId('');
    setTipo('HIJA');
    setSufijo('');
    setCiudad('');
    setPin('');
    setModoPastor('ninguno');
    setBusquedaPastor('');
    setPastorElegido(null);
    setCorreoPastor('');
    setIglesiaCreada(null);
    setPin2('');
  }

  function handleCerrar(abierto: boolean) {
    if (!abierto) limpiarTodo();
    onOpenChange(abierto);
  }

  async function handleCrear() {
    if (!puedeCrear) return;
    try {
      const resultado = await onCrear(
        sufijo.trim(),
        ciudad.trim(),
        dependeDeOtra ? iglesiaPadreId : null,
        tipo,
        modoPastor === 'buscar' && pastorElegido ? pastorElegido.usuario_id : null,
        esSuperAdmin ? pin : undefined
      );
      if (modoPastor === 'invitar') {
        // La iglesia ya existe -- queda pendiente invitar al Pastor con un
        // segundo código (el primero ya se usó para crear la iglesia).
        setIglesiaCreada({ id: resultado.id, nombre: `Centro de Vida ${sufijo.trim()}` });
      } else {
        handleCerrar(false);
      }
    } catch {
      // El error ya se mostró al usuario (toast) en el llamador; el
      // diálogo simplemente queda abierto para reintentar.
    }
  }

  async function handleInvitarPastor() {
    if (!iglesiaCreada || !correoPastor.trim().includes('@') || !pin2Valido) return;
    try {
      await onInvitarPastor(correoPastor.trim().toLowerCase(), iglesiaCreada.id, esSuperAdmin ? pin2 : undefined);
      handleCerrar(false);
    } catch {
      // Idem: el toast ya se mostró; se queda en el paso 2 para reintentar.
    }
  }

  if (iglesiaCreada) {
    return (
      <Dialog open={open} onOpenChange={handleCerrar}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Invitar al Pastor</DialogTitle>
            <DialogDescription>
              {iglesiaCreada.nombre} ya se creó. Paso 2 de 2: invitación del Pastor por correo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="correo_pastor_confirmado">Correo del Pastor</Label>
              <Input id="correo_pastor_confirmado" type="email" value={correoPastor} disabled />
            </div>
            {esSuperAdmin && <CampoOtp value={pin2} onChange={setPin2} />}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="ghost" onClick={() => handleCerrar(false)}>
              Omitir por ahora
            </Button>
            <Button type="button" onClick={handleInvitarPastor} disabled={invitandoPastor || !pin2Valido}>
              {invitandoPastor ? 'Invitando...' : 'Invitar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleCerrar}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nueva Iglesia</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1">
          <div className="flex gap-1 rounded-xl bg-muted p-1">
            <button
              type="button"
              onClick={() => setDependeDeOtra(false)}
              className={cn(
                'flex-1 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
                !dependeDeOtra ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              )}
            >
              Independiente
            </button>
            <button
              type="button"
              onClick={() => setDependeDeOtra(true)}
              className={cn(
                'flex-1 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
                dependeDeOtra ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              )}
            >
              Hija / satélite
            </button>
          </div>

          {dependeDeOtra && (
            <>
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
              <div className="flex flex-col gap-1.5">
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as TipoIglesia)}>
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
            </>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sufijo">Nombre</Label>
            <Input id="sufijo" value={sufijo} onChange={(e) => setSufijo(e.target.value)} placeholder="Ej. Santa Cruz" />
            <p className="text-xs text-muted-foreground">Va a quedar como "Centro de Vida {sufijo || '...'}"</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ciudad">Ciudad</Label>
            <SelectorCiudad value={ciudad} onChange={setCiudad} />
          </div>

          <div className="flex flex-col gap-1.5 border-t border-border pt-3">
            <Label>Pastor de esta iglesia (opcional)</Label>
            <div className="flex gap-1 rounded-xl bg-muted p-1">
              {(['ninguno', 'buscar', 'invitar'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setModoPastor(m); setPastorElegido(null); setBusquedaPastor(''); setCorreoPastor(''); }}
                  className={cn(
                    'flex-1 rounded-lg px-2 py-1.5 text-[12px] font-medium transition-colors',
                    modoPastor === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                  )}
                >
                  {m === 'ninguno' ? 'Después' : m === 'buscar' ? 'Buscar' : 'Invitar'}
                </button>
              ))}
            </div>

            {modoPastor === 'buscar' &&
              (pastorElegido ? (
                <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
                  <span className="truncate text-sm">{pastorElegido.correo}</span>
                  <button type="button" onClick={() => setPastorElegido(null)} className="text-xs text-muted-foreground hover:text-foreground">
                    Cambiar
                  </button>
                </div>
              ) : (
                <>
                  <Input
                    value={busquedaPastor}
                    onChange={(e) => setBusquedaPastor(e.target.value)}
                    placeholder="Buscá por correo (cuenta ya existente)"
                  />
                  {busquedaPastor.trim().length >= 2 && (
                    <div className="flex flex-col gap-1 rounded-xl border border-border p-1">
                      {resultadosBusqueda.length === 0 ? (
                        <p className="px-2 py-1.5 text-xs text-muted-foreground">Nadie con cuenta coincide.</p>
                      ) : (
                        resultadosBusqueda.map((u) => (
                          <button
                            key={u.usuario_id}
                            type="button"
                            onClick={() => setPastorElegido(u)}
                            className="rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
                          >
                            {u.correo}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              ))}

            {modoPastor === 'invitar' && (
              <Input type="email" value={correoPastor} onChange={(e) => setCorreoPastor(e.target.value)} placeholder="pastor@correo.com" />
            )}
            {modoPastor === 'invitar' && (
              <p className="text-xs text-muted-foreground">
                Como es una cuenta nueva, después de crear la iglesia se pide un segundo código para invitarlo.
              </p>
            )}
          </div>

          {esSuperAdmin && <CampoOtp value={pin} onChange={setPin} />}
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleCrear} disabled={creando || !puedeCrear}>
            {creando ? 'Creando...' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
