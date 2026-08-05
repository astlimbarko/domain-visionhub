import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Building2, Home, LayoutGrid, Mail, Network, ShieldCheck, UserRound } from 'lucide-react';
import type { DatosNodoEstructura, PersonaEstructura } from './types';

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

function inicialesPersona(persona: PersonaEstructura): string | null {
  if (!persona.nombre?.trim()) return null;
  const partes = persona.nombre.trim().split(/\s+/);
  const primera = partes[0]?.[0] ?? '';
  const ultima = partes.length > 1 ? partes.at(-1)?.[0] ?? '' : '';
  return `${primera}${ultima}`.toLocaleUpperCase('es');
}

function NodoResponsablePrincipal({ data, selected }: { data: DatosNodoEstructura; selected: boolean }) {
  const esPastor = data.tipo === 'PASTOR_SLOT';
  const responsables = data.responsables ?? [];
  const principal = responsables[0];
  const iniciales = principal ? inicialesPersona(principal) : null;
  const pendiente = principal?.membresiaPendiente ?? false;
  const colorEstado = pendiente ? '#94a3b8' : '#22c55e';
  const textoEstado = pendiente ? 'Confirmación pendiente' : 'Cuenta confirmada';
  const vacio = esPastor ? 'Pastor sin asignar' : 'Supervisor sin asignar';

  return (
    <div
      className={`relative flex min-h-[166px] w-[250px] flex-col items-center rounded-2xl border bg-white px-5 py-4 text-center shadow-sm transition-all ${
        selected || data.resaltado
          ? 'border-blue-400 shadow-[0_0_0_3px_rgba(59,130,246,0.20),0_12px_30px_rgba(15,23,42,0.10)]'
          : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
      }`}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-slate-400" />
      <span className="text-[10px] font-bold tracking-[0.16em] text-blue-700 uppercase">
        {data.etiquetaRol ?? (esPastor ? 'Pastor' : 'Supervisor')}
      </span>
      {!esPastor && (
        <span className="mt-1 max-w-[205px] text-[11px] font-semibold leading-4 text-slate-700">
          Supervisor de la Visión en Acción
        </span>
      )}

      <span className="relative mt-3 flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white shadow-sm">
        {iniciales ?? (principal ? <Mail className="h-4.5 w-4.5" aria-hidden="true" /> : <UserRound className="h-4.5 w-4.5" aria-hidden="true" />)}
        {principal && (
          <span
            title={textoEstado}
            aria-label={textoEstado}
            className="absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-white"
            style={{ backgroundColor: colorEstado }}
          />
        )}
      </span>

      <span
        title={principal?.nombre?.trim() || principal?.correo || vacio}
        className={`mt-2 max-w-full text-sm font-semibold ${
          principal?.nombre?.trim() ? 'truncate text-slate-950' : principal?.correo ? 'text-xs leading-4 text-slate-950 [overflow-wrap:anywhere]' : 'text-slate-500'
        }`}
      >
        {principal?.nombre?.trim() || principal?.correo || vacio}
      </span>
      {principal?.nombre && principal.correo && (
        <span title={principal.correo} className="mt-0.5 max-w-full truncate text-[11px] text-slate-500">{principal.correo}</span>
      )}
      {principal?.membresiaPendiente && (
        <span className="mt-1 text-[10px] font-medium text-slate-500">Membresía pendiente</span>
      )}
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-slate-400" />
    </div>
  );
}

