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
import { ArrowLeft, Crosshair, Download, Minus, Network, Plus, Search, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth.store';
import { useRolUI } from '@/hooks/useRolUI';
import { useMisRoles } from '@/hooks/useDashboard';
import { AppLoadingScreen } from '@/components/ui/logo-spinner';
import { CampoOtp } from '@/components/shared/CampoOtp';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ROUTES } from '@/utils/constants';
import { crearGrafoEstructura } from '@/features/estructura-organizacional/layout';
import { descargarLienzoComoPng } from '@/features/estructura-organizacional/exportarLienzo';
import { PanelCasaDePazEstructura } from '@/features/estructura-organizacional/PanelCasaDePazEstructura';
import { PanelDepartamentoEstructura } from '@/features/estructura-organizacional/PanelDepartamentoEstructura';
import { NodoEstructura } from '@/features/estructura-organizacional/NodoEstructura';
import { PanelDetalleEstructura } from '@/features/estructura-organizacional/PanelDetalleEstructura';
import { PanelPrincipalEstructura, type TipoPrincipalEstructura } from '@/features/estructura-organizacional/PanelPrincipalEstructura';
import { PanelRedEstructura } from '@/features/estructura-organizacional/PanelRedEstructura';
import {
  useConfigurarOtpEstructura,
  useEstructuraOrganizacional,
} from '@/features/estructura-organizacional/useEstructuraOrganizacional';
import type { DatosNodoEstructura } from '@/features/estructura-organizacional/types';
import type { RolUI } from '@/utils/permisos';

const nodeTypes = { estructura: NodoEstructura };

interface ContenidoProps {
  iglesiaId: string;
  nombreInicial: string;
  rolUI: RolUI;
}

function claveCamara(iglesiaId: string) {
  return `estructura-camara:${iglesiaId}`;
}

function leerCamaraGuardada(iglesiaId: string): { x: number; y: number; zoom: number } | null {
  try {
    const crudo = window.localStorage.getItem(claveCamara(iglesiaId));
    if (!crudo) return null;
    const valor = JSON.parse(crudo);
    if (typeof valor?.x === 'number' && typeof valor?.y === 'number' && typeof valor?.zoom === 'number') {
      return valor;
    }
    return null;
  } catch {
    return null;
  }
}

