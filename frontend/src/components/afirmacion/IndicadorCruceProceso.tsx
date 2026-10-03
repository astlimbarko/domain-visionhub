// Chip de cruce entre procesos de Afirmación (Bautismo ↔ Membresía): verde si
// la persona ya tiene registrado el OTRO proceso, ámbar si todavía no. Pedido
// del owner (2026-10-03): bautismo y membresía van parejo pero se dan en
// momentos distintos, así que cada pestaña "Registro" muestra si el otro ya
// está. En desktop va solo el ícono (con title); en móvil se pasa `etiqueta`
// para que se lea el "Sí/No".
import { CheckCircle2, CircleDashed } from 'lucide-react';

export function IndicadorCruceProceso({ presente, etiqueta }: { presente: boolean; etiqueta?: string }) {
  const Icono = presente ? CheckCircle2 : CircleDashed;
  return (
    <span
      title={presente ? `${etiqueta ?? ''} registrada`.trim() : `${etiqueta ?? ''} pendiente`.trim()}
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium"
      style={{
        color: presente ? '#30a46c' : 'var(--chart-3)',
        background: presente
          ? 'color-mix(in oklab, #30a46c 12%, transparent)'
          : 'color-mix(in oklab, var(--chart-3) 14%, transparent)',
      }}
    >
      <Icono className="h-3.5 w-3.5" />
      {etiqueta && <span>{presente ? 'Sí' : 'No'}</span>}
    </span>
  );
}
