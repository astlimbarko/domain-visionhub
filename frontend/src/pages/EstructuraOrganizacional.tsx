import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Link, useParams } from 'react-router-dom';
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useOnViewportChange,
  useNodesState,
  useReactFlow,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, Crosshair, Grip, Minus, Plus, Search, WandSparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth.store';
import { useRolUI } from '@/hooks/useRolUI';
import { AppLoadingScreen } from '@/components/ui/logo-spinner';
import { ROUTES } from '@/utils/constants';
import { crearGrafoEstructura } from '@/features/estructura-organizacional/layout';
import { NodoEstructura } from '@/features/estructura-organizacional/NodoEstructura';
import { PanelDetalleEstructura } from '@/features/estructura-organizacional/PanelDetalleEstructura';
import {
  useEstructuraOrganizacional,
  useGuardarPosicionesEstructura,
} from '@/features/estructura-organizacional/useEstructuraOrganizacional';
import type {
  DatosNodoEstructura,
  PosicionNodoGuardar,
} from '@/features/estructura-organizacional/types';

const nodeTypes = { estructura: NodoEstructura };

interface ContenidoProps {
  iglesiaId: string;
  nombreInicial: string;
}

function ContenidoEstructura({ iglesiaId, nombreInicial }: ContenidoProps) {
  const { data, isLoading, error } = useEstructuraOrganizacional(iglesiaId);
  const guardarPosiciones = useGuardarPosicionesEstructura(iglesiaId);
  const { fitView, zoomIn, zoomOut, setCenter } = useReactFlow<Node<DatosNodoEstructura>>();
  const [busqueda, setBusqueda] = useState('');
  const [zoom, setZoom] = useState(1);
  const [modoOrganizar, setModoOrganizar] = useState(false);
  const [nodoSeleccionadoId, setNodoSeleccionadoId] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<DatosNodoEstructura>>([]);
  const pendientesRef = useRef(new Map<string, PosicionNodoGuardar>());
  const temporizadorRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useOnViewportChange({ onChange: (viewport) => setZoom(viewport.zoom) });

  const grafoBase = useMemo(() => {
    if (!data) return { nodes: [], edges: [] };
    return crearGrafoEstructura(data);
  }, [data]);

  useEffect(() => {
    setNodes(grafoBase.nodes);
  }, [grafoBase.nodes, setNodes]);

  useEffect(() => () => {
    if (temporizadorRef.current) clearTimeout(temporizadorRef.current);
  }, []);

  const nodesVisibles = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase('es');
    if (termino.length < 2) return nodes;
    return nodes.map((node) => ({
        ...node,
        data: { ...node.data, resaltado: node.data.buscable.includes(termino) },
      }));
  }, [busqueda, nodes]);

  const persistirPendientes = () => {
    if (!data || pendientesRef.current.size === 0) return;
    const nodos = [...pendientesRef.current.values()];
    pendientesRef.current.clear();
    guardarPosiciones.mutate(
      { nodos, version: data.layout.version },
      {
        onSuccess: () => toast.success('Organización guardada'),
        onError: (fallo) => {
          toast.error(
            fallo.message.includes('ESTRUCTURA_LAYOUT_DESACTUALIZADO')
              ? 'La estructura cambió en otra sesión; se recargará.'
              : 'No se pudo guardar la organización.',
          );
        },
      },
    );
  };

  const programarGuardado = (node: Node<DatosNodoEstructura>) => {
    const partes = node.id.split(':');
    const entidadId = partes.length === 2 && !node.id.startsWith('casa-vacia:') ? partes[1] : null;
    pendientesRef.current.set(node.id, {
      nodo_clave: node.id,
      tipo_nodo: node.data.tipo,
      entidad_id: entidadId,
      posicion_x: Math.round(node.position.x / 16) * 16,
      posicion_y: Math.round(node.position.y / 16) * 16,
    });
    if (temporizadorRef.current) clearTimeout(temporizadorRef.current);
    temporizadorRef.current = setTimeout(persistirPendientes, 400);
  };

  const centrarBusqueda = () => {
    const coincidencia = nodesVisibles.find((node) => node.data.resaltado);
    if (!coincidencia) return;
    void setCenter(coincidencia.position.x + 125, coincidencia.position.y + 45, {
      zoom: Math.max(zoom, 0.9),
      duration: 450,
    });
  };

  const nombreIglesia = data?.iglesia.nombre ?? nombreInicial;
  const nodoSeleccionado = nodesVisibles.find((node) => node.id === nodoSeleccionadoId)?.data;

  return (
    <div className="flex h-svh flex-col bg-[#eef1f6]">
      <header className="z-20 flex flex-wrap items-center gap-4 border-b border-white/10 bg-[#0a0e1a] px-4 py-3 sm:px-6">
        <Link
          to={ROUTES.ADMINISTRACION}
          aria-label="Volver a Administración"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex min-w-0 shrink items-center gap-2.5">
          <img src="/logo.png" alt="" className="h-8 w-8 shrink-0 rounded-lg object-contain brightness-0 invert" />
          <span className="flex max-w-52 min-w-0 items-baseline gap-1.5 text-[15px] text-white sm:max-w-72">
            <span className="shrink-0 font-bold">Iglesia</span>
            <span className="truncate font-normal text-white/75">{nombreIglesia}</span>
          </span>
        </div>
        <div className="hidden h-8 w-px shrink-0 bg-white/15 sm:block" />
        <div className="hidden min-w-0 md:block">
          <h1 className="truncate text-base font-bold text-white">Estructura Organizacional</h1>
          <p className="truncate text-left text-xs font-medium text-white/55">Vista general de la iglesia</p>
        </div>
        <div className="ml-auto flex flex-1 flex-wrap items-center justify-end gap-2 sm:flex-none">
          <form
            className="relative order-last w-full sm:order-none sm:w-auto"
            onSubmit={(evento) => {
              evento.preventDefault();
              centrarBusqueda();
            }}
          >
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              placeholder="Buscar persona o entidad"
              aria-label="Buscar persona o entidad"
              className="h-10 w-full rounded-xl border border-white/15 bg-white/5 pr-3 pl-9 text-[13px] text-white placeholder:text-white/40 outline-none focus-visible:border-white/30 sm:w-64"
            />
          </form>
          <button
            type="button"
            onClick={() => void fitView({ padding: 0.16, duration: 500 })}
            className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-white/15 px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-white/5"
          >
            <Crosshair className="h-4 w-4" /> <span className="hidden sm:inline">Centrar estructura</span>
          </button>
          <button
            type="button"
            disabled={!data?.layout.disponible || guardarPosiciones.isPending}
            title={data?.layout.disponible ? 'Mover y guardar nodos' : 'Disponible al aplicar los cimientos de base'}
            onClick={() => setModoOrganizar((actual) => !actual)}
            className={`flex h-10 cursor-pointer items-center gap-2 rounded-xl border px-3.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
              modoOrganizar
                ? 'border-blue-400 bg-blue-500/20 text-blue-100'
                : 'border-white/15 text-white hover:bg-white/5'
            }`}
          >
            <Grip className="h-4 w-4" />
            <span className="hidden lg:inline">{modoOrganizar ? 'Organizando' : 'Modo organizar'}</span>
          </button>
          {modoOrganizar && (
            <button
              type="button"
              onClick={() => {
                if (!data || !window.confirm('¿Reorganizar automáticamente todos los nodos?')) return;
                const automatico = crearGrafoEstructura({
                  ...data,
                  layout: { ...data.layout, posiciones: [] },
                });
                setNodes(automatico.nodes);
                automatico.nodes.forEach(programarGuardado);
              }}
              className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-white/15 px-3 text-[13px] font-medium text-white hover:bg-white/5"
            >
              <WandSparkles className="h-4 w-4" />
              <span className="hidden xl:inline">Organizar automáticamente</span>
            </button>
          )}
          <div className="flex h-10 items-center gap-1 rounded-xl border border-white/15 px-1.5 text-white">
            <button
              type="button"
              aria-label="Alejar"
              onClick={() => void zoomOut({ duration: 200 })}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-white/10"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-10 text-center text-[13px] tabular-nums">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              aria-label="Acercar"
              onClick={() => void zoomIn({ duration: 200 })}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-white/10"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="relative min-h-0 flex-1">
        {isLoading && <AppLoadingScreen />}
        {error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
            <div className="max-w-md rounded-2xl border border-red-200 bg-white p-5 text-center shadow-sm">
              <p className="font-semibold text-slate-900">No se pudo cargar la estructura</p>
              <p className="mt-1 text-sm text-slate-500">{error.message}</p>
            </div>
          </div>
        )}
        {!isLoading && !error && (
          <ReactFlow
            nodes={nodesVisibles}
            edges={grafoBase.edges}
            onNodesChange={onNodesChange}
            onNodeClick={(_evento, node) => setNodoSeleccionadoId(node.id)}
            onPaneClick={() => setNodoSeleccionadoId(null)}
            onNodeDragStop={(_evento, node) => programarGuardado(node)}
            nodeTypes={nodeTypes}
            nodesDraggable={modoOrganizar && !guardarPosiciones.isPending}
            nodesConnectable={false}
            elementsSelectable
            fitView
            fitViewOptions={{ padding: 0.16 }}
            minZoom={0.25}
            maxZoom={1.8}
            snapToGrid
            snapGrid={[16, 16]}
            panOnScroll
            selectionOnDrag={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#cbd5e1" />
            {nodesVisibles.length > 20 && (
              <MiniMap
                pannable
                zoomable
                className="!rounded-xl !border !border-slate-200 !bg-white/90 !shadow-sm"
                nodeColor={(node) => (node.data?.color as string | undefined) ?? '#64748b'}
              />
            )}
          </ReactFlow>
        )}
        {nodoSeleccionado && (
          <PanelDetalleEstructura nodo={nodoSeleccionado} onClose={() => setNodoSeleccionadoId(null)} />
        )}
      </main>
    </div>
  );
}

export function EstructuraOrganizacional() {
  const { iglesiaId } = useParams<{ iglesiaId: string }>();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const iglesias = useAuthStore((state) => state.iglesias);
  const rolUI = useRolUI();

  if (!isAuthenticated) return <Navigate to={ROUTES.LOGIN} replace />;
  if (rolUI === null) return <AppLoadingScreen />;
  if (rolUI !== 'SUPER_ADMIN' && rolUI !== 'SUPERVISOR') {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }
  if (!iglesiaId) return <Navigate to={ROUTES.ADMINISTRACION} replace />;

  const iglesia = iglesias.find((item) => item.id === iglesiaId);

  return (
    <ReactFlowProvider>
      <ContenidoEstructura iglesiaId={iglesiaId} nombreInicial={iglesia?.nombre ?? 'Iglesia'} />
    </ReactFlowProvider>
  );
}
