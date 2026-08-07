import { useState } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Building2, Home, LayoutGrid, Mail, Network, Plus, ShieldCheck, UserRound } from 'lucide-react';
import { colorLegibleSobreBlanco, textoLegibleSobre } from './contraste';
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
  NUEVA_CASA_DE_PAZ: Plus,
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
      aria-selected={selected}
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
  const pendiente = principal?.membresiaPendiente ?? false;
  const color = data.color ?? '#64748b';
  const texto = textoLegibleSobre(color);
  const capaSuave = `color-mix(in oklab, ${texto} 16%, transparent)`;
  const bordeSuave = `color-mix(in oklab, ${texto} 20%, transparent)`;
  const nombreResponsable = principal?.nombre?.trim() || principal?.correo;
  const textoEstado = pendiente ? 'Confirmación pendiente' : 'Cuenta confirmada';

  return (
    <div
      aria-selected={selected}
      className={`relative flex min-h-[96px] w-[235px] flex-col items-stretch rounded-xl border px-3.5 py-3 shadow-sm transition-all ${
        selected || data.resaltado
          ? 'border-white shadow-[0_0_0_3px_rgba(59,130,246,0.30),0_8px_20px_rgba(15,23,42,0.12)]'
          : 'border-white/40 hover:border-white/75 hover:shadow-md'
      }`}
      style={{ background: color }}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-white/65" />
      <span className="block truncate text-sm font-bold" style={{ color: texto }}>
        {data.titulo}
      </span>
      <span className="mt-2 flex items-center gap-2 border-t pt-2" style={{ borderColor: bordeSuave }}>
        <span
          className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold"
          style={{ background: capaSuave, color: texto }}
        >
          {iniciales ?? <Mail className="h-3.5 w-3.5" aria-hidden="true" />}
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
          <span className="block text-[10px] font-semibold tracking-wide uppercase" style={{ color: texto }}>Líder</span>
          <span
            title={nombreResponsable ?? 'Líder sin asignar'}
            className="block truncate text-xs leading-4 [overflow-wrap:anywhere]"
            style={{ color: texto }}
          >
            {nombreResponsable ?? 'Líder sin asignar'}
          </span>
        </span>
      </span>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-white/65" />
    </div>
  );
}

function ResumenPersonaRed({ persona, texto }: { persona?: PersonaEstructura; texto: string | null }) {
  const iniciales = persona ? inicialesPersona(persona) : null;
  const nombre = persona?.nombre?.trim() || persona?.correo || 'Sin asignar';

  if (texto === null) {
    return (
      <span className="flex min-w-0 items-center gap-2">
        <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[9px] font-bold text-slate-700">
          {iniciales ?? (persona ? <Mail className="h-3 w-3" aria-hidden="true" /> : <UserRound className="h-3 w-3" aria-hidden="true" />)}
          {persona && (
            <span
              className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white"
              style={{ backgroundColor: persona.membresiaPendiente ? '#94a3b8' : '#22c55e' }}
            />
          )}
        </span>
        <span title={nombre} className="min-w-0 truncate text-xs font-medium text-slate-800">{nombre}</span>
      </span>
    );
  }

  const capaSuave = `color-mix(in oklab, ${texto} 15%, transparent)`;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-bold" style={{ background: capaSuave, color: texto }}>
        {iniciales ?? (persona ? <Mail className="h-3 w-3" aria-hidden="true" /> : <UserRound className="h-3 w-3" aria-hidden="true" />)}
        {persona && (
          <span
            className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white"
            style={{ backgroundColor: persona.membresiaPendiente ? '#94a3b8' : '#22c55e' }}
          />
        )}
      </span>
      <span title={nombre} className="min-w-0 truncate text-xs font-medium" style={{ color: texto }}>
        {nombre}
      </span>
    </span>
  );
}

