import { Coins, Gift, Wallet } from 'lucide-react';
import { VERDE, AMBAR, TEAL } from '@/components/dashboard/DashboardUI';

/**
 * [Ofrenda][Diezmo][Total] -- pedido exacto del owner, 2026-08-02. Nació en
 * `DashboardLiderRed.tsx` (contabilidad de la Red + desglose por CdP) y se
 * extrajo acá para reusarlo tal cual en la vista de Finanzas por Red del
 * Supervisor (`FinanzasSupervisorVista.tsx`, 2026-08-04).
 */
export type BolsaMoneda = Map<string, number>;

export interface FinanzasResumen {
  ofrenda: BolsaMoneda;
  diezmo: BolsaMoneda;
  total: BolsaMoneda;
}

export function bolsaVacia(): FinanzasResumen {
  return { ofrenda: new Map(), diezmo: new Map(), total: new Map() };
}

function StatFinanciero({ label, valores, color, icon: Icon }: { label: string; valores: BolsaMoneda; color: string; icon: typeof Wallet }) {
  const entradas = Array.from(valores.entries());
  return (
    <div
      className="flex flex-col gap-1.5 rounded-xl p-3"
      style={{ backgroundColor: `color-mix(in oklab, ${color} 9%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 25%, transparent)` }}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase" style={{ color }}>
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      {entradas.length === 0 ? (
        <span className="text-sm text-muted-foreground">Sin registros</span>
      ) : (
        <div className="flex flex-col">
          {entradas.map(([simbolo, monto]) => (
            <span key={simbolo} className="text-lg font-bold tabular-nums" style={{ color }}>{simbolo} {monto.toFixed(2)}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export function BloqueFinanciero({ resumen }: { resumen: FinanzasResumen }) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      <StatFinanciero label="Ofrenda" valores={resumen.ofrenda} color={VERDE} icon={Gift} />
      <StatFinanciero label="Diezmo" valores={resumen.diezmo} color={AMBAR} icon={Coins} />
      <StatFinanciero label="Total" valores={resumen.total} color={TEAL} icon={Wallet} />
    </div>
  );
}

/**
 * Arma FinanzasResumen (global + por CdP) a partir de una lista plana de
 * IngresoDetalle -- mismo recorrido que ya usaba DashboardLiderRed.tsx.
 * `etiquetasCdp` (opcional) precarga el mapa con una bolsa vacía por cada
 * Casa de Paz de la Red, para que las que no tuvieron ningún ingreso ese mes
 * igual aparezcan en el desglose (en $0) en vez de desaparecer directamente
 * -- bug real: sin esto, `FinanzasSupervisorVista.tsx` solo mostraba las CdP
 * con movimientos, pedido del owner 2026-08-05.
 */
export function agruparFinanzasPorCdp(
  ingresos: { casa_de_paz_nombre?: string; tipo_codigo: string; moneda_simbolo: string; total: number }[],
  etiquetasCdp: string[] = []
) {
  const global = bolsaVacia();
  const porCdp = new Map<string, FinanzasResumen>();
  for (const etiqueta of etiquetasCdp) porCdp.set(etiqueta, bolsaVacia());
  for (const i of ingresos) {
    const clave = i.casa_de_paz_nombre ?? 'Sin Casa de Paz';
    const bolsa = porCdp.get(clave) ?? bolsaVacia();
    porCdp.set(clave, bolsa);
    const monto = Number(i.total);
    const destino = i.tipo_codigo === 'OFRENDA' ? bolsa.ofrenda : i.tipo_codigo === 'DIEZMO' ? bolsa.diezmo : null;
    const destinoGlobal = i.tipo_codigo === 'OFRENDA' ? global.ofrenda : i.tipo_codigo === 'DIEZMO' ? global.diezmo : null;
    if (destino) destino.set(i.moneda_simbolo, (destino.get(i.moneda_simbolo) ?? 0) + monto);
    if (destinoGlobal) destinoGlobal.set(i.moneda_simbolo, (destinoGlobal.get(i.moneda_simbolo) ?? 0) + monto);
    bolsa.total.set(i.moneda_simbolo, (bolsa.total.get(i.moneda_simbolo) ?? 0) + monto);
    global.total.set(i.moneda_simbolo, (global.total.get(i.moneda_simbolo) ?? 0) + monto);
  }
  return { global, porCdp };
}