function NodoDepartamento({ data, selected }: { data: DatosNodoEstructura; selected: boolean }) {
  const principal = data.responsables?.[0];
  const iniciales = principal ? inicialesPersona(principal) : null;
  const activo = Boolean(principal);
  const pendiente = principal?.membresiaPendiente ?? false;
  const color = data.color ?? '#64748b';
  const nombreResponsable = principal?.nombre?.trim() || principal?.correo;
  const textoEstado = pendiente ? 'Confirmación pendiente' : 'Cuenta confirmada';

  return (
    <div
      className={`relative flex min-h-[96px] w-[235px] flex-col items-stretch rounded-xl border px-3.5 py-3 shadow-sm transition-all ${
        selected || data.resaltado
          ? 'border-white shadow-[0_0_0_3px_rgba(59,130,246,0.30),0_8px_20px_rgba(15,23,42,0.12)]'
          : activo
            ? 'border-white/40 hover:border-white/75 hover:shadow-md'
            : 'border-slate-300 hover:border-slate-400 hover:shadow-md'
      }`}
      style={activo
        ? { background: `color-mix(in oklab, ${color} 78%, #0f172a)` }
        : { background: `color-mix(in oklab, ${color} 11%, white)`, borderLeftWidth: 5, borderLeftColor: color }}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-white/65" />
      <span className={`block truncate text-sm font-bold ${activo ? 'text-white' : 'text-slate-950'}`}>
        {data.titulo}
      </span>
      <span className={`mt-2 flex items-center gap-2 border-t pt-2 ${activo ? 'border-white/20' : 'border-slate-300/70'}`}>
        <span
          className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${
            activo ? 'bg-white/16 text-white' : 'bg-white/80 text-slate-700'
          }`}
        >
          {activo ? (iniciales ?? <Mail className="h-3.5 w-3.5" aria-hidden="true" />) : <Building2 className="h-4 w-4" aria-hidden="true" />}
          {principal && (
            <span
              title={textoEstado}
              aria-label={textoEstado}
              className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-white"
              style={{ backgroundColor: pendiente ? '#94a3b8' : '#22c55e' }}
            />
          )}
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className={`block text-[10px] font-semibold tracking-wide uppercase ${activo ? 'text-white/65' : 'text-slate-500'}`}>Líder</span>
        <span
          title={nombreResponsable ?? 'Líder sin asignar'}
          className={`block truncate text-xs leading-4 ${
            activo ? 'text-white/85 [overflow-wrap:anywhere]' : 'font-medium text-slate-700'
          }`}
        >
          {nombreResponsable ?? 'Líder sin asignar'}
        </span>
        </span>
      </span>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-white/65" />
    </div>
  );
}

function ResumenPersonaRed({ persona, claro }: { persona?: PersonaEstructura; claro: boolean }) {
  const iniciales = persona ? inicialesPersona(persona) : null;
  const nombre = persona?.nombre?.trim() || persona?.correo || 'Sin asignar';

  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${claro ? 'bg-white/15 text-white' : 'bg-white text-slate-700'}`}>
        {iniciales ?? (persona ? <Mail className="h-3 w-3" aria-hidden="true" /> : <UserRound className="h-3 w-3" aria-hidden="true" />)}
        {persona && (
          <span
            className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white"
            style={{ backgroundColor: persona.membresiaPendiente ? '#94a3b8' : '#22c55e' }}
          />
        )}
      </span>
      <span title={nombre} className={`min-w-0 truncate text-xs font-medium ${claro ? 'text-white/90' : 'text-slate-800'}`}>
        {nombre}
      </span>
    </span>
  );
}

