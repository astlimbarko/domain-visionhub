import { useAuthStore } from '@/store/auth.store';
import { RegistrarPersonaAfirmacion } from '@/components/afirmacion/RegistrarPersonaAfirmacion';

export function AfirmacionFormulario() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);

  if (!iglesiaActivaId) {
    return <p className="text-sm text-muted-foreground">Elegí una iglesia para continuar.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Formulario de membresía</h1>
        <p className="text-sm text-muted-foreground">Registrar una persona nueva en la iglesia (Afirmación).</p>
      </div>

      <div className="glass-card-elevated rounded-2xl p-5 sm:p-6">
        <RegistrarPersonaAfirmacion iglesiaId={iglesiaActivaId} />
      </div>
    </div>
  );
}
