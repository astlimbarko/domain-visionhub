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

  if (esGrupo) {
    return (
      <div className="w-[210px] py-2">
        <Handle type="target" position={Position.Left} className="!h-0 !w-0 !border-0 !bg-transparent" />
        <div className="flex items-center gap-2.5 border-b-2 border-slate-300 pb-2 text-slate-700">
          <Icono className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block truncate text-xs font-bold tracking-wide uppercase">{data.titulo}</span>
            {data.subtitulo && <span className="mt-0.5 block truncate text-[11px] text-slate-500">{data.subtitulo}</span>}
          </span>
        </div>
        <Handle type="source" position={Position.Right} className="!h-0 !w-0 !border-0 !bg-transparent" />
      </div>
    );
  }

  const usaRelleno = data.tipo === 'DEPARTAMENTO' || data.tipo === 'RED' || data.tipo === 'CASA_DE_PAZ';

  return (
    <div
      className={`w-[235px] rounded-2xl border px-4 py-3 shadow-sm transition-all ${
        selected || data.resaltado
          ? 'border-white shadow-[0_0_0_3px_rgba(59,130,246,0.30)]'
          : usaRelleno
            ? 'border-white/35 hover:border-white/70 hover:shadow-md'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
      }`}
      style={usaRelleno ? { background: `color-mix(in oklab, ${color} 74%, #0f172a)` } : { borderLeftWidth: 5, borderLeftColor: color }}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-white/65" />
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={usaRelleno
            ? { color: 'white', backgroundColor: 'rgba(255,255,255,0.16)' }
            : { color, backgroundColor: `color-mix(in oklab, ${color} 12%, white)` }}
        >
          <Icono className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm font-semibold ${usaRelleno ? 'text-white' : 'text-slate-900'}`}>{data.titulo}</span>
          {data.subtitulo && (
            <span className={`mt-0.5 block truncate text-xs ${usaRelleno ? 'text-white/75' : 'text-slate-500'}`}>{data.subtitulo}</span>
          )}
        </span>
      </div>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-white/65" />
    </div>
  );
}
