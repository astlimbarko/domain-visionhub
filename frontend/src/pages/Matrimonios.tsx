import { useState } from 'react';
import { Heart, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { MORADO } from '@/components/dashboard/DashboardUI';
import { PersonaNombreLink } from '@/components/personas/PersonaNombreLink';
import { useAuthStore } from '@/store/auth.store';
import { useMatrimoniosIglesia } from '@/hooks/useRolesGlobalesDatos';

/**
 * Acceso global de solo lectura del Encargado de Matrimonios: todas las
 * parejas de la iglesia (familia.tipo_relacion CONYUGE), como unidad, sin
 * importar a qué Red o Casa de Paz pertenecen -- capacidad ortogonal al RolUI.
 */
export function Matrimonios() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const { data: matrimonios = [], isLoading } = useMatrimoniosIglesia(iglesiaActivaId);
  const [texto, setTexto] = useState('');

  const q = texto.trim().toLowerCase();
  const filtrados = matrimonios.filter(
    (m) => m.persona1_nombre.toLowerCase().includes(q) || m.persona2_nombre.toLowerCase().includes(q)
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader
          icon={Heart}
          color={MORADO}
          titulo="Matrimonios"
          descripcion={`${matrimonios.length} pareja${matrimonios.length === 1 ? '' : 's'} en toda la iglesia`}
        />
        <div className="flex flex-col gap-4 p-5">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            <Input className="pl-9" placeholder="Buscar por nombre..." value={texto} onChange={(e) => setTexto(e.target.value)} />
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : filtrados.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {matrimonios.length === 0 ? 'Todavía no hay matrimonios registrados.' : 'Ninguna pareja coincide con la búsqueda.'}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filtrados.map((m) => (
                <div key={`${m.persona1_id}-${m.persona2_id}`} className="flex flex-col gap-1.5 rounded-xl border border-border/60 px-4 py-3">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <PersonaNombreLink personaId={m.persona1_id}>{m.persona1_nombre}</PersonaNombreLink>
                    <Heart className="h-3 w-3 shrink-0" style={{ color: MORADO }} />
                    <PersonaNombreLink personaId={m.persona2_id}>{m.persona2_nombre}</PersonaNombreLink>
                  </div>
                  {m.casa_de_paz_etiqueta && <p className="truncate text-xs text-muted-foreground">{m.casa_de_paz_etiqueta}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
