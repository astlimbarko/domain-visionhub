import type { Edge, Node } from '@xyflow/react';
import type { DatosNodoEstructura, DepartamentoEstructura, EstructuraOrganizacionalDatos } from './types';

const COLORES_DEPARTAMENTO: Record<string, string> = {
  EVANGELISMO: '#F5C518',
  AFIRMACION: '#0071E3',
  DISCIPULADO: '#FF3B30',
  ENVIO: '#8E8E93',
};

const PALETA_RED_PROVISIONAL = ['#2563EB', '#7C3AED', '#0891B2', '#059669', '#EA580C', '#DB2777'];

function colorRedVisible(color: string | null | undefined, indice: number): string {
  const normalizado = color?.trim().toUpperCase();
  if (!normalizado || normalizado === '#FFFFFF' || normalizado === '#FFF') {
    return PALETA_RED_PROVISIONAL[indice % PALETA_RED_PROVISIONAL.length];
  }
  return color as string;
}

const DEPARTAMENTOS_OFICIALES: DepartamentoEstructura[] = [
  { id: 'slot-evangelismo', codigo: 'EVANGELISMO', nombre: 'Evangelismo', lideres: [] },
  { id: 'slot-afirmacion', codigo: 'AFIRMACION', nombre: 'Afirmación', lideres: [] },
  { id: 'slot-discipulado', codigo: 'DISCIPULADO', nombre: 'Discipulado', lideres: [] },
  { id: 'slot-envio', codigo: 'ENVIO', nombre: 'Envío', lideres: [] },
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
    color?: string;
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

  nodes.push(
    nodo('pastor', 0, 0, {
      tipo: 'PASTOR_SLOT',
      titulo: 'Pastor',
      subtitulo: resumenResponsables(datos.pastores, 'Pastor sin asignar'),
    }),
    nodo('supervisor', 285, 0, {
      tipo: 'SUPERVISOR_SLOT',
      titulo: 'Supervisor de la Visión',
      subtitulo: resumenResponsables(datos.supervisores, 'Supervisor sin asignar'),
    }),
    nodo('grupo-departamentos', 555, -190, {
      tipo: 'GRUPO_DEPARTAMENTOS',
      titulo: 'Departamentos',
      subtitulo: '4 departamentos oficiales',
    }),
    nodo('grupo-redes', 555, 190, {
      tipo: 'GRUPO_REDES',
      titulo: 'Redes de Casas de Paz',
      subtitulo: datos.redes.length === 0 ? 'Sin redes creadas' : `${datos.redes.length} redes`,
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
    nodes.push(
      nodo(id, 805, -350 + indice * 104, {
        tipo: 'DEPARTAMENTO',
        titulo: departamento.nombre,
        subtitulo: resumenResponsables(departamento.lideres, 'Líder sin asignar'),
        color: COLORES_DEPARTAMENTO[departamento.codigo.toUpperCase()] ?? '#64748b',
      }),
    );
    edges.push(arista(`grupo-departamentos-${id}`, 'grupo-departamentos', id));
  });

  if (datos.redes.length === 0) {
    nodes.push(
      nodo('redes-vacio', 805, 190, {
        tipo: 'RED',
        titulo: 'Sin redes',
        subtitulo: 'La primera Red puede crearse después',
        color: '#94a3b8',
      }),
    );
    edges.push(arista('grupo-redes-vacio', 'grupo-redes', 'redes-vacio'));
  } else {
    let cursorY = 80;
    for (const [indiceRed, red] of datos.redes.entries()) {
      const casas = datos.casasDePaz.filter((casa) => casa.redId === red.id);
      const colorRed = colorRedVisible(red.color, indiceRed);
      const redSinNombre = !red.nombre?.trim();
      const redSinLider = red.lideres.length === 0;
      const altoBloque = Math.max(130, casas.length * 110);
      const redY = cursorY + (altoBloque - 90) / 2;
      const redId = `red:${red.id}`;
      nodes.push(
        nodo(redId, 805, redY, {
          tipo: 'RED',
          titulo: red.nombre?.trim() || `Red ${String(indiceRed + 1).padStart(2, '0')}`,
          subtitulo: redSinNombre && redSinLider
            ? 'Escribe un nombre · Asigna un líder'
            : redSinNombre
              ? `Escribe un nombre · ${resumenResponsables(red.lideres, '')}`
              : `${resumenResponsables(red.lideres, 'Asigna un líder')} · ${casas.length} CdP`,
          color: colorRed,
          estadoIncompleto: redSinNombre && redSinLider,
        }),
      );
      edges.push(arista(`grupo-redes-${redId}`, 'grupo-redes', redId, colorRed));

      if (casas.length === 0) {
        const casaId = `casa-vacia:${red.id}`;
        nodes.push(
          nodo(casaId, 1080, redY, {
            tipo: 'CASA_DE_PAZ',
            titulo: 'Sin Casas de Paz',
            subtitulo: 'Puede crearse sin líder',
            color: colorRed,
          }),
        );
        edges.push(arista(`${redId}-${casaId}`, redId, casaId, colorRed));
      } else {
        casas.forEach((casa, indice) => {
          const casaId = `casa:${casa.id}`;
          const casaY = cursorY + indice * 110;
          const casaSinNombre = !casa.nombre?.trim();
          const casaSinLider = casa.lideres.length === 0;
          nodes.push(
            nodo(casaId, 1080, casaY, {
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
      cursorY += altoBloque + 50;
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