function NodoRed({ data, selected }: { data: DatosNodoEstructura; selected: boolean }) {
  const incompleto = Boolean(data.estadoIncompleto);
  const claro = !incompleto;
  const color = data.color ?? '#64748b';
  const lider = data.responsables?.[0];
  const supervisor = data.supervisores?.[0];

  return (
    <div
      className={`relative min-h-[190px] w-[235px] rounded-2xl border px-4 py-3 shadow-sm transition-all ${
        selected || data.resaltado
          ? 'border-white shadow-[0_0_0_3px_rgba(59,130,246,0.30)]'
          : incompleto
            ? 'border-slate-300 bg-slate-200 hover:border-slate-400 hover:shadow-md'
            : 'border-white/35 hover:border-white/70 hover:shadow-md'
      }`}
      style={claro ? { background: `color-mix(in oklab, ${color} 76%, #0f172a)` } : undefined}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-white/65" />
      <div className="flex items-center gap-2.5">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${claro ? 'bg-white/15 text-white' : 'bg-white text-slate-700'}`}>
          <Network className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className={`block truncate text-sm font-bold ${claro ? 'text-white' : 'text-slate-950'}`}>{data.titulo}</span>
          {data.subtitulo && <span className={`block truncate text-[11px] ${claro ? 'text-white/70' : 'text-slate-600'}`}>{data.subtitulo}</span>}
        </span>
      </div>
      <div className={`mt-3 border-t pt-2.5 ${claro ? 'border-white/20' : 'border-slate-300'}`}>
        <span className={`mb-1 block text-[9px] font-bold tracking-[0.12em] uppercase ${claro ? 'text-white/60' : 'text-slate-500'}`}>Líder de Red</span>
        <ResumenPersonaRed persona={lider} claro={claro} />
      </div>
      <div className={`mt-2 border-t pt-2.5 ${claro ? 'border-white/20' : 'border-slate-300'}`}>
        <span className={`mb-1 block text-[9px] font-bold tracking-[0.12em] uppercase ${claro ? 'text-white/60' : 'text-slate-500'}`}>Supervisor de Red</span>
        <ResumenPersonaRed persona={supervisor} claro={claro} />
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-0 !bg-white/65" />
    </div>
  );
}

export function NodoEstructura({ data, selected }: NodeProps<NodoVisual>) {
  const Icono = ICONOS[data.tipo];
  const esGrupo = data.tipo === 'GRUPO_DEPARTAMENTOS' || data.tipo === 'GRUPO_REDES';
  const color = data.color ?? (esGrupo ? '#334155' : '#2563eb');

  if (data.tipo === 'PASTOR_SLOT' || data.tipo === 'SUPERVISOR_SLOT') {
    return <NodoResponsablePrincipal data={data} selected={selected} />;
  }

  if (data.tipo === 'DEPARTAMENTO') {
    return <NodoDepartamento data={data} selected={selected} />;
  }

  if (data.tipo === 'RED') {
    return <NodoRed data={data} selected={selected} />;
  }

  if (esGrupo) {
    if (data.tipo === 'GRUPO_DEPARTAMENTOS') {
      return (
        <div
          className="pointer-events-none rounded-2xl border border-slate-300/80 bg-white/35 p-5 shadow-sm backdrop-blur-[1px]"
          style={{ width: data.ancho ?? 1035, height: data.alto ?? 190 }}
        >
          <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-slate-400" />
          <div className="flex items-center gap-2.5 text-slate-800">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/80 text-blue-700 shadow-sm">
              <Icono className="h-4 w-4" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-bold">{data.titulo}</span>
              {data.subtitulo && <span className="block text-[11px] text-slate-500">{data.subtitulo}</span>}
            </span>
          </div>
        </div>
      );
    }
    return (
      <div
        className="pointer-events-none rounded-2xl border border-slate-300/80 bg-white/25 p-5 shadow-sm backdrop-blur-[1px]"
        style={{ width: data.ancho ?? 535, height: data.alto ?? 300 }}
      >
        <Handle type="target" position={Position.Left} className="!h-0 !w-0 !border-0 !bg-transparent" />
        <div className="flex items-center gap-2.5 text-slate-800">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/80 text-blue-700 shadow-sm">
            <Icono className="h-4 w-4 shrink-0" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">{data.titulo}</span>
            {data.subtitulo && <span className="mt-0.5 block truncate text-[11px] text-slate-500">{data.subtitulo}</span>}
          </span>
        </div>
      </div>
    );
  }

  const esCasaDePaz = data.tipo === 'CASA_DE_PAZ';
  const incompleto = Boolean(data.estadoIncompleto);

  return (
    <div
      className={`w-[235px] rounded-2xl border px-4 py-3 shadow-sm transition-all ${
        selected || data.resaltado
          ? 'border-white shadow-[0_0_0_3px_rgba(59,130,246,0.30)]'
          : incompleto
            ? 'border-slate-300 bg-slate-200 hover:border-slate-400 hover:shadow-md'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
      }`}
      style={{ borderLeftWidth: esCasaDePaz || incompleto ? 5 : undefined, borderLeftColor: incompleto ? '#94a3b8' : color }}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-white/65" />
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
            <span className="mt-0.5 block truncate text-xs text-slate-700">{data.subtitulo}</span>
          )}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-0 !bg-white/65" />
    </div>
  );
}
