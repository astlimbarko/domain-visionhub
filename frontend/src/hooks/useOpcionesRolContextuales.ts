/**
 * Opciones visuales del selector multirol. Cada fila representa una
 * asignacion real y conserva su ContextoActivo completo.
 */
import type { LucideIcon } from 'lucide-react';
import { HeartHandshake, MapPin, User } from 'lucide-react';
import { useQueries } from '@tanstack/react-query';
import { DEPARTAMENTO_META } from '@/utils/departamentos';
import { useAuthStore } from '@/store/auth.store';
import { obtenerMisRoles } from '@/services/dashboard.service';
import { construirContextosDisponibles } from '@/utils/contextos-disponibles';
import { ordenarIglesiasPorJerarquia } from '@/utils/ordenar-iglesias';
import type { ContextoActivo } from '@/types/contexto-activo.types';
import type { RolUI } from '@/utils/permisos';
import type { CargoCdpDashboard, MisRolesDashboard } from '@/types/dashboard.types';
import type { IglesiaAccesible } from '@/types/auth.types';
import { COLOR_RED_NEUTRO, FILA_ROL_VISUAL } from '@/utils/seleccionar-rol-visual';

export interface LineaSecundaria {
  icon?: LucideIcon;
  texto: string;
}

export interface OpcionRolContextual {
  key: string;
  rolUI: RolUI;
  contexto: ContextoActivo;
  titulo: string;
  icon: LucideIcon;
  bgIcono: string;
  colorIcono: string;
  lineas: LineaSecundaria[];
  /** KAN-442: null para SUPER_ADMIN (sin iglesia); se usa para agrupar
   * visualmente las filas por iglesia en el selector cuando la cuenta tiene
   * acceso a más de una. */
  iglesiaId: string | null;
  iglesiaNombre: string | null;
  /** Solo Líder de Red: color real de la red para el punto junto a la flecha. */
  colorRed?: string;
  /** Ícono propio (SVG con su fondo circular ya incluido, ej. Evangelismo) --
   * si viene, `OpcionRolFila` lo usa en vez de armar el círculo con
   * `icon`/`bgIcono`/`colorIcono` (ese SVG ya trae su propio color de fondo,
   * no es un ícono de línea neutro para tintar). */
  iconoSvg?: string;
}

function construirOpcionCdp(cdp: CargoCdpDashboard, esSublider: boolean, iglesia: IglesiaAccesible): OpcionRolContextual {
  const iglesiaId = iglesia.id;
  const v = esSublider ? FILA_ROL_VISUAL.SUBLIDER_CDP : FILA_ROL_VISUAL.LIDER_CDP;
  const lineas: LineaSecundaria[] = [];
  if (cdp.anfitrion_nombre) lineas.push({ icon: User, texto: cdp.anfitrion_nombre });
  if (cdp.direccion) lineas.push({ icon: MapPin, texto: cdp.direccion });
  if (lineas.length === 0) lineas.push({ texto: cdp.etiqueta });

  return {
    key: `${esSublider ? 'SUBLIDER_CDP' : 'LIDER_CDP'}:${iglesiaId}:${cdp.id}`,
    rolUI: esSublider ? 'SUBLIDER_CDP' : 'LIDER_CDP',
    contexto: {
      clave: `${esSublider ? 'SUBLIDER_CDP' : 'LIDER_CDP'}:${iglesiaId}:${cdp.id}`,
      rolUI: esSublider ? 'SUBLIDER_CDP' : 'LIDER_CDP',
      alcance: 'CDP',
      iglesiaId,
      redId: cdp.red_id,
      cdpId: cdp.id,
    },
    titulo: v.titulo,
    icon: v.icon,
    bgIcono: v.bgIcono,
    colorIcono: v.colorIcono,
    lineas,
    iglesiaId,
    iglesiaNombre: iglesia.nombre,
  };
}

/** KAN-442: arma las opciones de UNA iglesia -- antes esta lógica vivía
 * inline en el hook, atada a la única `iglesiaActivaId`. */
