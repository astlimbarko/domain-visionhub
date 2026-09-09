import { Droplets, Handshake, IdCard, Sparkles } from 'lucide-react';
import { DonutRing } from './DonutRing';

interface Props {
  pctBautizados: number;
  pctConMinisterio: number;
  pctMembresiaFormal: number;
  pctAfirmados: number;
}

const COLOR = 'var(--chart-4)';

/**
 * KPIs "de compromiso" -- 4 anillos de progreso (reusa `DonutRing`, el mismo
 * lenguaje visual que ya usa "Índice de fidelidad" en esta pantalla) en vez
 * de una barra horizontal más -- 2026-09-08, pedido del owner: los gráficos
 * quedaban repetidos entre sí (varios eran la misma barra horizontal) y
 * poco entendibles a primera vista. Un anillo por hito se lee de un vistazo,
 * sin tener que comparar largos de barra.
 */
export function CompromisoPersonasChart({ pctBautizados, pctConMinisterio, pctMembresiaFormal, pctAfirmados }: Props) {
  const datos = [
    { label: 'Bautizados', icon: Droplets, valor: pctBautizados },
    { label: 'Con ministerio', icon: Handshake, valor: pctConMinisterio },
    { label: 'Membresía formal', icon: IdCard, valor: pctMembresiaFormal },
    { label: 'Afirmados', icon: Sparkles, valor: pctAfirmados },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {datos.map(({ label, icon: Icon, valor }) => (
        <div key={label} className="flex flex-col items-center gap-2 text-center">
          <DonutRing porcentaje={valor} size={76} strokeWidth={8} color={COLOR} trackColor="color-mix(in oklab, var(--chart-4) 12%, transparent)">
            <div className="flex flex-col items-center">
              <Icon className="h-3.5 w-3.5" style={{ color: COLOR }} />
              <span className="text-[15px] font-bold text-foreground">{valor}%</span>
            </div>
          </DonutRing>
          <p className="text-[11.5px] leading-tight text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}
