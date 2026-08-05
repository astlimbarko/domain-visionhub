import type { Edge, Node } from '@xyflow/react';
import type {
  DatosNodoEstructura,
  DepartamentoEstructura,
  EstructuraOrganizacionalDatos,
  PersonaEstructura,
} from './types';
import { DEPARTAMENTO_META } from '@/utils/departamentos';

const PALETA_RED_PROVISIONAL = ['#2563EB', '#7C3AED', '#0891B2', '#059669', '#EA580C', '#DB2777'];

function colorRedVisible(color: string | null | undefined, indice: number): string {
  const normalizado = color?.trim().toUpperCase();
  if (!normalizado || normalizado === '#FFFFFF' || normalizado === '#FFF') {
    return PALETA_RED_PROVISIONAL[indice % PALETA_RED_PROVISIONAL.length];
  }
  return color as string;
}

const DEPARTAMENTOS_OFICIALES: DepartamentoEstructura[] = [
  { id: 'slot-evangelismo', codigo: 'EVANGELISMO', nombre: 'Evangelismo', color: null, lideres: [] },
  { id: 'slot-afirmacion', codigo: 'AFIRMACION', nombre: 'Afirmación', color: null, lideres: [] },
  { id: 'slot-discipulado', codigo: 'DISCIPULADO', nombre: 'Discipulado', color: null, lideres: [] },
  { id: 'slot-envio', codigo: 'ENVIO', nombre: 'Envío', color: null, lideres: [] },
];

function resumenResponsables(responsables: { etiqueta: string; membresiaPendiente: boolean }[], vacio: string): string {
  if (responsables.length === 0) return vacio;
  const principal = responsables[0];
  const pendiente = principal.membresiaPendiente ? ' · membresía pendiente' : '';
  const adicionales = responsables.length > 1 ? ` +${responsables.length - 1}` : '';
  return `${principal.etiqueta}${adicionales}${pendiente}`;
}

function nodo(
  id: string,
  x: number,
  y: number,
  data: {
    tipo: DatosNodoEstructura['tipo'];
    titulo: string;
    subtitulo?: string;
    etiquetaRol?: string;
    responsables?: PersonaEstructura[];
    supervisores?: PersonaEstructura[];
    color?: string;
    ancho?: number;
    alto?: number;
    buscable?: string;
    resaltado?: boolean;
    estadoIncompleto?: boolean;
  },
): Node<DatosNodoEstructura> {
  const esSeccion = data.tipo === 'GRUPO_DEPARTAMENTOS' || data.tipo === 'GRUPO_REDES';
  return {
    id,
    type: 'estructura',
    position: { x, y },
    selectable: !esSeccion,
    draggable: esSeccion ? false : undefined,
    data: {
      ...data,
      buscable: (data.buscable ?? `${data.titulo} ${data.subtitulo ?? ''}`).toLocaleLowerCase('es'),
    },
  };
}

function arista(id: string, source: string, target: string, color = '#94a3b8'): Edge {
  return {
    id,
    source,
    target,
    type: 'smoothstep',
    selectable: false,
    style: { stroke: color, strokeWidth: 1.5 },
  };
}

