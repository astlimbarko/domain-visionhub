import { useAuthStore } from '@/store/auth.store';
import { useSoloLectura } from '@/hooks/useSoloLectura';
import { RegistrarPersonaAfirmacion } from '@/components/afirmacion/RegistrarPersonaAfirmacion';

export function AfirmacionFormulario() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);
  // KAN-339 (2026-09-10, pedido explicito del owner tras probarlo en vivo):
  // el owner necesita navegar el formulario real completo (dropdowns,
  // Siguiente/Atras, elegir Red y Lider) para revisar el diseño -- no solo
  // verlo estatico. RegistrarPersonaAfirmacion recibe soloLectura y bloquea
  // unicamente el guardado final (unico punto real de escritura), asi que
  // acá no hace falta ningun bloqueo de interaccion (ni pointer-events-none
  // ni disabled) -- la barrera real de todas formas es el backend
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
          Vista de solo lectura -- podés navegar el formulario, pero no se puede guardar.
        </p>
      )}
      <div className="glass-card-elevated rounded-2xl p-5 sm:p-6">
        <RegistrarPersonaAfirmacion iglesiaId={iglesiaActivaId} soloLectura={soloLectura} />
      </div>
    </div>
  );
}
