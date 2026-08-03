import { useState } from 'react';
import { Search, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { AZUL } from '@/components/dashboard/DashboardUI';
import { PersonaNombreLink } from '@/components/personas/PersonaNombreLink';
import { useAuthStore } from '@/store/auth.store';
import { useJovenesIglesia } from '@/hooks/useRolesGlobalesDatos';

/**
 * Acceso global de solo lectura del Líder de Jóvenes: todos los jóvenes de
 * la iglesia (rango de edad configurable, EDAD_JOVEN_MIN/MAX), sin importar
 * a qué Red o Casa de Paz pertenecen -- capacidad ortogonal al RolUI.
 */
export function Jovenes() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const { data: jovenes = [], isLoading } = useJovenesIglesia(iglesiaActivaId);
  const [texto, setTexto] = useState('');

  const filtrados = jovenes.filter((j) => j.nombre_completo.toLowerCase().includes(texto.trim().toLowerCase()));

  return (
    <div className="flex flex-col gap-6">
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader
          icon={Users}
          color={AZUL}
          titulo="Jóvenes"
          descripcion={`${jovenes.length} persona${jovenes.length === 1 ? '' : 's'} en toda la iglesia`}
        />
        <div className="flex flex-col gap-4 p-5">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            <Input className="pl-9" placeholder="Buscar por nombre..." value={texto} onChange={(e) => setTexto(e.target.value)} />
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
            </div>
          ) : filtrados.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {jovenes.length === 0 ? 'Todavía no hay jóvenes registrados.' : 'Nadie coincide con la búsqueda.'}
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {filtrados.map((j) => (
                <div key={j.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 px-4 py-2.5">
                  <div className="min-w-0">
                    <PersonaNombreLink personaId={j.id} className="text-sm font-semibold text-foreground">
                      {j.nombre_completo}
                    </PersonaNombreLink>
                    <p className="truncate text-xs text-muted-foreground">
                      {j.edad} años
                      {j.casa_de_paz_etiqueta && ` · ${j.casa_de_paz_etiqueta}`}
                      {j.red_nombre && ` (${j.red_nombre})`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {j.telefono_principal && <span className="text-xs text-muted-foreground">{j.telefono_principal}</span>}
                    {j.estado_sigla && <Badge variant="secondary" className="rounded-full text-[10px]">{j.estado_sigla}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
