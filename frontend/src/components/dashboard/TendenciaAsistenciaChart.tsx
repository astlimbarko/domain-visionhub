import { Area, AreaChart, CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PuntoTendenciaAsistencia } from '@/types/dashboard.types';
import type { GranularidadTendencia } from '@/utils/periodo-dashboard';

interface Props {
  datos: PuntoTendenciaAsistencia[];
  granularidad: GranularidadTendencia;
}

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_LARGOS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function etiquetaCorta(clave: string, granularidad: GranularidadTendencia): string {
  if (granularidad === 'anio') return clave;
  if (granularidad === 'trimestre') {
    const [anio, q] = clave.split('-Q');
    return `${q}T ${anio.slice(2)}`;
  }
  if (granularidad === 'mes') {
    const [anio, m] = clave.split('-');
    return `${MESES_CORTOS[parseInt(m, 10) - 1]} ${anio.slice(2)}`;
  }
  // semana: clave es la fecha ISO del domingo con el que arranca
  const d = new Date(`${clave}T00:00:00`);
  return `${String(d.getDate()).padStart(2, '0')} ${MESES_CORTOS[d.getMonth()]}`;
}

function etiquetaLarga(clave: string, granularidad: GranularidadTendencia): string {
  if (granularidad === 'anio') return `Año ${clave}`;
  if (granularidad === 'trimestre') {
    const [anio, q] = clave.split('-Q');
    return `${q}º trimestre ${anio}`;
  }
  if (granularidad === 'mes') {
    const [anio, m] = clave.split('-');
    return `${MESES_LARGOS[parseInt(m, 10) - 1]} ${anio}`;
  }
  return `Semana del ${etiquetaCorta(clave, 'semana')}`;
}

/** Tendencia de asistencia agrupada según el período elegido en el header del dashboard, con estadísticas reales para facilitar la lectura. */
export function TendenciaAsistenciaChart({ datos, granularidad }: Props) {
  if (!datos || datos.length < 2) {
    return <p className="text-sm text-muted-foreground">Todavía no hay suficientes reportes para mostrar una tendencia.</p>;
  }

  const valores = datos.map((d) => d.promedioAsistencia);
  const promedio = Math.round(valores.reduce((s, v) => s + v, 0) / valores.length);
  const maximo = Math.max(...valores);
  const minimo = Math.min(...valores);
  const puntoMax = datos.find((d) => d.promedioAsistencia === maximo)!;
  const puntoMin = datos.find((d) => d.promedioAsistencia === minimo)!;
  const primero = datos[0].promedioAsistencia;
  const ultimo = datos[datos.length - 1].promedioAsistencia;
  const variacion = primero > 0 ? Math.round(((ultimo - primero) / primero) * 100) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-[12px]">
        <div>
          <p className="text-muted-foreground">Promedio</p>
          <p className="font-semibold text-foreground">{promedio} asistentes</p>
        </div>
        <div>
          <p className="text-muted-foreground">Máximo</p>
          <p className="font-semibold text-foreground">
            {maximo} <span className="font-normal text-muted-foreground">({etiquetaCorta(puntoMax.clave, granularidad)})</span>
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Mínimo</p>
          <p className="font-semibold text-foreground">
            {minimo} <span className="font-normal text-muted-foreground">({etiquetaCorta(puntoMin.clave, granularidad)})</span>
          </p>
        </div>
        {variacion !== null && (
          <div>
            <p className="text-muted-foreground">Variación en el período</p>
            <p className={`font-semibold ${variacion > 0 ? 'text-chart-2' : variacion < 0 ? 'text-destructive' : 'text-foreground'}`}>
              {variacion > 0 ? '+' : ''}
              {variacion}%
            </p>
          </div>
        )}
      </div>

      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={datos} margin={{ top: 20, right: 12, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="tendenciaAsistenciaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="clave"
              tickFormatter={(v) => etiquetaCorta(String(v), granularidad)}
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
            <Tooltip
              labelFormatter={(label) => etiquetaLarga(String(label), granularidad)}
              formatter={(value) => [`${value} asistentes`, 'Promedio']}
              contentStyle={{
                background: 'var(--popover)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                fontSize: 12,
                color: 'var(--popover-foreground)',
              }}
              labelStyle={{ color: 'var(--muted-foreground)' }}
            />
            <ReferenceLine y={promedio} stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeOpacity={0.6} />
            <Area
              type="monotone"
              dataKey="promedioAsistencia"
              name="Promedio de asistencia"
              stroke="#6366f1"
              strokeWidth={2.5}
              fill="url(#tendenciaAsistenciaFill)"
              dot={{ r: 3, fill: '#6366f1' }}
              activeDot={{ r: 5 }}
            >
              <LabelList dataKey="promedioAsistencia" position="top" style={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
            </Area>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
