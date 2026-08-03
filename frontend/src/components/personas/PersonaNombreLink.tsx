import { useFichaPersonaStore } from '@/store/ficha-persona.store';
import { cn } from '@/lib/utils';

interface Props {
  personaId: string;
  className?: string;
  children: React.ReactNode;
}

/** Vínculo de perfil: cualquier nombre de persona abre su ficha detallada. */
export function PersonaNombreLink({ personaId, className, children }: Props) {
  const abrir = useFichaPersonaStore((s) => s.abrir);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        abrir(personaId);
      }}
      className={cn('text-left underline-offset-2 hover:underline', className)}
    >
      {children}
    </button>
  );
}
