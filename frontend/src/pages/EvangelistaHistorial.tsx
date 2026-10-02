import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AvatarPersona, COLORES_AVATAR } from '@/components/shared/AvatarIniciales';
import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';
import { EvangelistaSubHeader } from '@/components/evangelista/EvangelistaSubHeader';
import { useHistorialEvangelista } from '@/hooks/useEvangelistaPersonal';
import { EVANGELISTA_COLOR } from '@/utils/evangelista-colores';
import { aISO, fechaLegible } from '@/utils/calendario-fechas';
import { rutaEvangelistaSeguimiento } from '@/utils/constants';
import type { EvangelistaHistorialItem } from '@/types/evangelista-personal.types';

function fechaRelativa(fechaCreacionISO: string): string {
  const fecha = new Date(fechaCreacionISO);
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);
  const hora = fecha.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
  if (fecha.toDateString() === hoy.toDateString()) return `Hoy · ${hora}`;
  if (fecha.toDateString() === ayer.toDateString()) return `Ayer · ${hora}`;
  return `${fechaLegible(aISO(fecha))} · ${hora}`;
}

/** Tarjeta de una persona del historial (KAN-431, boceto `evangelismo3.jpeg`).
 * El color se deriva del estado REAL (¿tiene contactos o no?), no se copian
 * los colores fijos del mockup por fila (pedido explícito, Requisito 6 AC4). */
function TarjetaHistorial({ item, color, onVer }: { item: EvangelistaHistorialItem; color: string; onVer: () => void }) {
  const sinContactar = item.cantidad_contactos === 0;
  return (
    <button
      type="button"
      onClick={onVer}
      className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-card p-3.5 text-left shadow-sm transition-shadow hover:shadow-md"
    >
      <AvatarPersona nombre={item.nombre_completo} color={color} size="lg" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-sm font-bold text-foreground">{item.nombre_completo}</p>
        <p className="text-[11px] text-muted-foreground">{fechaRelativa(item.fecha_creacion)}</p>
        <div className="flex items-center gap-1.5">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: sinContactar ? '#E63946' : '#22C55E' }}
          />
          <span className="text-[11px] font-medium text-muted-foreground">
            {sinContactar ? 'Sin contactar' : 'Contactado'} · {item.cantidad_contactos} {item.cantidad_contactos === 1 ? 'contacto' : 'contactos'}
          </span>
        </div>
      </div>
      <Button
        size="sm"
        variant={sinContactar ? 'default' : 'outline'}
        className="shrink-0 rounded-xl"
        style={sinContactar ? { background: `linear-gradient(135deg, ${EVANGELISTA_COLOR.NARANJA_OSCURO}, ${EVANGELISTA_COLOR.NARANJA})` } : undefined}
      >
        {sinContactar ? 'Contactar ahora' : 'Ver seguimiento'}
      </Button>
    </button>
  );
}

export function EvangelistaHistorial() {
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState('');
  const [verTodo, setVerTodo] = useState(false);
  const hace30Dias = aISO(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const { data: historial = [], isLoading } = useHistorialEvangelista(verTodo ? undefined : hace30Dias, undefined);

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return historial;
    return historial.filter((h) => h.nombre_completo.toLowerCase().includes(texto));
  }, [historial, busqueda]);

  return (
    <div className="flex flex-col gap-6">
      <EvangelistaSubHeader titulo="Historial" />

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar persona..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">
          Personas registradas <span className="text-muted-foreground">({filtrados.length})</span>
        </p>
        {!verTodo && (
          <button type="button" onClick={() => setVerTodo(true)} className="text-xs font-medium hover:underline" style={{ color: EVANGELISTA_COLOR.NARANJA_OSCURO }}>
            Ver registros anteriores a 30 días →
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : filtrados.length === 0 ? (
        <ProximamentePlaceholder titulo="Sin registros" descripcion="Todavía no registraste a nadie en este período." />
      ) : (
        <div className="flex flex-col gap-3">
          {filtrados.map((item, i) => (
            <TarjetaHistorial
              key={item.id}
              item={item}
              color={COLORES_AVATAR[i % COLORES_AVATAR.length]}
              onVer={() => navigate(rutaEvangelistaSeguimiento(item.id), { state: { nombreCompleto: item.nombre_completo } })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
