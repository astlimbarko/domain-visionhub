import { useState } from 'react';
import {
  Dialog,
  DialogContent,
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
  onCrear: (
    sufijo: string,
    ciudad: string,
    iglesiaPadreId: string,
    tipo: TipoIglesia,
    pastorUsuarioId: string | null,
    pastorCorreoNuevo: string | null,
    pin?: string
  ) => Promise<{ id: string; error?: string }>;
}

/**
 * Crear iglesia -- flujo integrado (15-gestion-administrativa, Panel 4).
 * Toda iglesia nueva es hija o satélite de una iglesia madre existente (no
 * existe "independiente" -- las 2 raíces actuales son una excepción
 * histórica). El Pastor se puede asignar en el mismo paso, con un solo
 * código de confirmación total: si ya tiene cuenta, o si se invita por
 * correo (cuenta nueva), la Edge Function `crear-iglesia` hace las 3
 * escrituras en una sola llamada verificando el código una única vez.
 */
export function CrearIglesiaDialog({
  open,
  onOpenChange,
  iglesias,
  creando,
  onCrear,
}: Props) {
  const esSuperAdmin = useAuthStore((s) => s.esSuperAdmin);

  const [iglesiaPadreId, setIglesiaPadreId] = useState('');
  const [tipo, setTipo] = useState<TipoIglesia>('HIJA');
  const [sufijo, setSufijo] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [pin, setPin] = useState('');

  const [modoPastor, setModoPastor] = useState<ModoPastor>('ninguno');
  const [busquedaPastor, setBusquedaPastor] = useState('');
  const [pastorElegido, setPastorElegido] = useState<CuentaBusqueda | null>(null);
  const [correoPastor, setCorreoPastor] = useState('');

  const pinValido = !esSuperAdmin || /^[0-9]{6}$/.test(pin);

  // Alta de doble vía (REQ-C-1): busca entre TODAS las cuentas existentes.
  const { data: resultadosBusqueda = [] } = useBuscarCuentas(modoPastor === 'buscar' ? busquedaPastor : '');

  const puedeCrear =
    sufijo.trim() &&
    ciudad.trim() &&
    iglesiaPadreId &&
    (modoPastor !== 'buscar' || !!pastorElegido) &&
    (modoPastor !== 'invitar' || correoPastor.trim().includes('@')) &&
    pinValido;

  // Si hay algo cargado, un clic afuera (o Escape) no debe tirar todo --
  // sobre todo el código OTP ya pedido (bug reportado 2026-07-31).
  const hayContenido =
    sufijo.trim() !== '' ||
    ciudad.trim() !== '' ||
    iglesiaPadreId !== '' ||
    pin.trim() !== '' ||
    busquedaPastor.trim() !== '' ||
    !!pastorElegido ||
    correoPastor.trim() !== '';

  function limpiarTodo() {
    setIglesiaPadreId('');
    setTipo('HIJA');
    setSufijo('');
    setCiudad('');
    setPin('');
    setModoPastor('ninguno');
    setBusquedaPastor('');
    setPastorElegido(null);
    setCorreoPastor('');
  }

  function handleCerrar(abierto: boolean) {
    if (!abierto) limpiarTodo();
    onOpenChange(abierto);
  }

  async function handleCrear() {
    if (!puedeCrear) return;
    try {
      await onCrear(
        sufijo.trim(),
        ciudad.trim(),
        iglesiaPadreId,
        tipo,
        modoPastor === 'buscar' && pastorElegido ? pastorElegido.usuario_id : null,
        modoPastor === 'invitar' ? correoPastor.trim().toLowerCase() : null,
        esSuperAdmin ? pin : undefined
      );
      handleCerrar(false);
    } catch {
      // El error ya se mostró al usuario (toast) en el llamador; el
      // diálogo simplemente queda abierto para reintentar.
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleCerrar}>
      <DialogContent
        className="max-w-sm"
        onInteractOutside={(e) => { if (hayContenido) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (hayContenido) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>Nueva Iglesia</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
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
