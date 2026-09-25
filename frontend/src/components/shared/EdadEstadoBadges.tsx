import { AMBAR, AZUL, MORADO, VERDE } from '@/components/dashboard/DashboardUI';
import { clasificarEdad, RANGO_EDAD_LABEL_PERSONA } from '@/utils/edad';

/** KAN-435 (pedido explícito del owner): color por estado SSVA -- mismo
 * criterio que FichaRapidaAsistente y las pastillas de asistencia. */
export const COLOR_ESTADO_SSVA: Record<string, string> = { SIM: AMBAR, NC: MORADO, CRE: VERDE, RE: AZUL };

/** KAN-447 (pedido explícito del owner): solo NC y RE muestran teléfono acá
 * -- son los estados que más necesitan seguimiento pastoral rápido; SIM/CRE
 * no lo muestran para no saturar la pastilla con datos de todo el mundo. */
const ESTADOS_CON_TELEFONO = new Set(['NC', 'RE']);

interface Props {
  edad: number | null | undefined;
  estadoSigla: string | null | undefined;
  /** Color de fallback para el badge de estado si la sigla no está en
   * `COLOR_ESTADO_SSVA` -- normalmente el mismo color de la pastilla/fila
   * donde se usa. */
  colorFallback: string;
  telefono?: string | null;
}

/** KAN-445 (2026-09-25, pedido explícito del owner): "edad por
 * clasificación" (Niño/a, Adolescente, Joven, Adulto, Adulto mayor) + el
 * estado SSVA vigente (SIM/NC/CRE/RE) -- antes solo se mostraba en las
 * pastillas de "Asistencia regular"/"de niños" (KAN-435); se extrae acá
 * para que el buscador de personas y "Asistentes nuevos" se vean
 * consistentes con esas dos listas, en vez de reimplementar el mismo
 * par de `<span>` en cada lugar. */
export function EdadEstadoBadges({ edad, estadoSigla, colorFallback, telefono }: Props) {
  return (
    <>
      {edad !== null && edad !== undefined && (
        <span className="text-[10px] opacity-70">({RANGO_EDAD_LABEL_PERSONA[clasificarEdad(edad)]})</span>
      )}
      {estadoSigla && (
        <span
          className="rounded-full px-1 text-[10px] font-semibold"
          style={{ backgroundColor: 'rgba(255,255,255,0.5)', color: COLOR_ESTADO_SSVA[estadoSigla] ?? colorFallback }}
        >
          {estadoSigla}
        </span>
      )}
      {telefono && estadoSigla && ESTADOS_CON_TELEFONO.has(estadoSigla) && (
        <span className="text-[10px] opacity-70">{telefono}</span>
      )}
    </>
  );
}
