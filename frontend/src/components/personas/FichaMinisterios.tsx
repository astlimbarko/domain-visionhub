import { Star, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { MinisterioDePersona } from '@/types/persona.types';

interface Props {
  ministerios: MinisterioDePersona[];
}

/**
 * Solo lectura -- la asignación (agregar/quitar participante, marcar líder)
 * se sigue haciendo desde la página Ministerios. Una persona puede liderar
 * varios ministerios a la vez (Danza, Sonido, etc.), así que se listan todos.
 */
export function FichaMinisterios({ ministerios }: Props) {
  if (ministerios.length === 0) {
    return <p className="text-sm text-muted-foreground">No participa de ningún ministerio.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {ministerios.map((m) => (
        <Badge key={m.ministerio_id} variant={m.es_lider ? 'default' : 'secondary'} className="gap-1.5">
          {m.es_lider ? <Star className="h-3 w-3 fill-current" /> : <Users className="h-3 w-3" />}
          {m.nombre}
          {m.es_lider && <span className="text-[10px] opacity-80">líder</span>}
        </Badge>
      ))}
    </div>
  );
}