function construirOpcionesIglesia(iglesia: IglesiaAccesible, roles: MisRolesDashboard): OpcionRolContextual[] {
  const opciones: OpcionRolContextual[] = [];
  const iglesiaId = iglesia.id;
  const iglesiaNombre = iglesia.nombre;

  if (iglesia.es_pastor) {
    const v = FILA_ROL_VISUAL.PASTOR;
    opciones.push({
      key: `PASTOR:${iglesiaId}`, rolUI: 'PASTOR', titulo: v.titulo, icon: v.icon, bgIcono: v.bgIcono, colorIcono: v.colorIcono,
      contexto: { clave: `PASTOR:${iglesiaId}`, rolUI: 'PASTOR', alcance: 'IGLESIA', iglesiaId },
      lineas: [], iglesiaId, iglesiaNombre,
    });
  }

  if (iglesia.es_operativo) {
    const v = FILA_ROL_VISUAL.SUPERVISOR;
    opciones.push({
      key: `SUPERVISOR:${iglesiaId}`, rolUI: 'SUPERVISOR', titulo: v.titulo, icon: v.icon, bgIcono: v.bgIcono, colorIcono: v.colorIcono,
      contexto: { clave: `SUPERVISOR:${iglesiaId}`, rolUI: 'SUPERVISOR', alcance: 'IGLESIA', iglesiaId },
      lineas: [], iglesiaId, iglesiaNombre,
    });
  }

  // Líder de Red va arriba de Supervisor de Red dentro de este grupo
  // (pedido explícito del owner, 2026-08-13). Ordenamiento estable: no
  // reordena entre sí a dos redes del mismo tipo de cargo, solo pospone
  // las de es_sublider.
  const redesOrdenadas = [...(roles.redes_lider ?? [])].sort((a, b) => Number(a.es_sublider) - Number(b.es_sublider));
  for (const red of redesOrdenadas) {
    const v = FILA_ROL_VISUAL.LIDER_RED;
    const cargoRed = red.es_sublider ? 'SUPERVISOR' : 'LIDER';
    const clave = `${cargoRed === 'SUPERVISOR' ? 'SUPERVISOR_RED' : 'LIDER_RED'}:${iglesiaId}:${red.id}`;
    opciones.push({
      key: clave, rolUI: 'LIDER_RED',
      contexto: { clave, rolUI: 'LIDER_RED', alcance: 'RED', iglesiaId, redId: red.id, cargoRed },
      titulo: red.es_sublider ? 'Supervisor de Red' : v.titulo,
      icon: v.icon, bgIcono: v.bgIcono, colorIcono: v.colorIcono,
      lineas: [{ texto: red.nombre }],
      colorRed: red.color && red.color.toUpperCase() !== '#FFFFFF' ? red.color : COLOR_RED_NEUTRO,
      iglesiaId, iglesiaNombre,
    });
  }

  for (const cdp of roles.cdp_lider ?? []) opciones.push(construirOpcionCdp(cdp, false, iglesia));
  for (const cdp of roles.cdp_sublider ?? []) opciones.push(construirOpcionCdp(cdp, true, iglesia));

  if (iglesia.es_lider_afirmacion) {
    const v = FILA_ROL_VISUAL.LIDER_DEPARTAMENTO;
    opciones.push({
      key: `LIDER_DEPARTAMENTO:${iglesiaId}:AFIRMACION`, rolUI: 'LIDER_DEPARTAMENTO', titulo: v.titulo, icon: v.icon, bgIcono: v.bgIcono, colorIcono: v.colorIcono,
      // Ícono propio (mismo patrón del de Evangelismo) en vez del genérico --
      // pedido explícito del owner, 2026-09-09.
      iconoSvg: '/icono-afirmacion.svg',
      contexto: { clave: `LIDER_DEPARTAMENTO:${iglesiaId}:AFIRMACION`, rolUI: 'LIDER_DEPARTAMENTO', alcance: 'DEPARTAMENTO', iglesiaId, departamentoId: null, departamentoCodigo: 'AFIRMACION' },
      lineas: [], iglesiaId, iglesiaNombre,
    });
  }

  if (iglesia.es_lider_evangelismo) {
    opciones.push({
      key: `LIDER_DEPARTAMENTO:${iglesiaId}:EVANGELISMO`, rolUI: 'LIDER_DEPARTAMENTO',
      titulo: 'Dpto. de Evangelismo', icon: HeartHandshake,
      bgIcono: '#fdf3d6', colorIcono: DEPARTAMENTO_META.EVANGELISMO.color,
      // Ícono propio (mismo SVG del banner de Evangelismo) en vez del
      // corazón genérico -- pedido explícito del owner, 2026-09-08.
      iconoSvg: '/icono-evangelismo.svg',
      contexto: { clave: `LIDER_DEPARTAMENTO:${iglesiaId}:EVANGELISMO`, rolUI: 'LIDER_DEPARTAMENTO', alcance: 'DEPARTAMENTO', iglesiaId, departamentoId: null, departamentoCodigo: 'EVANGELISMO' },
      lineas: [], iglesiaId, iglesiaNombre,
    });
  }

  if (iglesia.es_lider_jovenes) {
    const v = FILA_ROL_VISUAL.LIDER_JOVENES;
    opciones.push({
      key: `LIDER_JOVENES:${iglesiaId}`, rolUI: 'LIDER_JOVENES', contexto: { clave: `LIDER_JOVENES:${iglesiaId}`, rolUI: 'LIDER_JOVENES', alcance: 'IGLESIA', iglesiaId },
      titulo: v.titulo, icon: v.icon, bgIcono: v.bgIcono, colorIcono: v.colorIcono, lineas: [], iglesiaId, iglesiaNombre,
    });
  }

  if (iglesia.es_encargado_matrimonios) {
    const v = FILA_ROL_VISUAL.ENCARGADO_MATRIMONIOS;
    opciones.push({
      key: `ENCARGADO_MATRIMONIOS:${iglesiaId}`, rolUI: 'ENCARGADO_MATRIMONIOS', contexto: { clave: `ENCARGADO_MATRIMONIOS:${iglesiaId}`, rolUI: 'ENCARGADO_MATRIMONIOS', alcance: 'IGLESIA', iglesiaId },
      titulo: v.titulo, icon: v.icon, bgIcono: v.bgIcono, colorIcono: v.colorIcono, lineas: [], iglesiaId, iglesiaNombre,
    });
  }

  return opciones;
}