export function crearGrafoEstructura(datos: EstructuraOrganizacionalDatos): {
  nodes: Node<DatosNodoEstructura>[];
  edges: Edge[];
} {
  const nodes: Node<DatosNodoEstructura>[] = [];
  const edges: Edge[] = [];
  const maximoCasasPorRed = Math.max(
    0,
    ...datos.redes.map((red) => datos.casasDePaz.filter((casa) => casa.redId === red.id).length),
  );
  const cantidadColumnasRed = Math.max(datos.redes.length, 1);
  const anchoGrupoRedes = Math.max(535, 50 + cantidadColumnasRed * 270);
  const altoGrupoRedes = 300 + maximoCasasPorRed * 110;

  nodes.push(
    nodo('pastor', 0, 0, {
      tipo: 'PASTOR_SLOT',
      titulo: 'Pastor',
      subtitulo: resumenResponsables(datos.pastores, 'Pastor sin asignar'),
      etiquetaRol: 'Pastor',
      responsables: datos.pastores,
      buscable: `Pastor ${datos.pastores.map((persona) => `${persona.etiqueta} ${persona.correo ?? ''}`).join(' ')}`,
    }),
    nodo('supervisor', 285, 0, {
      tipo: 'SUPERVISOR_SLOT',
      titulo: 'Supervisor de la Visión en Acción',
      subtitulo: resumenResponsables(datos.supervisores, 'Supervisor sin asignar'),
      etiquetaRol: 'Supervisor',
      responsables: datos.supervisores,
      buscable: `Supervisor de la Visión en Acción ${datos.supervisores.map((persona) => `${persona.etiqueta} ${persona.correo ?? ''}`).join(' ')}`,
    }),
    nodo('grupo-departamentos', 590, -250, {
      tipo: 'GRUPO_DEPARTAMENTOS',
      titulo: 'Departamentos',
      ancho: 1035,
      alto: 190,
    }),
    nodo('grupo-redes', 590, 100, {
      tipo: 'GRUPO_REDES',
      titulo: 'Redes de Casas de Paz',
      subtitulo: datos.redes.length === 0 ? 'Sin redes creadas' : `${datos.redes.length} redes`,
      ancho: anchoGrupoRedes,
      alto: altoGrupoRedes,
    }),
  );
  edges.push(
    arista('pastor-supervisor', 'pastor', 'supervisor'),
    arista('supervisor-departamentos', 'supervisor', 'grupo-departamentos'),
    arista('supervisor-redes', 'supervisor', 'grupo-redes'),
  );

  const departamentos = DEPARTAMENTOS_OFICIALES.map((oficial) =>
    datos.departamentos.find((departamento) => departamento.codigo.toUpperCase() === oficial.codigo) ?? oficial,
  );
  departamentos.forEach((departamento, indice) => {
    const id = `departamento:${departamento.id}`;
    const codigo = departamento.codigo.toUpperCase();
    nodes.push(
      nodo(id, 610 + indice * 250, -165, {
        tipo: 'DEPARTAMENTO',
        titulo: departamento.nombre,
        subtitulo: resumenResponsables(departamento.lideres, 'Líder sin asignar'),
        responsables: departamento.lideres,
        color: departamento.color ?? DEPARTAMENTO_META[codigo]?.color ?? '#64748b',
        buscable: `${departamento.nombre} ${departamento.lideres.map((persona) => `${persona.etiqueta} ${persona.correo ?? ''}`).join(' ')}`,
        estadoIncompleto: departamento.lideres.length === 0,
      }),
    );
  });

  if (datos.redes.length === 0) {
    nodes.push(
      nodo('redes-vacio', 615, 175, {
        tipo: 'RED',
        titulo: 'Primera Red',
        subtitulo: 'Crea una Red cuando la iglesia la necesite',
        color: '#94a3b8',
        estadoIncompleto: true,
      }),
    );
  } else {
    for (const [indiceRed, red] of datos.redes.entries()) {
      const casas = datos.casasDePaz.filter((casa) => casa.redId === red.id);
      const colorRed = colorRedVisible(red.color, indiceRed);
      const redSinNombre = !red.nombre?.trim();
      const redSinLider = red.lideres.length === 0;
      const redX = 615 + indiceRed * 270;
      const redId = `red:${red.id}`;
      nodes.push(
        nodo(redId, redX, 175, {
          tipo: 'RED',
          titulo: red.nombre?.trim() || `Red ${String(indiceRed + 1).padStart(2, '0')}`,
          subtitulo: redSinNombre ? 'Escribe un nombre' : `${casas.length} Casas de Paz`,
          responsables: red.lideres,
          supervisores: red.supervisores,
          color: colorRed,
          buscable: `${red.nombre ?? ''} ${red.lideres.map((persona) => `${persona.etiqueta} ${persona.correo ?? ''}`).join(' ')} ${red.supervisores.map((persona) => `${persona.etiqueta} ${persona.correo ?? ''}`).join(' ')}`,
          estadoIncompleto: redSinNombre && redSinLider,
        }),
      );

      casas.forEach((casa, indice) => {
          const casaId = `casa:${casa.id}`;
          const casaY = 405 + indice * 110;
          const casaSinNombre = !casa.nombre?.trim();
          const casaSinLider = casa.lideres.length === 0;
          nodes.push(
            nodo(casaId, redX, casaY, {
              tipo: 'CASA_DE_PAZ',
              titulo: casa.nombre?.trim() || `Casa de Paz ${String(indice + 1).padStart(2, '0')}`,
              subtitulo: casaSinNombre && casaSinLider
                ? 'Escribe un nombre · Asigna un líder'
                : casaSinNombre
                  ? `Escribe un nombre · ${resumenResponsables(casa.lideres, '')}`
                  : resumenResponsables(casa.lideres, 'Asigna un líder'),
              color: colorRed,
              estadoIncompleto: casaSinNombre && casaSinLider,
            }),
          );
          edges.push(arista(`${redId}-${casaId}`, redId, casaId, colorRed));
      });
    }
  }

  const posiciones = new Map(
    datos.layout.posiciones.map((posicion) => [
      posicion.nodo_clave,
      { x: posicion.posicion_x, y: posicion.posicion_y },
    ]),
  );

  return {
    nodes: nodes.map((node) => ({ ...node, position: posiciones.get(node.id) ?? node.position })),
    edges,
  };
}
