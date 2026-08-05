import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Building2, Home, LayoutGrid, Network, ShieldCheck, UserRound } from 'lucide-react';
import type { DatosNodoEstructura } from './types';

type NodoVisual = Node<DatosNodoEstructura, 'estructura'>;

const ICONOS = {
  PASTOR_SLOT: UserRound,
  SUPERVISOR_SLOT: ShieldCheck,
  GRUPO_DEPARTAMENTOS: LayoutGrid,
  DEPARTAMENTO: Building2,
  GRUPO_REDES: Network,
  RED: Network,
  CASA_DE_PAZ: Home,
} as const;

export function NodoEstructura({ data, selected }: NodeProps<NodoVisual>) {
  const Icono = ICONOS[data.tipo];
  const esGrupo = data.tipo === 'GRUPO_DEPARTAMENTOS' || data.tipo === 'GRUPO_REDES';
  const color = data.color ?? (esGrupo ? '#334155' : '#2563eb');

  return (
    <div
      className={`w-[250px] rounded-2xl border bg-white px-4 py-3 shadow-sm transition-all ${
        selected || data.resaltado
          ? 'border-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.18)]'
          : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
      }`}
      style={{ borderLeftWidth: 5, borderLeftColor: color }}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-slate-400" />
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ color, backgroundColor: `color-mix(in oklab, ${color} 12%, white)` }}
        >
          <Icono className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-900">{data.titulo}</span>
          {data.subtitulo && (
            <span className="mt-0.5 block truncate text-xs text-slate-500">{data.subtitulo}</span>
          )}
        </span>
      </div>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-slate-400" />
    </div>
  );
}