function ContenidoEstructura({ iglesiaId, nombreInicial, rolUI }: ContenidoProps) {
  const { data, isLoading, error } = useEstructuraOrganizacional(iglesiaId);
  // KAN-78: Lider de Red y Supervisor de Red (misma paridad de siempre, ver
  // fn_es_lider_de_red) ven el lienzo completo pero solo pueden editar su
  // propia Red -- el resto (incluida su propia tarjeta y la de Pastor/
  // Supervisor) se ve en modo lectura, mismo criterio que ya usa el Supervisor
  // con Pastor. `roles.redes_lider` trae exactamente las Redes que lidera en
  // esta iglesia puntual (no la iglesia activa del store, que puede no
  // coincidir si esta viendo el lienzo de otra iglesia).
  const { data: misRoles } = useMisRoles(rolUI === 'LIDER_RED' ? iglesiaId : undefined);
  const redesEditablesIds = useMemo(
    () => new Set((misRoles?.redes_lider ?? []).map((red) => red.id)),
    [misRoles],
  );
  const puedeEditarRed = (redId: string | null | undefined): boolean => {
    if (rolUI === 'SUPER_ADMIN' || rolUI === 'SUPERVISOR' || rolUI === 'PASTOR') return true;
    if (rolUI === 'LIDER_RED' && redId) {
      const red = data?.redes.find((item) => item.id === redId);
      return redesEditablesIds.has(redId) && !red?.eliminada;
    }
    return false;
  };
  const configurarOtp = useConfigurarOtpEstructura(iglesiaId);
  const { fitView, zoomIn, zoomOut, setCenter, setViewport } = useReactFlow<Node<DatosNodoEstructura>>();
  const [busqueda, setBusqueda] = useState('');
  const [zoom, setZoom] = useState(1);
  const [nodoSeleccionadoId, setNodoSeleccionadoId] = useState<string | null>(null);
  const [panelRed, setPanelRed] = useState<{ modo: 'crear' } | { modo: 'editar'; redId: string } | null>(null);
  const [panelPrincipal, setPanelPrincipal] = useState<TipoPrincipalEstructura | null>(null);
  const [departamentoSeleccionadoId, setDepartamentoSeleccionadoId] = useState<string | null>(null);
  const [casaDePazSeleccionadaId, setCasaDePazSeleccionadaId] = useState<string | null>(null);
  const [abrirCrearCdpDirecto, setAbrirCrearCdpDirecto] = useState(false);
  const [abrirAnadirSubliderDirecto, setAbrirAnadirSubliderDirecto] = useState(false);
  const [cambioOtpPendiente, setCambioOtpPendiente] = useState<boolean | null>(null);
  const [otpConfiguracion, setOtpConfiguracion] = useState('');
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<DatosNodoEstructura>>([]);
  const [etiquetaTactil, setEtiquetaTactil] = useState<string | null>(null);
  const [descargando, setDescargando] = useState(false);
  const iglesiaCentradaRef = useRef<string | null>(null);
  const temporizadorCamaraRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const temporizadorEtiquetaTactilRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lienzoRef = useRef<HTMLDivElement>(null);

  // Alternativa por toque a los tooltips (REQ-UI-5): title no aparece al
  // tocar en celulares, asi que al mantener presionado un icono se muestra
  // esta misma etiqueta como una burbuja breve, sin bloquear el tap normal.
  const eventosTactiles = (etiqueta: string) => ({
    onTouchStart: () => {
      if (temporizadorEtiquetaTactilRef.current) clearTimeout(temporizadorEtiquetaTactilRef.current);
      setEtiquetaTactil(etiqueta);
      temporizadorEtiquetaTactilRef.current = setTimeout(() => setEtiquetaTactil(null), 1500);
    },
    onTouchEnd: () => {
      if (temporizadorEtiquetaTactilRef.current) clearTimeout(temporizadorEtiquetaTactilRef.current);
      setEtiquetaTactil(null);
    },
  });
  useOnViewportChange({
    onChange: (viewport) => {
      setZoom(viewport.zoom);
      if (temporizadorCamaraRef.current) clearTimeout(temporizadorCamaraRef.current);
      temporizadorCamaraRef.current = setTimeout(() => {
        try {
          window.localStorage.setItem(claveCamara(iglesiaId), JSON.stringify(viewport));
        } catch {
          // localStorage puede fallar (modo privado, cuota llena); no es critico, se ignora.
        }
      }, 400);
    },
  });

  const grafoBase = useMemo(() => {
    if (!data) return { nodes: [], edges: [] };
    return crearGrafoEstructura(data);
  }, [data]);

  useEffect(() => {
    setNodes(grafoBase.nodes);
    if (grafoBase.nodes.length === 0 || iglesiaCentradaRef.current === iglesiaId) return;
    iglesiaCentradaRef.current = iglesiaId;
    const camaraGuardada = leerCamaraGuardada(iglesiaId);
    const frame = window.requestAnimationFrame(() => {
      if (camaraGuardada) {
        void setViewport(camaraGuardada, { duration: 0 });
      } else {
        void fitView({ padding: 0.16, duration: 500 });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [fitView, setViewport, grafoBase.nodes, iglesiaId, setNodes]);

  useEffect(() => () => {
    if (temporizadorCamaraRef.current) clearTimeout(temporizadorCamaraRef.current);
    if (temporizadorEtiquetaTactilRef.current) clearTimeout(temporizadorEtiquetaTactilRef.current);
  }, []);

  const nodesVisibles = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase('es');
    if (termino.length < 2) return nodes;
    return nodes.map((node) => ({
        ...node,
        data: { ...node.data, resaltado: node.data.buscable.includes(termino) },
      }));
  }, [busqueda, nodes]);

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
  const redSeleccionada = panelRed?.modo === 'editar'
    ? data?.redes.find((red) => red.id === panelRed.redId) ?? null
    : null;

  // KAN-100: descarga el lienzo completo (todos los nodos, no solo lo
  // visible en pantalla) como PNG horizontal.
  const descargarLienzo = async () => {
    if (!lienzoRef.current || descargando) return;
    setDescargando(true);
    try {
      await descargarLienzoComoPng(lienzoRef.current, nodes, nombreIglesia);
    } catch (fallo) {
      toast.error(fallo instanceof Error ? fallo.message : 'No se pudo descargar el lienzo');
    } finally {
      setDescargando(false);
    }
  };

  const cambiarProteccionOtp = async (requerido: boolean, codigo?: string) => {
    try {
      await configurarOtp.mutateAsync({ requerido, otp: codigo || null });
      toast.success(requerido ? 'Protección OTP activada' : 'Protección OTP desactivada');
      setCambioOtpPendiente(null);
      setOtpConfiguracion('');
    } catch (fallo) {
      toast.error(fallo instanceof Error ? fallo.message : 'No se pudo cambiar la protección OTP');
    }
  };

  return (
    <div className="flex h-svh flex-col bg-[#e3e7ee]">
      <header className="z-20 border-b border-white/10 bg-[#0a0e1a] px-4 py-3 sm:px-6">
        <div className="flex items-center gap-4">
          <Link
            to={rolUI === 'SUPER_ADMIN' ? ROUTES.ADMINISTRACION : ROUTES.DASHBOARD}
            aria-label={rolUI === 'SUPER_ADMIN' ? 'Volver a Administración' : 'Volver al Dashboard'}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex min-w-0 shrink items-center gap-2.5">
            <img src="/logo.png" alt="" className="h-8 w-8 shrink-0 rounded-lg object-contain brightness-0 invert" />
            <span className="flex max-w-40 min-w-0 items-baseline gap-1.5 text-[15px] text-white sm:max-w-56 lg:max-w-72">
              <span className="shrink-0 font-bold">Iglesia</span>
              <span className="truncate font-normal text-white/75">{nombreIglesia}</span>
            </span>
          </div>
          <div className="hidden h-8 w-px shrink-0 bg-white/15 lg:block corto:block" />
          <div className="hidden min-w-0 lg:block corto:block">
            <h1 className="truncate text-base font-bold text-white">Estructura Organizacional</h1>
            <p className="truncate text-left text-xs font-medium text-white/55">Vista general de la iglesia</p>
          </div>
          <div className="ml-auto hidden flex-1 items-center justify-end gap-2 lg:flex corto:flex">
            <form
              className="relative"
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
                className="h-10 w-64 rounded-xl border border-white/15 bg-white/5 pr-3 pl-9 text-[13px] text-white placeholder:text-white/40 outline-none focus-visible:border-white/30"
              />
            </form>
            <button
              type="button"
              title="Centrar estructura"
              {...eventosTactiles('Centrar estructura')}
              onClick={() => void fitView({ padding: 0.16, duration: 500 })}
              className="relative flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-white/15 px-3.5 text-[13px] font-medium text-white transition-colors before:absolute before:-inset-y-1 before:content-[''] hover:bg-white/5"
            >
              <Crosshair className="h-4 w-4" /> <span className="hidden sm:inline">Centrar estructura</span>
            </button>
            <div className="flex h-10 items-center gap-1 rounded-xl border border-white/15 px-1.5 text-white">
              {/* h-7 w-7 (28px) es mas chico que el minimo tactil de 44x44
                  (REQ-MOB-3, KAN-63) -- antes:absolute expande el area de
                  toque real sin agrandar el icono visible, mismo patron ya
                  usado en los botones-texto de los paneles laterales. */}
              <button
                type="button"
                aria-label="Alejar"
                title="Alejar"
                {...eventosTactiles('Alejar')}
                onClick={() => void zoomOut({ duration: 200 })}
                className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition-colors before:absolute before:-inset-2 before:content-[''] hover:bg-white/10"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-10 text-center text-[13px] tabular-nums">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                aria-label="Acercar"
                title="Acercar"
                {...eventosTactiles('Acercar')}
                onClick={() => void zoomIn({ duration: 200 })}
                className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition-colors before:absolute before:-inset-2 before:content-[''] hover:bg-white/10"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {/* KAN-100: descargar el lienzo completo como PNG horizontal. */}
            <button
              type="button"
              title="Descargar como imagen"
              {...eventosTactiles('Descargar como imagen')}
              onClick={() => void descargarLienzo()}
              disabled={descargando || nodes.length === 0}
              className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-white/15 px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> <span className="hidden sm:inline">{descargando ? 'Descargando…' : 'Descargar'}</span>
            </button>
          </div>
        </div>

        {/* Móvil: buscador y controles en filas propias, sin desbordar el título. */}
        <form
          className="relative mt-3 lg:hidden corto:hidden"
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
            className="h-10 w-full rounded-xl border border-white/15 bg-white/5 pr-3 pl-9 text-[13px] text-white placeholder:text-white/40 outline-none focus-visible:border-white/30"
          />
        </form>
        <div className="mt-2 flex items-center gap-2 lg:hidden corto:hidden">
          <button
            type="button"
            aria-label="Centrar estructura"
            title="Centrar estructura"
            {...eventosTactiles('Centrar estructura')}
            onClick={() => void fitView({ padding: 0.16, duration: 500 })}
            className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-white/15 text-white transition-colors before:absolute before:-inset-1 before:content-[''] hover:bg-white/5"
          >
            <Crosshair className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Descargar como imagen"
            title="Descargar como imagen"
            {...eventosTactiles('Descargar como imagen')}
            onClick={() => void descargarLienzo()}
            disabled={descargando || nodes.length === 0}
            className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-white/15 text-white transition-colors before:absolute before:-inset-1 before:content-[''] hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
          </button>
          <div className="ml-auto flex h-9 items-center gap-1 rounded-xl border border-white/15 px-1.5 text-white">
            <button
              type="button"
              aria-label="Alejar"
              title="Alejar"
              {...eventosTactiles('Alejar')}
              onClick={() => void zoomOut({ duration: 200 })}
              className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition-colors before:absolute before:-inset-2 before:content-[''] hover:bg-white/10"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-9 text-center text-[13px] tabular-nums">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              aria-label="Acercar"
              title="Acercar"
              {...eventosTactiles('Acercar')}
              onClick={() => void zoomIn({ duration: 200 })}
              className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition-colors before:absolute before:-inset-2 before:content-[''] hover:bg-white/10"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {etiquetaTactil && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg ring-1 ring-white/15">
          {etiquetaTactil}
        </div>
      )}

      <main className="relative min-h-0 flex-1">
        {/* KAN-78: crear una Red nueva y la proteccion OTP global de la
            iglesia son acciones que exceden "mi propia Red" -- se quedan
            exclusivas de Super Admin/Supervisor/Pastor (paridad Pastor-
            Supervisor, 2026-08-09), igual que en el backend
            (private.fn_estructura_puede_administrar). */}
        {!isLoading && !error && data && (rolUI === 'SUPER_ADMIN' || rolUI === 'SUPERVISOR' || rolUI === 'PASTOR') && (
          <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setNodoSeleccionadoId(null);
                setPanelRed({ modo: 'crear' });
              }}
              className="flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/10 hover:bg-blue-700"
            >
              <Network className="h-4 w-4" /> Nueva Red
            </button>
            <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              Protección OTP
              <Switch
                checked={data.layout.otpRequerido}
                disabled={configurarOtp.isPending}
                onCheckedChange={(activo) => setCambioOtpPendiente(activo)}
              />
            </label>
          </div>
        )}
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
            ref={lienzoRef}
            nodes={nodesVisibles}
            edges={grafoBase.edges}
            onNodesChange={onNodesChange}
            onNodeClick={(_evento, node) => {
              if (node.data.tipo === 'GRUPO_DEPARTAMENTOS' || node.data.tipo === 'GRUPO_REDES') return;
              setNodoSeleccionadoId(node.id);
              const cerrarTodosLosPaneles = () => {
                setPanelRed(null);
                setPanelPrincipal(null);
                setDepartamentoSeleccionadoId(null);
                setCasaDePazSeleccionadaId(null);
              };
              if (node.data.tipo === 'RED') {
                // KAN-78: "redes-vacio" es el cartel de "crear la primera Red"
                // (solo Super Admin/Supervisor pueden crear Redes); una Red
                // real solo abre en modo edicion si es la propia del rol
                // (Lider/Supervisor de Red) -- si no, queda en modo lectura
                // (mismo panel generico que ya usa el lienzo para Pastor
                // cuando lo ve el Supervisor).
                const redId = node.id === 'redes-vacio' ? null : node.id.replace('red:', '');
                const puedeCrear = rolUI === 'SUPER_ADMIN' || rolUI === 'SUPERVISOR' || rolUI === 'PASTOR';
                const editable = redId ? puedeEditarRed(redId) : puedeCrear;
                if (!editable) {
                  cerrarTodosLosPaneles();
                  return;
                }
                setAbrirCrearCdpDirecto(false);
                setAbrirAnadirSubliderDirecto(false);
                setPanelRed(redId === null ? { modo: 'crear' } : { modo: 'editar', redId });
                setPanelPrincipal(null);
                setDepartamentoSeleccionadoId(null);
                setCasaDePazSeleccionadaId(null);
                return;
              }
              if (node.data.tipo === 'NUEVA_CASA_DE_PAZ') {
                const redId = node.data.redId as string;
                if (!puedeEditarRed(redId)) {
                  cerrarTodosLosPaneles();
                  return;
                }
                setAbrirCrearCdpDirecto(true);
                setPanelRed({ modo: 'editar', redId });
                setPanelPrincipal(null);
                setDepartamentoSeleccionadoId(null);
                setCasaDePazSeleccionadaId(null);
                return;
              }
              setAbrirCrearCdpDirecto(false);
              setPanelRed(null);
              if (node.data.tipo === 'PASTOR_SLOT' && rolUI === 'SUPER_ADMIN') {
                setPanelPrincipal('PASTOR');
                setDepartamentoSeleccionadoId(null);
                setCasaDePazSeleccionadaId(null);
              } else if (node.data.tipo === 'SUPERVISOR_SLOT' && rolUI === 'SUPER_ADMIN') {
                setPanelPrincipal('SUPERVISOR');
                setDepartamentoSeleccionadoId(null);
                setCasaDePazSeleccionadaId(null);
              } else if (node.data.tipo === 'DEPARTAMENTO' && (rolUI === 'SUPER_ADMIN' || rolUI === 'SUPERVISOR' || rolUI === 'PASTOR')) {
                setPanelPrincipal(null);
                setDepartamentoSeleccionadoId(node.id.replace('departamento:', ''));
                setCasaDePazSeleccionadaId(null);
              } else if (node.data.tipo === 'CASA_DE_PAZ' && node.id.startsWith('casa:') && puedeEditarRed(node.data.redId)) {
                setPanelPrincipal(null);
                setDepartamentoSeleccionadoId(null);
                setCasaDePazSeleccionadaId(node.id.replace('casa:', ''));
                const objetivo = _evento.target as HTMLElement;
                setAbrirAnadirSubliderDirecto(Boolean(objetivo.closest('[data-accion="anadir-sublider"]')));
              } else {
                setPanelPrincipal(null);
                setDepartamentoSeleccionadoId(null);
                setCasaDePazSeleccionadaId(null);
              }
            }}
            onPaneClick={() => {
              setNodoSeleccionadoId(null);
              setPanelRed(null);
              setPanelPrincipal(null);
              setDepartamentoSeleccionadoId(null);
              setCasaDePazSeleccionadaId(null);
            }}
            nodeTypes={nodeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
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
        {panelPrincipal && data && (
          <PanelPrincipalEstructura
            tipo={panelPrincipal}
            iglesiaId={iglesiaId}
            actuales={panelPrincipal === 'PASTOR' ? data.pastores : data.supervisores}
            otpRequerido={data.layout.otpRequerido}
            onClose={() => {
              setPanelPrincipal(null);
              setNodoSeleccionadoId(null);
            }}
          />
        )}
        {nodoSeleccionado && !panelRed && !panelPrincipal && !departamentoSeleccionadoId && !casaDePazSeleccionadaId && (
          <PanelDetalleEstructura nodo={nodoSeleccionado} onClose={() => setNodoSeleccionadoId(null)} />
        )}
        {casaDePazSeleccionadaId && data && (() => {
          const casaDePaz = data.casasDePaz.find((c) => c.id === casaDePazSeleccionadaId);
          // KAN-95: la CdP no tiene color propio -- el banner de su panel
          // hereda el color real de la Red a la que pertenece (mismo dato
          // que ya colorea su tarjeta y la línea conectora en el lienzo).
          const colorRed = casaDePaz ? data.redes.find((red) => red.id === casaDePaz.redId)?.color ?? null : null;
          return casaDePaz ? (
            <PanelCasaDePazEstructura
              iglesiaId={iglesiaId}
              casaDePaz={casaDePaz}
              colorRed={colorRed}
              abrirAnadirSubliderAlAbrir={abrirAnadirSubliderDirecto}
              otpRequerido={data.layout.otpRequerido}
              esSuperAdmin={rolUI === 'SUPER_ADMIN'}
              onClose={() => {
                setCasaDePazSeleccionadaId(null);
                setAbrirAnadirSubliderDirecto(false);
                setNodoSeleccionadoId(null);
              }}
            />
          ) : null;
        })()}
        {departamentoSeleccionadoId && data && (() => {
          const departamento = data.departamentos.find((d) => d.id === departamentoSeleccionadoId);
          return departamento ? (
            <PanelDepartamentoEstructura
              iglesiaId={iglesiaId}
              departamento={departamento}
              otpRequerido={data.layout.otpRequerido}
              onClose={() => {
                setDepartamentoSeleccionadoId(null);
                setNodoSeleccionadoId(null);
              }}
            />
          ) : null;
        })()}
        {panelRed && data && (
          <PanelRedEstructura
            iglesiaId={iglesiaId}
            modo={panelRed.modo}
            red={redSeleccionada}
            redesExistentes={data.redes}
            otpRequerido={data.layout.otpRequerido}
            esSuperAdmin={rolUI === 'SUPER_ADMIN'}
            // KAN-78: eliminar/reactivar una Red y designar por correo a
            // alguien SIN CUENTA registrada siguen exclusivos de Super
            // Admin/Supervisor/Pastor (paridad Pastor-Supervisor, 2026-08-09)
            // -- Lider/Supervisor de Red administran su propia Red (nombre,
            // color, cargos, nuevas CdP) pero no esas dos acciones puntuales.
            puedeEliminarRed={rolUI === 'SUPER_ADMIN' || rolUI === 'SUPERVISOR' || rolUI === 'PASTOR'}
            puedeInvitarPorCorreo={rolUI === 'SUPER_ADMIN' || rolUI === 'SUPERVISOR' || rolUI === 'PASTOR'}
            abrirCrearCdpAlAbrir={abrirCrearCdpDirecto}
            onClose={() => {
              setPanelRed(null);
              setAbrirCrearCdpDirecto(false);
              setNodoSeleccionadoId(null);
            }}
          />
        )}
      </main>
      <Dialog
        open={cambioOtpPendiente !== null}
        onOpenChange={(abierto) => { if (!abierto) { setCambioOtpPendiente(null); setOtpConfiguracion(''); } }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{cambioOtpPendiente ? 'Activar' : 'Desactivar'} protección OTP</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Esta protección aplica solamente a los cambios del constructor organizacional.
          </p>
          <CampoOtp value={otpConfiguracion} onChange={setOtpConfiguracion} />
          <DialogFooter>
            <button
              type="button"
              onClick={() => { setCambioOtpPendiente(null); setOtpConfiguracion(''); }}
              className="h-10 cursor-pointer rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={configurarOtp.isPending || !/^\d{6}$/.test(otpConfiguracion)}
              onClick={() => void cambiarProteccionOtp(!!cambioOtpPendiente, otpConfiguracion)}
              className="h-10 cursor-pointer rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Confirmar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  // KAN-78: Lider de Red y Supervisor de Red (rolUI 'LIDER_RED', cubre a
  // ambos por la paridad de permisos ya decidida por el owner) ahora entran
  // al lienzo -- antes quedaban totalmente bloqueados de la pagina. Ven todo
  // el organigrama pero solo pueden editar su propia Red (ContenidoEstructura
  // acota clicks/paneles con puedeEditarRed); el resto queda en modo lectura.
  // 2026-08-09: Pastor entra con paridad de Supervisor (ver comentarios en
  // ContenidoEstructura y la migracion 20260809080000_paridad_pastor_supervisor.sql).
  if (rolUI !== 'SUPER_ADMIN' && rolUI !== 'SUPERVISOR' && rolUI !== 'LIDER_RED' && rolUI !== 'PASTOR') {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }
  if (!iglesiaId) return <Navigate to={ROUTES.ADMINISTRACION} replace />;

  const iglesia = iglesias.find((item) => item.id === iglesiaId);

  return (
    <ReactFlowProvider>
      <ContenidoEstructura iglesiaId={iglesiaId} nombreInicial={iglesia?.nombre ?? 'Iglesia'} rolUI={rolUI} />
    </ReactFlowProvider>
  );
}
