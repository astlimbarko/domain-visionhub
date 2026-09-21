/**
 * KAN-405: aviso de vencimiento del permiso de Colaborador -- pedido
 * explícito del ticket: "texto en rojo ARRIBA de la pantalla (NO modal),
 * con un contador regresivo también en rojo" en los últimos 10 minutos.
 * Vive en AppShell (no en /colaborar solamente) porque el Colaborador puede
 * estar navegando su panel normal (el suyo, con su rol de siempre) mientras
 * el permiso sigue corriendo -- el aviso tiene que seguir visible ahí
 * también, no solo dentro de la pantalla "Colaborar".
 */
import { AlertTriangle } from 'lucide-react';
import { useMiColaboracionActiva } from '@/hooks/useColaborador';
import { useCuentaRegresiva } from '@/hooks/useCuentaRegresiva';

const AVISO_SEGUNDOS = 10 * 60;

export function ColaboradorAvisoVencimiento() {
  const { data: colaboracion } = useMiColaboracionActiva();
  const { texto, segundosRestantes, vencido } = useCuentaRegresiva(colaboracion?.fecha_fin);

  if (!colaboracion || vencido || segundosRestantes > AVISO_SEGUNDOS) {
    return null;
  }

  return (
    <div className="flex w-full items-center justify-center gap-2 bg-destructive px-4 py-2 text-center text-[13px] font-semibold text-white">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>
        Tu colaboración con {colaboracion.iglesia_nombre} termina en <span className="tabular-nums">{texto}</span>
        {colaboracion.estado === 'PAUSADO' && ' (pausada)'}
      </span>
    </div>
  );
}
