import { useAuthStore } from '@/store/auth.store';
import { useSoloLectura } from '@/hooks/useSoloLectura';
import { RegistrarPersonaAfirmacion } from '@/components/afirmacion/RegistrarPersonaAfirmacion';
import { cn } from '@/lib/utils';

export function AfirmacionFormulario() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);
  // KAN-339 (2026-09-10, pedido explicito del owner tras probarlo en vivo):
  // antes esto tapaba el formulario con un cartel -- pero el owner necesita
  // VER el formulario real para revisar el diseño, aunque sea inutilizable.
  // pointer-events-none bloquea toda interaccion de mouse (no hace falta
  // enhebrar un prop "disabled" por cada campo de este formulario tan
  // grande) -- la barrera real de todas formas es el backend
  // (fn_registrar_persona_afirmacion nunca sumo fn_es_super_admin()).
  const soloLectura = useSoloLectura();

  if (!iglesiaActivaId) {
    return <p className="text-sm text-muted-foreground">Elegí una iglesia para continuar.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Formulario de membresía</h1>
        <p className="text-sm text-muted-foreground">Registrar una persona nueva en la iglesia (Afirmación).</p>
      </div>

      {soloLectura && (
        <p className="text-xs font-semibold text-muted-foreground">
          Vista de solo lectura -- este formulario no se puede enviar.
        </p>
      )}
      <div className={cn('glass-card-elevated rounded-2xl p-5 sm:p-6', soloLectura && 'pointer-events-none select-none')}>
        <RegistrarPersonaAfirmacion iglesiaId={iglesiaActivaId} />
      </div>
    </div>
  );
}
