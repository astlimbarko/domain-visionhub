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
import { cn } from '@/lib/utils';
import { CampoOtp } from '@/components/shared/CampoOtp';
import { BuscadorPersona } from './BuscadorPersona';
import type { PersonaBusqueda } from '@/types/casas-de-paz.types';

type ModoLider = 'ninguno' | 'buscar' | 'invitar';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  iglesiaId: string | undefined;
  creando: boolean;
  onCrear: (
    nombre: string,
    liderPersonaId: string | null,
    liderCorreoNuevo: string | null,
    pin: string
  ) => Promise<{ id: string; error?: string }>;
}

/**
 * Crear Red -- menú "Gestión de Redes" del Supervisor (2026-08-01). "Es
 * para declarar que existe" (pedido del owner): solo el nombre hace falta;
 * el Líder de Red es opcional en el mismo paso (buscar PERSONA existente o
 * invitar por correo cuenta nueva, un solo código OTP para ambas
 * escrituras). Una Red sin Líder se muestra igual en la lista, con un
 * aviso de "Falta designar líder" -- eso lo pinta GestionRedes.tsx, no
 * este diálogo.
 *
 * Busca por PERSONA (BuscadorPersona), no por cuenta: red_cargo.persona_id
 * exige una Persona ya existente, igual que el resto de los cargos de Red
 * (mismo motivo que AsignarCargoDialog).
 */
export function CrearRedSupervisorDialog({ open, onOpenChange, iglesiaId, creando, onCrear }: Props) {
  const [nombre, setNombre] = useState('');
  const [pin, setPin] = useState('');
  const [modoLider, setModoLider] = useState<ModoLider>('ninguno');
  const [liderElegido, setLiderElegido] = useState<PersonaBusqueda | null>(null);
  const [correoLider, setCorreoLider] = useState('');

  const pinValido = /^[0-9]{6}$/.test(pin);

  const puedeCrear =
    nombre.trim() &&
    (modoLider !== 'buscar' || !!liderElegido) &&
    (modoLider !== 'invitar' || correoLider.trim().includes('@')) &&
    pinValido;

  const hayContenido =
    nombre.trim() !== '' || pin.trim() !== '' || !!liderElegido || correoLider.trim() !== '';

  function limpiarTodo() {
    setNombre('');
    setPin('');
    setModoLider('ninguno');
    setLiderElegido(null);
    setCorreoLider('');
  }

  function handleCerrar(abierto: boolean) {
    if (!abierto) limpiarTodo();
    onOpenChange(abierto);
  }

  async function handleCrear() {
    if (!puedeCrear) return;
    try {
      await onCrear(
        nombre.trim(),
        modoLider === 'buscar' && liderElegido ? liderElegido.id : null,
        modoLider === 'invitar' ? correoLider.trim().toLowerCase() : null,
        pin
      );
      handleCerrar(false);
    } catch {
      // El error ya se mostró (toast) en el llamador; el diálogo queda
      // abierto para reintentar.
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
          <DialogTitle>Nueva Red</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nombre_red">Nombre</Label>
            <Input id="nombre_red" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Red Norte" />
          </div>

          <div className="flex flex-col gap-1.5 border-t border-border pt-3">
            <Label>Líder de esta Red (opcional)</Label>
            <div className="flex gap-1 rounded-xl bg-muted p-1">
              {(['ninguno', 'buscar', 'invitar'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setModoLider(m); setLiderElegido(null); setCorreoLider(''); }}
                  className={cn(
                    'flex-1 rounded-lg px-2 py-1.5 text-[12px] font-medium transition-colors',
                    modoLider === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                  )}
                >
                  {m === 'ninguno' ? 'Después' : m === 'buscar' ? 'Buscar' : 'Invitar'}
                </button>
              ))}
            </div>

            {modoLider === 'buscar' &&
              (liderElegido ? (
                <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
                  <span className="truncate text-sm">{liderElegido.nombre_completo}</span>
                  <button type="button" onClick={() => setLiderElegido(null)} className="text-xs text-muted-foreground hover:text-foreground">
                    Cambiar
                  </button>
                </div>
              ) : (
                <BuscadorPersona iglesiaId={iglesiaId} onSeleccionar={setLiderElegido} />
              ))}

            {modoLider === 'invitar' && (
              <Input type="email" value={correoLider} onChange={(e) => setCorreoLider(e.target.value)} placeholder="lider@correo.com" />
            )}
          </div>

          <CampoOtp value={pin} onChange={setPin} />
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