function NodoRed({ data, selected }: { data: DatosNodoEstructura; selected: boolean }) {
  const incompleto = Boolean(data.estadoIncompleto);
  const color = data.color ?? '#64748b';
  const texto = incompleto ? null : textoLegibleSobre(color);
  const capaSuave = texto ? `color-mix(in oklab, ${texto} 16%, transparent)` : undefined;
  const bordeSuave = texto ? `color-mix(in oklab, ${texto} 20%, transparent)` : undefined;
  const lider = data.responsables?.[0];
  const supervisor = data.supervisores?.[0];

  return (
    <div
      aria-selected={selected}
      className={`relative min-h-[190px] w-[235px] rounded-2xl border px-4 py-3 shadow-sm transition-all ${
        selected || data.resaltado
          ? 'border-white shadow-[0_0_0_3px_rgba(59,130,246,0.30)]'
          : incompleto
            ? 'border-slate-300 bg-slate-200 hover:border-slate-400 hover:shadow-md'
            : 'border-white/35 hover:border-white/70 hover:shadow-md'
      }`}
      style={texto ? { background: color } : undefined}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-white/65" />
      <div className="flex items-center gap-2.5">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${texto ? '' : 'bg-white text-slate-700'}`}
          style={texto ? { background: capaSuave, color: texto } : undefined}
        >
          <Network className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className={`block truncate text-sm font-bold ${texto ? '' : 'text-slate-950'}`} style={texto ? { color: texto } : undefined}>
            Red: &quot;{data.titulo}&quot;
          </span>
          {data.subtitulo && (
            <span className={`block truncate text-[11px] ${texto ? '' : 'text-slate-600'}`} style={texto ? { color: texto } : undefined}>
              {data.subtitulo}
            </span>
          )}
        </span>
      </div>
      <div className={`mt-3 border-t pt-2.5 ${texto ? '' : 'border-slate-300'}`} style={texto ? { borderColor: bordeSuave } : undefined}>
        <span className={`mb-1 block text-[9px] font-bold tracking-[0.12em] uppercase ${texto ? '' : 'text-slate-500'}`} style={texto ? { color: texto } : undefined}>
          Líder de Red
        </span>
        <ResumenPersonaRed persona={lider} texto={texto} />
      </div>
      <div className={`mt-2 border-t pt-2.5 ${texto ? '' : 'border-slate-300'}`} style={texto ? { borderColor: bordeSuave } : undefined}>
        <span className={`mb-1 block text-[9px] font-bold tracking-[0.12em] uppercase ${texto ? '' : 'text-slate-500'}`} style={texto ? { color: texto } : undefined}>
          Supervisor de Red
        </span>
        <ResumenPersonaRed persona={supervisor} texto={texto} />
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-0 !bg-white/65" />
    </div>
  );
}

export function NodoEstructura({ data, selected }: NodeProps<NodoVisual>) {
  const Icono = ICONOS[data.tipo];
  const esGrupo = data.tipo === 'GRUPO_DEPARTAMENTOS' || data.tipo === 'GRUPO_REDES';
  const color = data.color ?? (esGrupo ? '#334155' : '#2563eb');
  const [subliderVisible, setSubliderVisible] = useState<string | null>(null);

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

  if (data.tipo === 'NUEVA_CASA_DE_PAZ') {
    // Colores claros (ej. amarillo) elegidos libremente para la Red quedan
    // casi invisibles como texto/borde sobre fondo blanco -- se oscurecen
    // solo lo necesario para cumplir contraste (bug real 2026-08-07).
    const colorTexto = colorLegibleSobreBlanco(color);
    return (
      <div
        aria-selected={selected}
        className="flex h-11 w-[235px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 border-dashed text-xs font-semibold transition-colors hover:bg-white/40"
        style={{ borderColor: `color-mix(in oklab, ${colorTexto} 55%, transparent)`, color: colorTexto }}
      >
        <Handle type="target" position={Position.Top} className="!h-0 !w-0 !border-0 !bg-transparent" />
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        {data.titulo}
      </div>
    );
  }

  const esCasaDePaz = data.tipo === 'CASA_DE_PAZ';
  const incompleto = Boolean(data.estadoIncompleto);
  const colorIcono = colorLegibleSobreBlanco(color);

  return (
    <div
      aria-selected={selected}
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
          style={{ color: colorIcono, backgroundColor: `color-mix(in oklab, ${color} 12%, white)` }}
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
      {esCasaDePaz && (
        <div className="mt-2.5 flex items-center gap-1.5 border-t border-slate-100 pt-2.5">
          {(data.sublideres ?? []).map((sublider) => {
            const iniciales = inicialesPersona(sublider);
            return (
              <span key={sublider.id} className="relative">
                <button
                  type="button"
                  onClick={(evento) => {
                    evento.stopPropagation();
                    setSubliderVisible((actual) => (actual === sublider.id ? null : sublider.id));
                  }}
                  title={sublider.nombre?.trim() || sublider.correo || 'Sublíder'}
                  className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full bg-blue-50 text-[9px] font-bold text-blue-700 ring-2 ring-white hover:bg-blue-100"
                >
                  {iniciales ?? '?'}
                </button>
                {subliderVisible === sublider.id && (
                  <span className="absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-medium whitespace-nowrap text-white shadow-lg">
                    {sublider.nombre?.trim() || sublider.correo || 'Sublíder'}
                  </span>
                )}
              </span>
            );
          })}
          <span
            data-accion="anadir-sublider"
            className="cursor-pointer text-[11px] font-semibold text-blue-700 hover:text-blue-900"
          >
            + Añadir sublíder
          </span>
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-0 !bg-white/65" />
    </div>
  );
}
