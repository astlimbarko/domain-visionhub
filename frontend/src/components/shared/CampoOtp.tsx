import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSolicitarOtp } from '@/hooks/useOtp';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

const COOLDOWN_MS = 30_000;

/**
 * Campo de código de confirmación (OTP) por correo -- reemplaza el PIN
 * estático de Super Admin (15-gestion-administrativa, Panel 1). "Enviar
 * código" dispara fn_generar_otp vía la Edge Function `solicitar-otp` y
 * entra en cooldown de 30s; el código llega por correo y se escribe acá.
 */
export function CampoOtp({ value, onChange }: Props) {
  const solicitar = useSolicitarOtp();
  const [expiraCooldownEn, setExpiraCooldownEn] = useState<number | null>(null);
  const [, forzarRender] = useState(0);

  useEffect(() => {
    if (!expiraCooldownEn) return;
    const t = setInterval(() => forzarRender((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [expiraCooldownEn]);

  const restante = expiraCooldownEn ? Math.max(0, Math.ceil((expiraCooldownEn - Date.now()) / 1000)) : 0;

  function manejarSolicitar() {
    solicitar.mutate(undefined, {
      onSuccess: () => {
        toast.success('Código enviado a tu correo');
        setExpiraCooldownEn(Date.now() + COOLDOWN_MS);
      },
      onError: (e) => toast.error(e.message || 'No se pudo enviar el código'),
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="otp_codigo">Código de confirmación</Label>
      <div className="flex gap-2">
        <Input
          id="otp_codigo"
          inputMode="numeric"
          maxLength={6}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="6 dígitos"
        />
        <Button
          type="button"
          variant="outline"
          className="shrink-0 gap-1.5"
          disabled={solicitar.isPending || restante > 0}
          onClick={manejarSolicitar}
        >
          <Mail className="h-3.5 w-3.5" />
          {restante > 0 ? `Reenviar (${restante}s)` : 'Enviar código'}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">Te lo enviamos por correo. Válido por 10 minutos.</p>
    </div>
  );
}
