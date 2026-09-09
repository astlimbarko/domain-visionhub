import { useAuthStore } from '@/store/auth.store';
import { useSoloLectura } from '@/hooks/useSoloLectura';
import { RegistrarPersonaAfirmacion } from '@/components/afirmacion/RegistrarPersonaAfirmacion';
import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';

export function AfirmacionFormulario() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);
  // KAN-339: Super Admin en modo lectura -- este formulario es 100%
  // escritura (fn_registrar_persona_afirmacion, que el backend ya rechaza
  // para Super Admin), así que no tiene sentido mostrarlo.
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

      {soloLectura ? (
        <ProximamentePlaceholder
          titulo="Modo lectura"
          descripcion="Estás viendo este departamento como Super Admin -- no podés registrar personas desde acá."
        />
      ) : (
        <div className="glass-card-elevated rounded-2xl p-5 sm:p-6">
          <RegistrarPersonaAfirmacion iglesiaId={iglesiaActivaId} />
        </div>
      )}
    </div>
  );
}