const OPCION_SUPER_ADMIN: OpcionRolContextual = (() => {
  const v = FILA_ROL_VISUAL.SUPER_ADMIN;
  return {
    key: 'SUPER_ADMIN', rolUI: 'SUPER_ADMIN', titulo: v.titulo, icon: v.icon, bgIcono: v.bgIcono, colorIcono: v.colorIcono,
    contexto: { clave: 'SUPER_ADMIN', rolUI: 'SUPER_ADMIN', alcance: 'GLOBAL' },
    lineas: [{ texto: 'Administración general del sistema' }],
    iglesiaId: null, iglesiaNombre: null,
  };
})();

export function useOpcionesRolContextuales(): OpcionRolContextual[] | undefined {
  const esSuperAdmin = useAuthStore((s) => s.esSuperAdmin);
  const iglesiasRaw = useAuthStore((s) => s.iglesias);
  // KAN-442: madre arriba, satélites justo después de su madre -- pedido
  // explícito del owner (2026-09-25). El orden de este array es el mismo
  // que usan tanto las queries de abajo como el agrupado visual del
  // selector (GrupoOpcionesRol), así que alcanza con ordenar acá una vez.
  const iglesias = ordenarIglesiasPorJerarquia(iglesiasRaw);

  // KAN-442: antes esto solo pedía los roles de `iglesiaActivaId` -- una
  // cuenta con rol operativo en más de una iglesia (ej. iglesia madre +
  // satélite) nunca veía los roles de la iglesia que no quedó "activa" por
  // default (elegirIglesiaPorDefecto ordena alfabético por nombre, no por lo
  // que la persona esperaba ver). Ahora se piden los roles de TODAS las
  // iglesias accesibles en paralelo -- mismo queryKey que useMisRoles, así
  // que reusa la misma caché si alguna ya se pidió antes.
  const resultadosPorIglesia = useQueries({
    queries: iglesias.map((i) => ({
      queryKey: ['dashboard', 'mis-roles', i.id],
      queryFn: () => obtenerMisRoles(i.id),
    })),
  });

  // Caso límite del Super Admin sin ninguna iglesia asociada: no tiene nada
  // que desambiguar por iglesia, solo su propio contexto global.
  if (esSuperAdmin && iglesias.length === 0) {
    return [OPCION_SUPER_ADMIN];
  }

  const cargando = resultadosPorIglesia.some((r) => r.isLoading);
  if (cargando || resultadosPorIglesia.some((r) => !r.data)) return undefined;

  const opciones: OpcionRolContextual[] = [];

  if (esSuperAdmin) {
    opciones.push(OPCION_SUPER_ADMIN);
  }

  iglesias.forEach((iglesia, i) => {
    const roles = resultadosPorIglesia[i]?.data as MisRolesDashboard | undefined;
    if (!roles) return;
    // Mismo chequeo de consistencia que había antes (contexto construido a
    // mano vs. el canónico de construirContextosDisponibles) -- ahora por
    // iglesia, para no filtrar por error las opciones de una iglesia que no
    // sea la activa.
    const contextosDisponiblesIglesia = construirContextosDisponibles({ esSuperAdmin: false, iglesia, roles });
    for (const opcion of construirOpcionesIglesia(iglesia, roles)) {
      const contexto = contextosDisponiblesIglesia.find((item) => item.clave === opcion.key);
      if (contexto) opciones.push({ ...opcion, contexto });
    }
  });

  return opciones;
}
