import { useState } from 'react';
import { toast } from 'sonner';
import { Check, KeyRound, Mail, UserCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { AvatarPersona } from '@/components/shared/AvatarIniciales';
import { BuscadorPersona } from '@/components/casas-de-paz/BuscadorPersona';
import { EvangelistaSubHeader } from '@/components/evangelista/EvangelistaSubHeader';
import { useAuthStore } from '@/store/auth.store';
import {
  useCrearCredencialEvangelista,
  useDatosPersonaCredencial,
  useOtorgarEvangelista,
} from '@/hooks/useEvangelistaPersonal';
import { EVANGELISTA_COLOR } from '@/utils/evangelista-colores';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { cn } from '@/lib/utils';
import type { PersonaBusqueda } from '@/types/casas-de-paz.types';

type PasoCorreo = 'elegir' | 'nuevo' | 'actualizar-o-mantener';

/**
 * KAN-434: panel "Crear credencial para Evangelista" (boceto
 * `bocetoInvitacion.jpeg`). Busca una persona YA EXISTENTE (nunca crea una
 * nueva) y le otorga el rol -- si no tiene cuenta todavía, primero le crea
 * una (password provisoria + correo de aviso), con el flujo de correo
 * confirmado por el owner el 2026-09-29/30: si ya tiene correo en
 * membresía, preguntar si usar ese o uno distinto; si elige uno distinto,
 * preguntar si actualiza el de membresía o mantiene ambos.
 */
export function EvangelistaCredenciales() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const [personaElegida, setPersonaElegida] = useState<PersonaBusqueda | null>(null);
  const [confirmada, setConfirmada] = useState(false);
  const [pasoCorreo, setPasoCorreo] = useState<PasoCorreo>('elegir');
  const [correoNuevo, setCorreoNuevo] = useState('');

  const { data: datos, isLoading: cargandoDatos } = useDatosPersonaCredencial(confirmada ? personaElegida?.id : undefined);
  const otorgar = useOtorgarEvangelista();
  const crearCredencial = useCrearCredencialEvangelista();

  function reiniciar() {
    setPersonaElegida(null);
    setConfirmada(false);
    setPasoCorreo('elegir');
    setCorreoNuevo('');
  }

  async function otorgarAQuienYaTieneCuenta() {
    if (!personaElegida) return;
    try {
      await otorgar.mutateAsync(personaElegida.id);
      toast.success('Rol Evangelista otorgado');
      reiniciar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo otorgar el rol');
    }
  }

  async function crearCuentaYOtorgar(correo: string, actualizarCorreoMembresia: boolean) {
    if (!personaElegida) return;
    try {
      await crearCredencial.mutateAsync({ personaId: personaElegida.id, correo, actualizarCorreoMembresia });
      toast.success('Cuenta creada y rol otorgado -- decile la contraseña provisoria en persona (12345678)');
      reiniciar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear la cuenta');
    }
  }

  const procesando = otorgar.isPending || crearCredencial.isPending;

  return (
    <div className="flex flex-col gap-6">
      <EvangelistaSubHeader titulo="Crear credencial para Evangelista" />

      {!personaElegida && (
        <div className="flex flex-col gap-2">
          <Label>Buscar persona</Label>
          <BuscadorPersona iglesiaId={iglesiaActivaId} onSeleccionar={(p) => { setPersonaElegida(p); setConfirmada(false); }} />
        </div>
      )}

      {personaElegida && !confirmada && (
        <section className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-4">
          <div className="flex items-center gap-3">
            <AvatarPersona nombre={personaElegida.nombre_completo} color={EVANGELISTA_COLOR.NARANJA} size="lg" />
            <div>
              <p className="text-xs text-muted-foreground">¿Es esta persona?</p>
              <p className="text-sm font-bold text-foreground">{personaElegida.nombre_completo}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-1.5" onClick={reiniciar}>
              <X className="h-3.5 w-3.5" />
              No, buscar otra
            </Button>
            <Button
              className="gap-1.5 text-white"
              style={{ background: `linear-gradient(135deg, ${EVANGELISTA_COLOR.NARANJA_OSCURO}, ${EVANGELISTA_COLOR.NARANJA})` }}
              onClick={() => setConfirmada(true)}
            >
              <Check className="h-3.5 w-3.5" />
              Sí, es esta persona
            </Button>
          </div>
        </section>
      )}

      {personaElegida && confirmada && cargandoDatos && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="h-4 w-4" />
          Cargando datos...
        </div>
      )}

      {personaElegida && confirmada && !cargandoDatos && datos && !datos.tiene_cdp && (
        <section className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-foreground">
            <span className="font-medium">{personaElegida.nombre_completo}</span> no pertenece a ninguna Casa de Paz todavía -- no se le puede otorgar el rol Evangelista.
          </p>
          <Button variant="outline" onClick={reiniciar} className="self-start">
            Buscar otra persona
          </Button>
        </section>
      )}

      {personaElegida && confirmada && !cargandoDatos && datos?.tiene_cdp && datos.usuario_id && (
        <section className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <UserCheck className="h-4 w-4" style={{ color: EVANGELISTA_COLOR.NARANJA_OSCURO }} />
            {personaElegida.nombre_completo} ya tiene cuenta en el sistema -- solo falta otorgarle el rol.
          </div>
          <Button
            className="gap-1.5 self-start text-white"
            style={{ background: `linear-gradient(135deg, ${EVANGELISTA_COLOR.NARANJA_OSCURO}, ${EVANGELISTA_COLOR.NARANJA})` }}
            disabled={procesando}
            onClick={otorgarAQuienYaTieneCuenta}
          >
            {procesando && <Spinner className="h-3.5 w-3.5" />}
            {procesando ? 'Otorgando...' : 'Otorgar rol Evangelista'}
          </Button>
        </section>
      )}

      {personaElegida && confirmada && !cargandoDatos && datos?.tiene_cdp && !datos.usuario_id && (
        <section className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <KeyRound className="h-4 w-4" style={{ color: EVANGELISTA_COLOR.NARANJA_OSCURO }} />
            {personaElegida.nombre_completo} todavía no tiene cuenta -- se le va a crear una con contraseña provisoria.
          </div>

          {!datos.correo && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="correo_nuevo">Correo electrónico *</Label>
              <Input id="correo_nuevo" type="email" className={CAMPO_ESTILO} placeholder="correo@ejemplo.com" value={correoNuevo} onChange={(e) => setCorreoNuevo(e.target.value)} />
              <Button
                className="gap-1.5 self-start text-white"
                style={{ background: `linear-gradient(135deg, ${EVANGELISTA_COLOR.NARANJA_OSCURO}, ${EVANGELISTA_COLOR.NARANJA})` }}
                disabled={!correoNuevo.trim().includes('@') || procesando}
                onClick={() => crearCuentaYOtorgar(correoNuevo.trim().toLowerCase(), true)}
              >
                {procesando && <Spinner className="h-3.5 w-3.5" />}
                {procesando ? 'Creando...' : 'Crear credencial y otorgar rol'}
              </Button>
            </div>
          )}

          {datos.correo && pasoCorreo === 'elegir' && (
            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                Correo de membresía: <span className="font-medium text-foreground">{datos.correo}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  className="gap-1.5 text-white"
                  style={{ background: `linear-gradient(135deg, ${EVANGELISTA_COLOR.NARANJA_OSCURO}, ${EVANGELISTA_COLOR.NARANJA})` }}
                  disabled={procesando}
                  onClick={() => crearCuentaYOtorgar(datos.correo as string, false)}
                >
                  {procesando && <Spinner className="h-3.5 w-3.5" />}
                  Usar este correo
                </Button>
                <Button variant="outline" onClick={() => setPasoCorreo('nuevo')}>
                  Ingresar otro correo
                </Button>
              </div>
            </div>
          )}

          {datos.correo && pasoCorreo === 'nuevo' && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="correo_otro">Correo nuevo *</Label>
              <Input id="correo_otro" type="email" className={CAMPO_ESTILO} placeholder="correo@ejemplo.com" value={correoNuevo} onChange={(e) => setCorreoNuevo(e.target.value)} />
              <Button
                className="self-start"
                variant="outline"
                disabled={!correoNuevo.trim().includes('@')}
                onClick={() => setPasoCorreo('actualizar-o-mantener')}
              >
                Continuar
              </Button>
            </div>
          )}

          {datos.correo && pasoCorreo === 'actualizar-o-mantener' && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-foreground">
                ¿Actualizamos el correo de membresía a <span className="font-medium">{correoNuevo}</span>, o mantenemos el de membresía (<span className="font-medium">{datos.correo}</span>) y usamos este solo para el acceso?
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  className={cn('gap-1.5 text-white')}
                  style={{ background: `linear-gradient(135deg, ${EVANGELISTA_COLOR.NARANJA_OSCURO}, ${EVANGELISTA_COLOR.NARANJA})` }}
                  disabled={procesando}
                  onClick={() => crearCuentaYOtorgar(correoNuevo.trim().toLowerCase(), true)}
                >
                  {procesando && <Spinner className="h-3.5 w-3.5" />}
                  Actualizar correo de membresía
                </Button>
                <Button variant="outline" disabled={procesando} onClick={() => crearCuentaYOtorgar(correoNuevo.trim().toLowerCase(), false)}>
                  Mantener ambos
                </Button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
