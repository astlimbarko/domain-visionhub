import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ClipboardList,
  History,
  DollarSign,
  HeartHandshake,
  Loader2,
  MapPin,
  Clock,
  MessageSquare,
  PartyPopper,
  Pencil,
  Plus,
  Save,
  Trash2,
  UserPlus,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { DashboardHero, AZUL, VERDE, AMBAR, MARINO, MORADO, TEAL } from '@/components/dashboard/DashboardUI';
import { useBuscarPersonas, useRedes } from '@/hooks/useCasasDePaz';
import { DEPARTAMENTO_META } from '@/utils/departamentos';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useContextoActivo } from '@/hooks/useContextoActivo';
import { useAuthStore } from '@/store/auth.store';
import { useMonedasActivas } from '@/hooks/usePanelSupervisor';
import {
  useActualizarReporte,
  useAnularReporte,
  useAutorizarEdicionReporteFueraVentana,
  useBorradorReporte,
  useExisteReporteParaFecha,
  useCamposObligatoriosReporte,
  useCdpContextoReporte,
  useCrearReporte,
  useCrearReporteMegafiesta,
  useCrearReunionNoRealizada,
  useEdadMinimaCreyente,
  useEliminarBorradorReporte,
  useGuardarBorradorReporte,
  useIdsLiderCdp,
  useLibros,
  useDiasLimiteEdicionReporte,
  useHistorialReporte,
  useMiembrosCdp,
  usePuedeAnularReporte,
  usePuedeEditarReporte,
  usePuedeSolicitarEdicionFueraVentana,
  useReportePorId,
  useTemas,
} from '@/hooks/useReporte';
import { crearEvangelizado } from '@/services/evangelismo.service';
import { useTiposEvangelismo } from '@/hooks/useEvangelismo';
import { CampoOtp } from '@/components/shared/CampoOtp';
import { BuscadorPersonaCampo } from '@/components/reporte/BuscadorPersonaCampo';
import { BuscadorPersonaMultiple, type DatosPersonaNueva } from '@/components/reporte/BuscadorPersonaMultiple';
import { BuscadorTemaCampo } from '@/components/reporte/BuscadorTemaCampo';
import { ModalFechaNacimientoFaltante } from '@/components/reporte/ModalFechaNacimientoFaltante';
import { FichaRapidaAsistente } from '@/components/reporte/FichaRapidaAsistente';
import { FichaPersonaSheet } from '@/components/personas/FichaPersonaSheet';
import { useActualizarFechaNacimientoBasica } from '@/hooks/usePersonas';
import { EvangelismoPendientePanel } from '@/components/reporte/EvangelismoPendientePanel';
import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';
import { aISO, fechaLegible, fechaLegibleConDia } from '@/utils/calendario-fechas';
import { rutaReporteEditar } from '@/utils/constants';
import { calcularEdad, clasificarEdad, RANGO_EDAD_LABEL_PERSONA } from '@/utils/edad';
import { cn } from '@/lib/utils';
import { CAMPO_ESTILO } from '@/lib/estilos';
import type {
  BorradorReportePayload,
  CategoriaTestimonio,
  DiezmoLinea,
  EvangelizadoPendiente,
  NuevaVisita,
  TestimonioLinea,
} from '@/types/reporte.types';
import type { PersonaBusqueda } from '@/types/casas-de-paz.types';

const esquema = z.object({
  fecha_reunion: z.string().min(1),
  libro_id: z.string().optional(),
  tema_id: z.string().optional(),
  tema_especial_txt: z.string().optional(),
  disertador_id: z.string().optional(),
  salio_evangelizar: z.boolean(),
  testimonios: z.string().optional(),
  total_ofrendas: z.string().min(1, 'El total de ofrendas es obligatorio, aunque sea 0'),
  moneda_id: z.string().min(1, 'Seleccioná una moneda'),
});

type FormValues = z.infer<typeof esquema>;

/** Wrapper estándar del design system para toda card de sección (ver skill frontend-style). */
const CARD_SECCION = 'overflow-hidden rounded-2xl border border-border/60 bg-card';

/**
 * KAN-367: rojo suave para "esto es un dato guardado que estás por editar" --
 * pedido explícito del owner (2026-09-17) para que se note que se trata de
 * modificar algo ya existente, no cargar algo nuevo. Nota: esto se aparta a
 * propósito de la convención del proyecto de reservar `--destructive` solo
 * para errores reales (ver skill frontend-style) -- decisión consciente del
 * owner, no un descuido.
 */
const ROJO = 'var(--destructive)';

/**
 * KAN-367: en modo edición, un campo que todavía tiene el valor que vino de
 * la base (no fue tocado desde que se cargó el reporte, `!dirty`) se ve rojo
 * suave. Apenas se modifica pasa a verse igual que un campo nuevo (blanco,
 * `CAMPO_ESTILO` normal). Fuera de modo edición no hay diferencia (todo es
 * blanco, como siempre).
 */
function claseCampoEdicion(enModoEdicion: boolean, dirty: boolean): string {
  return cn(CAMPO_ESTILO, enModoEdicion && !dirty && 'bg-destructive/10 text-foreground');
}
// Mismo wrapper, sin overflow-hidden -- para secciones con un buscador
// (BuscadorPersonaMultiple/BuscadorPersonaCampo/EvangelismoPendientePanel)
// cuyo desplegable es absolute y quedaba recortado por el borde de la card
// en pantallas chicas (móvil), tapando parte de los resultados. Bug real
// reportado por el owner, 2026-09-03: "componentes sobrepuestos" en vista
// móvil.
const CARD_SECCION_CON_DESPLEGABLE = 'rounded-2xl border border-border/60 bg-card';

/** KAN-373 (2026-09-13): opción de "tema especial" siempre disponible en el
 * Select de Tema, sin importar el libro -- antes solo aparecía si el
 * catálogo `cdp_tema` tenía una fila `es_especial=true` para ESE libro
 * puntual (solo 2 de 13 libros la tienen). No es un `tema_id` real. */
const TEMA_ESPECIAL_SENTINEL = '__tema_especial__';

/** KAN-435 (pedido explícito del owner): color por estado SSVA para las
 * pastillas de asistencia -- mismo criterio de color que FichaRapidaAsistente. */
const COLOR_ESTADO_SSVA: Record<string, string> = { SIM: AMBAR, NC: MORADO, CRE: VERDE, RE: AZUL };

export function Reportes() {
  const { reporteId } = useParams<{ reporteId?: string }>();
  const modoEdicion = !!reporteId;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { contextoActivo } = useContextoActivo();
  const contextoCdp = contextoActivo?.alcance === 'CDP' ? contextoActivo : null;
  // KAN-391: Líder de Red y Supervisor (y por encima) siempre ven de qué CdP
  // viene un asistente encontrado por búsqueda global -- el criterio
  // configurable REPORTE_MOSTRAR_ORIGEN_ASISTENTE solo aplica a Líder/
  // Sublíder de CdP (ver campos, más abajo).
  const rolActivo = useAuthStore((s) => s.rolActivo);
  const esRolCdp = rolActivo === 'LIDER_CDP' || rolActivo === 'SUBLIDER_CDP';

  // KAN-271: en modo edición, la iglesia/CdP salen del reporte que se está
  // editando, no del contexto activo -- Líder/Supervisor de Red edita
  // reportes de Casas de Paz que no son "su" contexto activo (ellos no
  // tienen una, a diferencia de Líder/Sublíder de CdP).
  const { data: reporteExistente, isLoading: cargandoReporteExistente, isError: errorReporteExistente } = useReportePorId(reporteId);
  const { data: puedeEditar, isLoading: cargandoPuedeEditar } = usePuedeEditarReporte(reporteId);
  // KAN-367: ventana propia de "Anular" (en horas) -- se chequea aparte de
  // puedeEditar (en días) para no mostrar el botón cuando ya no corresponde.
  const { data: puedeAnular } = usePuedeAnularReporte(reporteId, modoEdicion);

  const iglesiaActivaId = modoEdicion ? reporteExistente?.iglesia_id : contextoCdp?.iglesiaId;
  const cdpActiva = modoEdicion ? reporteExistente?.casa_de_paz_id : contextoCdp?.cdpId;

  // KAN-367: panel de modificación -- editar un reporte ya enviado exige un
  // paso explícito de activación (no se habilita directo al entrar), con un
  // mensaje de advertencia antes de mostrar los campos. Se resetea si se
  // navega de un reporte a otro sin desmontar el componente (misma ruta,
  // reporteId distinto).
  const [activado, setActivado] = useState(false);
  useEffect(() => {
    setActivado(false);
  }, [reporteId]);

  // Si quien edita no es el propio Líder/Sublíder de esta CdP (llegó acá
  // desde Control de Reportes -- Líder/Supervisor de Red, Pastor,
  // Supervisor), puede estar editando reportes de varias CdP distintas: se
  // muestra el contexto (Líder, Anfitrión, Dirección, Ciudad) para que esté
  // seguro de cuál está editando.
  const esCdpAjena = modoEdicion && (!contextoCdp || contextoCdp.cdpId !== cdpActiva);
  const { data: cdpContexto } = useCdpContextoReporte(cdpActiva, esCdpAjena);

  // KAN-367 (pedido del owner, 2026-09-17): mostrar el número real de días de
  // la ventana (configurable en Panel del Supervisor -> Formularios -> Control
  // de Reportes) en el aviso de edición, para que quede claro de dónde sale
  // ese límite -- no un texto fijo que se desactualice si alguien lo cambia ahí.
  const { data: diasLimiteEdicionCdp } = useDiasLimiteEdicionReporte(iglesiaActivaId, 'DIAS_LIMITE_EDICION_REPORTE_CDP');

  // KAN-367 (2026-09-17): "Ver historial de cambios" solo visible para
  // Pastor/Supervisor de la Visión en Acción (o Super Admin) -- el Líder/
  // Sublíder de la CdP no lo ve. El backend igual lo exige de nuevo
  // (fn_historial_reporte_cdp), esto es solo para no mostrar un botón que
  // va a fallar.
  const esSupervisionVisionAccion =
    contextoActivo?.rolUI === 'PASTOR' || contextoActivo?.rolUI === 'SUPERVISOR' || contextoActivo?.rolUI === 'SUPER_ADMIN';
  const [mostrandoHistorial, setMostrandoHistorial] = useState(false);
  const { data: historial, isLoading: cargandoHistorial } = useHistorialReporte(
    reporteId,
    modoEdicion && esSupervisionVisionAccion && mostrandoHistorial
  );

  // KAN-367: Pastor / Supervisor de la Visión en Acción, fuera de la ventana
  // normal, pueden pedir autorización puntual (justificación + OTP) en vez
  // de quedar bloqueados como el resto de los roles.
  const { data: puedeSolicitarFueraVentana, isLoading: cargandoPuedeSolicitar } = usePuedeSolicitarEdicionFueraVentana(
    reporteId,
    modoEdicion && puedeEditar === false
  );
  const autorizarFueraVentana = useAutorizarEdicionReporteFueraVentana(reporteId);
  const [justificacionFueraVentana, setJustificacionFueraVentana] = useState('');
  const [pinFueraVentana, setPinFueraVentana] = useState('');

  async function solicitarAutorizacionFueraVentana() {
    try {
      await autorizarFueraVentana.mutateAsync({ justificacion: justificacionFueraVentana, pin: pinFueraVentana });
      toast.success('Autorizado -- ya podés modificar este reporte');
      setPinFueraVentana('');
    } catch (e) {
      const mensaje = typeof (e as { message?: string })?.message === 'string' ? (e as { message: string }).message : '';
      if (mensaje.includes('PIN_INCORRECTO')) toast.error('El código es incorrecto, expiró, o no fue solicitado');
      else if (mensaje.includes('REPORTE_JUSTIFICACION_OBLIGATORIA')) toast.error('Escribí un motivo para editar fuera de la ventana normal');
      else toast.error('No se pudo autorizar la edición');
    }
  }
  const queryClient = useQueryClient();
  const { data: redes = [] } = useRedes(iglesiaActivaId);
  const colorRedInfo = redes.find((r) => r.id === contextoCdp?.redId)?.color;
  // KAN-251: color elegido para la Red en el Constructor -- blanco es el
  // valor "sin elegir" (mismo criterio que layout.ts/PanelRedEstructura).
  const colorRed = colorRedInfo && colorRedInfo.toUpperCase() !== '#FFFFFF' ? colorRedInfo : null;

  const hoy = aISO(new Date());
  // KAN-435 (pedido del owner): desde el círculo rojo "no entregado" del
  // calendario se llega acá con ?fecha=YYYY-MM-DD -- precarga esa fecha en
  // vez de hoy, para no obligarlo a escribir a mano la fecha de la semana
  // que faltó. Solo aplica al crear (nunca pisa la fecha de un reporte que
  // ya se está editando).
  const fechaQueryParam = searchParams.get('fecha');
  const fechaInicial = !modoEdicion && fechaQueryParam && /^\d{4}-\d{2}-\d{2}$/.test(fechaQueryParam) ? fechaQueryParam : hoy;

  const { data: libros = [] } = useLibros();
  const { data: miembrosCrudo = [], isLoading: cargandoMiembros } = useMiembrosCdp(cdpActiva);
  // El Líder de la CdP no es "alguien a quien marcarle asistencia" -- pedido
  // del owner (2026-09-10). Se filtra acá, no en useMiembrosCdp (compartida
  // con MultiplicarCdpDialog.tsx, donde el Líder sí debe poder elegirse al
  // dividir una CdP).
  const { data: idsLider } = useIdsLiderCdp(cdpActiva);
  const miembros = useMemo(() => {
    const sinLider = idsLider ? miembrosCrudo.filter((m) => !idsLider.has(m.persona_id)) : miembrosCrudo;
    // KAN-391 (2026-09-17): encontrado al probar el buscador unificado --
    // useMiembrosCdp puede traer a la misma persona 2 veces (fan-out del
    // JOIN de origen, visto en datos reales de prueba). Antes pasaba
    // desapercibido porque "regulares" y "niños" eran 2 listas separadas;
    // al unificarlas en un solo pool, React se queja de keys duplicadas.
    // Dedup acá, en el único punto donde se arma el pool para toda la
    // pantalla, en vez de en cada lugar que lo consume.
    const vistos = new Set<string>();
    return sinLider.filter((m) => (vistos.has(m.persona_id) ? false : (vistos.add(m.persona_id), true)));
  }, [miembrosCrudo, idsLider]);
  const { data: campos } = useCamposObligatoriosReporte(iglesiaActivaId);
  // Umbral configurable por iglesia (default 12): mismo criterio que ya usa el backend
  // para Estados SSVA y el Dashboard, en vez de un "12" fijo que podía no coincidir.
  const { data: edadMinima = 12 } = useEdadMinimaCreyente(iglesiaActivaId);
  const { data: monedas = [] } = useMonedasActivas(iglesiaActivaId);
  const crear = useCrearReporte(cdpActiva);
  const crearNoRealizada = useCrearReunionNoRealizada(cdpActiva);
  const actualizar = useActualizarReporte(cdpActiva);
  const anular = useAnularReporte(cdpActiva);
  // Confirmación inline (sin diálogo bloqueante) para anular el reporte en edición.
  const [confirmandoAnular, setConfirmandoAnular] = useState(false);
  // KAN-367 (pedido del owner, 2026-09-17): botón "Sí, anular" arranca
  // deshabilitado con cuenta regresiva de 3 segundos -- nadie lo confirma
  // por reflejo. Arranca de nuevo cada vez que se abre el diálogo.
  const [segundosParaAnular, setSegundosParaAnular] = useState(3);
  useEffect(() => {
    if (!confirmandoAnular) return;
    setSegundosParaAnular(3);
    const id = window.setInterval(() => {
      setSegundosParaAnular((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [confirmandoAnular]);

  async function anularReporteActual() {
    if (!reporteId) return;
    try {
      await anular.mutateAsync(reporteId);
      toast.success('Reporte anulado');
      navigate(-1);
    } catch (e) {
      const mensaje = typeof (e as { message?: string })?.message === 'string' ? (e as { message: string }).message : '';
      toast.error(mensaje.includes('REPORTE_ANULAR_SIN_PERMISO') ? 'Ya no se puede anular (pasó la ventana para anular, o no tenés permiso)' : 'No se pudo anular el reporte');
    }
  }

  // Un único mapa persona → { esVisita, esMenor } evita que alguien quede
  // seleccionado en más de una de las 3 listas (nuevos / regulares / niños) a la vez.
  const [asistentes, setAsistentes] = useState<Map<string, { esVisita: boolean; esMenor?: boolean }>>(new Map());
  // KAN-367 (pedido del owner, 2026-09-17): quiénes ya estaban marcados al
  // abrir el reporte para editar -- sus pastillas se ven en rojo suave.
  // Nunca se toca fuera del efecto de precarga: agregar/sacar gente durante
  // la edición no entra ni sale de este set.
  const [idsAsistentesOriginales, setIdsAsistentesOriginales] = useState<Set<string>>(new Set());
  const [visitasNuevas, setVisitasNuevas] = useState<NuevaVisita[]>([]);
  // Bug real reportado por el owner (2026-09-05): "Asistentes nuevos" no
  // buscaba a nadie, así que una visita recurrente (alguien que ya está en
  // el sistema pero no es miembro de la CdP) se duplicaba cada semana. Este
  // texto dispara una búsqueda en toda la iglesia (useBuscarPersonas) antes
  // de ofrecer crearla de nuevo.
  const [textoAsistenteNuevo, setTextoAsistenteNuevo] = useState('');
  const [asistentesNuevosExistentes, setAsistentesNuevosExistentes] = useState<PersonaBusqueda[]>([]);
  const { data: resultadosAsistenteNuevo = [], isFetching: buscandoAsistenteNuevo } = useBuscarPersonas(iglesiaActivaId, textoAsistenteNuevo);
  // KAN-390 (2026-09-17, pedido del owner): "se reconcilió" -- manual, por
  // persona, disponible para cualquier asistente que ya existía en el
  // sistema (regulares/niños del pool de la CdP, o encontrado por la
  // búsqueda global). No aplica a `visitasNuevas` (persona recién creada,
  // no hay de qué "volver"). Se registra como evento de Evangelismo al
  // enviar -- no toca persona_estado.
  // KAN-422 (2026-09-22, pedido explícito del owner): completado progresivo
  // -- al agregar a alguien SIN fecha de nacimiento (nuevo en esta selección,
  // no al precargar un reporte existente), se encola para preguntarle en un
  // modal, uno por vez. KAN-435: el modal siempre termina resuelto (fecha,
  // edad aproximada, o al menos "¿es menor?") -- no hay forma de dejarlo
  // pendiente para después.
  const [colaFechaNacimiento, setColaFechaNacimiento] = useState<{ id: string; nombre: string }[]>([]);
  const actualizarFechaNacimiento = useActualizarFechaNacimientoBasica();

  function encolarSiFaltaFecha(personaId: string, nombreCompleto: string, tieneFecha: boolean) {
    if (tieneFecha) return;
    setColaFechaNacimiento((prev) => (prev.some((p) => p.id === personaId) ? prev : [...prev, { id: personaId, nombre: nombreCompleto }]));
  }

  function quitarDeColaFechaNacimiento(personaId: string) {
    setColaFechaNacimiento((prev) => prev.filter((p) => p.id !== personaId));
  }

  async function guardarFechaNacimientoPendiente(fechaNacimiento: string) {
    const pendiente = colaFechaNacimiento[0];
    if (!pendiente) return;
    try {
      await actualizarFechaNacimiento.mutateAsync({ personaId: pendiente.id, datos: { fecha_nacimiento: fechaNacimiento } });
      cambiarEsMenorAsistente(pendiente.id, calcularEdad(fechaNacimiento) < edadMinima);
      quitarDeColaFechaNacimiento(pendiente.id);
    } catch {
      toast.error('No se pudo guardar la fecha de nacimiento');
    }
  }

  async function guardarEdadAproximadaPendiente(edad: number) {
    const pendiente = colaFechaNacimiento[0];
    if (!pendiente) return;
    try {
      await actualizarFechaNacimiento.mutateAsync({ personaId: pendiente.id, datos: { edad_aproximada: edad } });
      cambiarEsMenorAsistente(pendiente.id, edad < edadMinima);
      quitarDeColaFechaNacimiento(pendiente.id);
    } catch {
      toast.error('No se pudo guardar la edad aproximada');
    }
  }

  // KAN-435: última salida del modal cuando ni la fecha ni la edad
  // aproximada se saben -- resuelve solo la clasificación de este reporte
  // (no se guarda nada en la ficha de la persona), así el modal siempre
  // termina resuelto y nunca hace falta una alerta aparte en la página.
  function resolverEsMenorPendiente(esMenor: boolean) {
    const pendiente = colaFechaNacimiento[0];
    if (!pendiente) return;
    cambiarEsMenorAsistente(pendiente.id, esMenor);
    quitarDeColaFechaNacimiento(pendiente.id);
  }

  // KAN-435 (pedido explícito del owner): la X del modal deshace la
  // selección -- saca del todo a la persona de la asistencia (no solo la
  // pregunta pendiente), para el caso de haberla elegido por error.
  // quitarDelReporte ya limpia la cola de paso.
  function cancelarColaFechaNacimiento() {
    const pendiente = colaFechaNacimiento[0];
    if (!pendiente) return;
    quitarDelReporte(pendiente.id);
  }

  const [reconciliadosPorPersona, setReconciliadosPorPersona] = useState<Record<string, boolean>>({});
  function cambiarReconciliacion(personaId: string, valor: boolean) {
    setReconciliadosPorPersona((prev) => ({ ...prev, [personaId]: valor }));
  }

  // KAN-435 (2026-09-23, pedido explícito del owner): "ficha rápida" -- un
  // solo panel con todos los controles de una persona (antes sueltos encima
  // de cada pastilla: checkbox "es menor", toggle RE, menú "más opciones",
  // botón quitar). `fichaCompletaId` abre el FichaPersonaSheet real desde
  // ahí, para lo que la ficha rápida no resuelve (ej. corregir una fecha de
  // nacimiento ya cargada pero mal cargada).
  const [fichaRapidaId, setFichaRapidaId] = useState<string | null>(null);
  const [fichaCompletaId, setFichaCompletaId] = useState<string | undefined>(undefined);

  async function guardarFechaNacimientoFichaRapida(personaId: string, fechaNacimiento: string) {
    try {
      await actualizarFechaNacimiento.mutateAsync({ personaId, datos: { fecha_nacimiento: fechaNacimiento } });
      cambiarEsMenorAsistente(personaId, calcularEdad(fechaNacimiento) < edadMinima);
    } catch {
      toast.error('No se pudo guardar la fecha de nacimiento');
    }
  }

  async function guardarEdadAproximadaFichaRapida(personaId: string, edad: number) {
    try {
      await actualizarFechaNacimiento.mutateAsync({ personaId, datos: { edad_aproximada: edad } });
      cambiarEsMenorAsistente(personaId, edad < edadMinima);
    } catch {
      toast.error('No se pudo guardar la edad aproximada');
    }
  }

  // Quitar del reporte: mismo criterio que el botón "X" de siempre, según de
  // qué lista venga la persona (miembro del pool vs. encontrada por búsqueda global).
  function quitarDelReporte(personaId: string) {
    if (asistentesNuevosExistentes.some((p) => p.id === personaId)) {
      quitarAsistenteExistente(personaId);
    } else {
      toggleAsistente(personaId, false);
    }
  }
  // Diezmos por persona: cada diezmante (existente o tecleado a mano) con su
  // monto y celular opcional. El total es la suma. El campo único "Total
  // diezmos" se reemplazó por esta lista.
  const [diezmos, setDiezmos] = useState<DiezmoLinea[]>([]);
  // KAN-423 (2026-09-22, pedido explícito del owner): testimonios personales
  // aparte de la narración general de la reunión (campo "testimonios" de
  // siempre, renombrado en la UI a "¿Qué se desató en la CdP?"). Se pueden
  // cargar varios, cada uno con su categoría.
  function nuevoTestimonioVacio(): TestimonioLinea {
    return { clave: crypto.randomUUID(), categoria: '', texto: '', nombrePersona: '', esExterno: false };
  }
  // Seguimiento KAN-423 (2026-09-22, pedido explícito del owner en vivo): la
  // primera fila de testimonio siempre está visible (no hace falta tocar
  // "+" para verla) -- por eso el estado nunca queda en un array vacío, ni
  // al arrancar ni después de quitar la última fila.
  const [testimoniosCategorizados, setTestimoniosCategorizados] = useState<TestimonioLinea[]>(() => [nuevoTestimonioVacio()]);
  function agregarTestimonioCategorizado() {
    setTestimoniosCategorizados((prev) => [...prev, nuevoTestimonioVacio()]);
  }
  function cambiarCategoriaTestimonio(clave: string, categoria: CategoriaTestimonio) {
    setTestimoniosCategorizados((prev) => prev.map((t) => (t.clave === clave ? { ...t, categoria } : t)));
  }
  function cambiarTextoTestimonioCategorizado(clave: string, texto: string) {
    setTestimoniosCategorizados((prev) => prev.map((t) => (t.clave === clave ? { ...t, texto } : t)));
  }
  function cambiarNombrePersonaTestimonio(clave: string, texto: string) {
    setTestimoniosCategorizados((prev) =>
      prev.map((t) => (t.clave === clave ? { ...t, nombrePersona: texto, personaId: undefined } : t))
    );
  }
  function seleccionarPersonaTestimonio(clave: string, persona: PersonaBusqueda) {
    setTestimoniosCategorizados((prev) =>
      prev.map((t) => (t.clave === clave ? { ...t, nombrePersona: persona.nombre_completo, personaId: persona.id } : t))
    );
  }
  function toggleEsExternoTestimonio(clave: string, esExterno: boolean) {
    setTestimoniosCategorizados((prev) =>
      prev.map((t) => (t.clave === clave ? { ...t, esExterno, nombrePersona: '', personaId: undefined } : t))
    );
  }
  function quitarTestimonioCategorizado(clave: string) {
    setTestimoniosCategorizados((prev) => {
      const restantes = prev.filter((t) => t.clave !== clave);
      return restantes.length > 0 ? restantes : [nuevoTestimonioVacio()];
    });
  }
  const [textoBuscadorDiezmante, setTextoBuscadorDiezmante] = useState('');
  const [mostrarFormDiezmante, setMostrarFormDiezmante] = useState(false);
  const [nombreDiezmante, setNombreDiezmante] = useState('');
  const [apellidoDiezmante, setApellidoDiezmante] = useState('');
  const [sexoDiezmante, setSexoDiezmante] = useState<'M' | 'F' | ''>('');
  const [telefonoDiezmante, setTelefonoDiezmante] = useState('');
  const [montoDiezmanteManual, setMontoDiezmanteManual] = useState('');
  const [evangelizadosPendientes, setEvangelizadosPendientes] = useState<EvangelizadoPendiente[]>([]);
  // Persona recién agregada en Evangelismo, esperando que el líder confirme
  // en el modal si también asistió a la reunión (ver agregarEvangelizado).
  const [pendienteConfirmarAsistente, setPendienteConfirmarAsistente] = useState<EvangelizadoPendiente | null>(null);
  // KAN-271: en modo edición no se vuelve a pasar por el panel de "agregar
  // evangelizado" (ya se creó su registro de Evangelismo al enviar el
  // reporte original -- reabrirlo lo duplicaría). Solo se corrige el
  // conteo que queda guardado en el reporte.
  const [evangelizadosDeclaradosEdicion, setEvangelizadosDeclaradosEdicion] = useState<number | undefined>(undefined);
  const [disertadorNombre, setDisertadorNombre] = useState('');
  // KAN-392 (2026-09-17, pedido del owner): "esta semana no se realizó la
  // reunión" -- solo tiene sentido al cargar un reporte nuevo, no editando
  // uno que ya existe (por eso el checkbox más abajo solo se muestra si
  // `!modoEdicion`). Reemplaza el formulario entero por uno mínimo
  // (fecha + motivo), sin tocar la lógica normal de asistencia/finanzas/
  // evangelismo -- va por un camino de guardado totalmente aparte
  // (crearReunionNoRealizada), no por onSubmit.
  const [reunionNoRealizada, setReunionNoRealizada] = useState(false);
  const [motivoNoRealizada, setMotivoNoRealizada] = useState('');
  // KAN-409: "esta reunión es una Megafiesta de Casa de Paz" -- reemplaza el
  // formulario por uno reducido (fecha + asistencia), igual que
  // reunionNoRealizada, y va por un camino de guardado propio
  // (crearReporteMegafiesta/onSubmitMegafiesta), no por onSubmit. Solo tiene
  // sentido al cargar un reporte nuevo (mismo criterio que reunionNoRealizada
  // -- el checkbox solo se muestra si `!modoEdicion`).
  const [esMegafiestaForm, setEsMegafiestaForm] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<FormValues>({
    resolver: zodResolver(esquema),
    defaultValues: { fecha_reunion: fechaInicial, salio_evangelizar: false, moneda_id: monedas[0]?.moneda_id },
  });

  const fechaReunion = watch('fecha_reunion');
  const libroId = watch('libro_id');
  const temaId = watch('tema_id');
  const temaEspecialTxt = watch('tema_especial_txt');
  const disertadorId = watch('disertador_id');
  const salioEvangelizar = watch('salio_evangelizar');
  const monedaId = watch('moneda_id');
  const totalOfrendasTexto = watch('total_ofrendas');
  const testimoniosTexto = watch('testimonios');

  // KAN-435 (2026-09-23, pedido explícito del owner): autoguardado -- solo
  // tiene sentido al cargar un reporte NUEVO (nunca en modo edición, ni en
  // "reunión no realizada"/Megafiesta -- esos son formularios chicos e
  // instantáneos, con bajo riesgo real de perder trabajo). El borrador se
  // identifica por CdP+fecha (fechaInicial, la que tenía el formulario al
  // montar) para no pisarse con otro borrador de otra semana de la misma CdP.
  const borradorAplica = !modoEdicion;
  const { data: borrador, isLoading: cargandoBorrador } = useBorradorReporte(
    borradorAplica ? cdpActiva : undefined,
    borradorAplica ? fechaInicial : undefined
  );
  // KAN-435 (pedido explícito del owner): antes de restaurar un borrador,
  // chequear si alguien ya envió el reporte REAL de esa fecha mientras
  // tanto (ej. desde otra sesión/cuenta) -- si pasó, restaurar el
  // borrador como si nada sería mostrarle datos que ya no sirven.
  const { data: reporteExistenteId, isLoading: cargandoConflictoFecha } = useExisteReporteParaFecha(
    borradorAplica ? cdpActiva : undefined,
    borradorAplica ? fechaInicial : undefined
  );
  const guardarBorrador = useGuardarBorradorReporte();
  const eliminarBorrador = useEliminarBorradorReporte();
  const [borradorId, setBorradorId] = useState<string | null>(null);
  const [estadoBorrador, setEstadoBorrador] = useState<'inactivo' | 'guardando' | 'guardado' | 'error'>('inactivo');
  // Destello flotante (pedido explícito del owner): visible mientras
  // guarda, y un ratito después de confirmado -- después se apaga solo.
  const [mostrarIndicadorBorrador, setMostrarIndicadorBorrador] = useState(false);
  // Punto 2 (pedido explícito del owner): "ya se envió el reporte real de
  // esta fecha, este borrador quedó viejo" -- id del reporte real en
  // conflicto, o null si no hay conflicto.
  const [reporteConflictoId, setReporteConflictoId] = useState<string | null>(null);
  const [confirmandoDescartarBorrador, setConfirmandoDescartarBorrador] = useState(false);
  const borradorHidratado = useRef(false);
  const debounceBorradorRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ocultarIndicadorBorradorRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bug real encontrado en vivo (2 vueltas): descartarBorrador() resetea
  // asistentes/visitasNuevas/testimoniosCategorizados/etc. a valores
  // "vacíos" nuevos (nueva referencia de Map/array aunque el contenido
  // sea igual) -- eso por sí solo dispara de nuevo el efecto de
  // autoguardado. Una bandera de "un solo uso" no alcanzaba: react-hook-
  // form's reset() propaga sus propios cambios en un re-render aparte
  // (fechaReunion/libroId/etc. via watch), que llegaba DESPUÉS de que la
  // bandera ya se hubiera consumido en el primer disparo -- terminaba
  // guardando igual, recreando el borrador que se acababa de borrar. Se
  // apaga sola por tiempo (ver el setTimeout en descartarBorrador), no al
  // primer uso, para cubrir todos los re-renders en cascada del reset.
  const saltarProximoAutoguardado = useRef(false);
  const reactivarAutoguardadoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restaura el formulario con lo que había guardado, una sola vez al montar.
  useEffect(() => {
    if (!borradorAplica || cargandoBorrador || cargandoConflictoFecha || borradorHidratado.current) return;
    borradorHidratado.current = true;
    if (!borrador) return;
    // Punto 2: si ya existe el reporte real de esta fecha, no restauramos
    // el borrador (quedó obsoleto) -- se avisa aparte y se deja elegir.
    if (reporteExistenteId) {
      setReporteConflictoId(reporteExistenteId);
      setBorradorId(borrador.id);
      return;
    }
    const p = borrador.payload;
    reset({
      fecha_reunion: p.fecha_reunion,
      libro_id: p.libro_id,
      tema_id: p.tema_id,
      tema_especial_txt: p.tema_especial_txt,
      disertador_id: p.disertador_id,
      salio_evangelizar: p.salio_evangelizar,
      moneda_id: p.monedaId ?? monedas[0]?.moneda_id,
      testimonios: p.testimonios,
      total_ofrendas: String(p.totalOfrendas ?? ''),
    });
    setDisertadorNombre(p.disertador_nombre ?? '');
    setAsistentes(new Map(p.asistentes));
    setVisitasNuevas(p.visitasNuevas);
    setAsistentesNuevosExistentes(p.asistentesNuevosExistentes);
    setDiezmos(p.diezmos);
    setTestimoniosCategorizados(p.testimoniosCategorizados.length > 0 ? p.testimoniosCategorizados : [nuevoTestimonioVacio()]);
    setReconciliadosPorPersona(Object.fromEntries(p.reconciliados.map((id) => [id, true])));
    setBorradorId(borrador.id);
    setEstadoBorrador('guardado');
    toast.info('Se restauró tu borrador sin enviar.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [borradorAplica, cargandoBorrador, cargandoConflictoFecha, borrador, reporteExistenteId]);

  // Punto 1 (pedido explícito del owner): descartar el borrador a mano y
  // arrancar en blanco -- para el caso de que haya quedado obsoleto (ver
  // reporteConflictoId) o simplemente porque el líder quiere empezar de
  // nuevo. Nunca toca un reporte ya enviado, solo el borrador.
  function descartarBorrador() {
    // Bug real encontrado en vivo: si quedaba un autoguardado con debounce
    // pendiente (disparado por la última tecla antes de descartar), podía
    // terminar de guardarse DESPUÉS del delete y recrear el borrador que
    // se acababa de borrar -- hay que cancelarlo primero. El reset de
    // abajo (Map/array nuevos) dispara igual el efecto de autoguardado
    // apenas re-renderiza -- saltarProximoAutoguardado hace que ese ciclo
    // puntual no guarde nada.
    if (debounceBorradorRef.current) clearTimeout(debounceBorradorRef.current);
    if (ocultarIndicadorBorradorRef.current) clearTimeout(ocultarIndicadorBorradorRef.current);
    if (reactivarAutoguardadoRef.current) clearTimeout(reactivarAutoguardadoRef.current);
    saltarProximoAutoguardado.current = true;
    reactivarAutoguardadoRef.current = setTimeout(() => {
      saltarProximoAutoguardado.current = false;
    }, 400);
    setMostrarIndicadorBorrador(false);
    if (borradorId) eliminarBorrador.mutate(borradorId);
    setBorradorId(null);
    setEstadoBorrador('inactivo');
    setReporteConflictoId(null);
    setConfirmandoDescartarBorrador(false);
    reset({ fecha_reunion: fechaInicial, salio_evangelizar: false, moneda_id: monedas[0]?.moneda_id, testimonios: '' });
    setDisertadorNombre('');
    setAsistentes(new Map());
    setVisitasNuevas([]);
    setAsistentesNuevosExistentes([]);
    setDiezmos([]);
    setTestimoniosCategorizados([nuevoTestimonioVacio()]);
    setReconciliadosPorPersona({});
    toast.success('Borrador descartado.');
  }

  // Autoguardado con debounce -- recién arranca después de intentar
  // restaurar (si no, el primer render con el formulario vacío pisaría un
  // borrador real antes de siquiera leerlo).
  useEffect(() => {
    if (!borradorAplica || !borradorHidratado.current || !cdpActiva || !iglesiaActivaId || reporteConflictoId) return;
    if (saltarProximoAutoguardado.current) return;
    setEstadoBorrador('guardando');
    if (ocultarIndicadorBorradorRef.current) clearTimeout(ocultarIndicadorBorradorRef.current);
    setMostrarIndicadorBorrador(true);
    if (debounceBorradorRef.current) clearTimeout(debounceBorradorRef.current);
    debounceBorradorRef.current = setTimeout(() => {
      const payload: BorradorReportePayload = {
        fecha_reunion: fechaReunion,
        libro_id: libroId,
        tema_id: temaId,
        tema_especial_txt: temaEspecialTxt,
        disertador_id: disertadorId,
        disertador_nombre: disertadorNombre || undefined,
        salio_evangelizar: salioEvangelizar,
        testimonios: testimoniosTexto,
        testimoniosCategorizados,
        asistentes: Array.from(asistentes.entries()),
        visitasNuevas,
        asistentesNuevosExistentes,
        reconciliados: Object.entries(reconciliadosPorPersona)
          .filter(([, v]) => v)
          .map(([id]) => id),
        totalOfrendas: Number(totalOfrendasTexto) || 0,
        monedaId,
        diezmos,
      };
      guardarBorrador.mutate(
        { borradorId, iglesiaId: iglesiaActivaId, casaDePazId: cdpActiva, payload },
        {
          onSuccess: (id) => {
            setBorradorId(id);
            setEstadoBorrador('guardado');
            ocultarIndicadorBorradorRef.current = setTimeout(() => setMostrarIndicadorBorrador(false), 1600);
          },
          onError: () => {
            setEstadoBorrador('error');
            setMostrarIndicadorBorrador(false);
            toast.error('No se pudo guardar el progreso automático. Se reintenta con el próximo cambio.');
          },
        }
      );
    }, 1500);
    return () => {
      if (debounceBorradorRef.current) clearTimeout(debounceBorradorRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    fechaReunion,
    libroId,
    temaId,
    temaEspecialTxt,
    disertadorId,
    disertadorNombre,
    salioEvangelizar,
    testimoniosTexto,
    testimoniosCategorizados,
    asistentes,
    visitasNuevas,
    asistentesNuevosExistentes,
    reconciliadosPorPersona,
    monedaId,
    totalOfrendasTexto,
    diezmos,
  ]);

  // Al enviar el reporte real con éxito, el borrador ya no representa nada
  // pendiente -- se borra para no ofrecerlo de nuevo la próxima vez.
  // `borradorHidratado` queda en true (no se resetea): ya no hay nada que
  // restaurar, así que el autoguardado puede seguir de largo para lo que
  // el líder tipee después (otro reporte, en la misma sesión), sin volver
  // a esperar una consulta de "¿hay borrador?" que ya no aplica.
  function limpiarBorradorEnviado() {
    if (borradorId) eliminarBorrador.mutate(borradorId);
    setBorradorId(null);
    setEstadoBorrador('inactivo');
  }

  const { data: temas = [] } = useTemas(libroId, iglesiaActivaId);
  const { data: tiposEvangelismo = [] } = useTiposEvangelismo(iglesiaActivaId);
  const crearMegafiesta = useCrearReporteMegafiesta(cdpActiva);
  const temaActual = useMemo(() => temas.find((t) => t.id === temaId), [temas, temaId]);
  // KAN-367 (2026-09-17): el buscador de temas cambia libro_id y tema_id
  // juntos, pero `temas` (useTemas, filtrado por libro_id) recién empieza a
  // pedirse cuando libro_id cambia -- si se setea tema_id antes de que esa
  // lista llegue, el <Select> nunca lo muestra (el value no vuelve a
  // cambiar una vez que el item recién aparece, bug real encontrado en
  // verificación en vivo). Se guarda el tema pendiente y se aplica recién
  // cuando aparece en `temas` (confirma que ya es la lista del libro correcto).
  const [temaIdPendiente, setTemaIdPendiente] = useState<string | undefined>();
  useEffect(() => {
    if (temaIdPendiente && temas.some((t) => t.id === temaIdPendiente)) {
      setValue('tema_id', temaIdPendiente, { shouldDirty: true });
      setTemaIdPendiente(undefined);
    }
  }, [temas, temaIdPendiente, setValue]);
  // KAN-373: "especial" ahora puede venir del catálogo (temaActual.es_especial,
  // libros 3/10) O de haber elegido el sentinel (cualquier libro).
  const esTemaEspecial = temaActual?.es_especial || temaId === TEMA_ESPECIAL_SENTINEL;

  // Las monedas activas se cargan de forma asincronica: si el default de
  // useForm se evaluara solo al montar, moneda_id quedaria vacio para siempre.
  useEffect(() => {
    if (!monedaId && monedas[0]) {
      setValue('moneda_id', monedas[0].moneda_id);
    }
  }, [monedas, monedaId, setValue]);

  // KAN-271: precarga del formulario con los datos ya guardados, una sola
  // vez que llega el reporte (evita pisar lo que la persona ya empezó a
  // tocar si esta query se refetchea después). `formPrecargado` evita
  // mostrar el formulario un instante con los defaultValues vacíos antes de
  // que este efecto corra (se renderiza recién en el próximo commit).
  const [formPrecargado, setFormPrecargado] = useState(false);
  useEffect(() => {
    if (!modoEdicion || !reporteExistente) return;
    reset({
      fecha_reunion: reporteExistente.fecha_reunion,
      libro_id: reporteExistente.libro_id ?? undefined,
      // KAN-373: si se guardó con tema_id null + tema_especial_txt (tema
      // especial de un libro sin ese catálogo), hidratar el sentinel para
      // que el Select lo muestre seleccionado y aparezca el texto libre.
      tema_id:
        reporteExistente.tema_id ?? (reporteExistente.tema_especial_txt ? TEMA_ESPECIAL_SENTINEL : undefined),
      tema_especial_txt: reporteExistente.tema_especial_txt ?? undefined,
      disertador_id: reporteExistente.disertador_id ?? undefined,
      salio_evangelizar: reporteExistente.salio_evangelizar,
      // KAN-367 (2026-09-17, pedido del owner): "Comentarios" dejó de ser un
      // campo aparte -- se unifica en Testimonio. Reportes viejos que
      // guardaron algo en comentarios lo muestran acá abajo, marcado
      // explícitamente como "Comentarios:" para no perder ese contexto (la
      // columna vieja en la base no se borra ni se toca, solo deja de
      // escribirse desde el formulario).
      testimonios:
        [reporteExistente.testimonios, reporteExistente.comentarios ? `Comentarios: ${reporteExistente.comentarios}` : null]
          .filter(Boolean)
          .join('\n\n') || undefined,
      total_ofrendas: String(reporteExistente.totalOfrendas),
      moneda_id: reporteExistente.monedaId ?? undefined,
    });
    setDiezmos(reporteExistente.diezmos);
    setTestimoniosCategorizados(
      reporteExistente.testimoniosCategorizados.length > 0 ? reporteExistente.testimoniosCategorizados : [nuevoTestimonioVacio()]
    );
    setDisertadorNombre(reporteExistente.disertador_nombre ?? '');
    setEvangelizadosDeclaradosEdicion(reporteExistente.evangelizados_declarados ?? undefined);
    setAsistentes(new Map(reporteExistente.asistentes.map((a) => [a.personaId, { esVisita: a.esVisita, esMenor: a.esMenor }])));
    setIdsAsistentesOriginales(new Set(reporteExistente.asistentes.map((a) => a.personaId)));
    // KAN-367 (bug real encontrado en verificación en vivo, 2026-09-17): quien
    // asiste como visita/asistente nuevo (esVisita) no está en el pool de
    // miembros de la CdP -- sin esto, contaba en el total pero no aparecía en
    // ninguna lista al editar (ni en Regular/Niños, que excluyen a las
    // visitas a propósito, ni en Asistentes nuevos, que en modo edición
    // arranca vacío). Se muestran acá como "ya existentes" -- ya tienen
    // persona_id real, no hace falta crearlas de nuevo.
    setAsistentesNuevosExistentes(
      reporteExistente.asistentes
        .filter((a) => a.esVisita && a.nombreCompleto)
        .map((a) => ({ id: a.personaId, nombre_completo: a.nombreCompleto as string }))
    );
    setFormPrecargado(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reporteExistente, modoEdicion]);

  function cambiarTextoDisertador(texto: string) {
    setDisertadorNombre(texto);
    setValue('disertador_id', '');
  }

  function seleccionarDisertador(persona: PersonaBusqueda) {
    setValue('disertador_id', persona.id);
    setDisertadorNombre(persona.nombre_completo);
  }

  function toggleAsistente(personaId: string, esVisita: boolean) {
    const actual = asistentes.get(personaId);
    const seQuita = actual && actual.esVisita === esVisita;
    setAsistentes((prev) => {
      const next = new Map(prev);
      if (seQuita) {
        next.delete(personaId);
      } else {
        next.set(personaId, { esVisita, esMenor: prev.get(personaId)?.esMenor });
      }
      return next;
    });
    if (seQuita) {
      quitarDeColaFechaNacimiento(personaId);
    } else {
      // KAN-422: se agrega (no se quita) a alguien sin fecha de nacimiento
      // -- se encola para preguntarle en el modal.
      const persona = poolAsistenciaUnico.find((m) => m.persona_id === personaId);
      if (persona) encolarSiFaltaFecha(personaId, persona.nombre_completo, persona.tiene_fecha_nacimiento);
    }
  }

  function cambiarEsMenorAsistente(personaId: string, esMenor: boolean) {
    setAsistentes((prev) => {
      const next = new Map(prev);
      const actual = next.get(personaId);
      if (actual) next.set(personaId, { ...actual, esMenor });
      return next;
    });
  }

  // KAN-16: checkbox "Asiste a esta CDP" por persona (inverso de esVisita).
  // No toca casa_de_paz_membresia -- solo cambia el valor que se guarda en
  // este registro de asistencia puntual.
  function cambiarAsisteCdp(personaId: string, asiste: boolean) {
    setAsistentes((prev) => {
      const next = new Map(prev);
      const actual = next.get(personaId);
      if (actual) next.set(personaId, { ...actual, esVisita: !asiste });
      return next;
    });
  }

  // Pedido del owner (2026-09-03): una persona que no está en el sistema y se
  // carga desde "Asistentes nuevos" salió a evangelizarse ese día -- no tiene
  // sentido pedirle al líder que la cargue una segunda vez en Evangelismo.
  // Se agrega como visita Y como evangelizado pendiente en el mismo momento,
  // linkeados por `clave` (ver visitaNuevaClave) para que al enviar el
  // reporte se cree UNA sola persona, no dos. El tipo de evangelismo queda
  // sin elegir -- el líder lo asigna en la sección Evangelismo (distintas
  // personas nuevas pueden venir de distintos tipos, no hay un default
  // razonable). Si "Salieron a evangelizar" todavía no estaba tildado, se
  // tilda solo para que la sección se despliegue y la persona sea visible.
  function agregarAsistenteNuevo(datos: DatosPersonaNueva) {
    const clave = crypto.randomUUID();
    // Si no dio fecha de nacimiento, se usa la edad aproximada (KAN-406) si
    // la hay -- si tampoco hay edad aproximada, se asume que no es menor. Sin
    // esto, el backend (fn_validar_asistencia) rechaza el reporte entero
    // recién al enviarlo (ASISTENCIA_EDAD_INDEFINIDA), porque antes el
    // checkbox "es menor" siempre mandaba un valor definido y ahora la fecha
    // es opcional.
    const esMenor = datos.fecha_nacimiento
      ? calcularEdad(datos.fecha_nacimiento) < edadMinima
      : datos.edad_aproximada !== undefined
        ? datos.edad_aproximada < edadMinima
        : false;
    setVisitasNuevas((prev) => [
      ...prev,
      {
        clave,
        primer_nombre: datos.primer_nombre,
        segundo_nombre: datos.segundo_nombre,
        primer_apellido: datos.primer_apellido,
        segundo_apellido: datos.segundo_apellido,
        sexo: datos.sexo,
        es_menor: esMenor,
        fecha_nacimiento: datos.fecha_nacimiento,
        edad_aproximada: datos.edad_aproximada,
        telefono: datos.telefono,
        acepto_a_cristo: datos.acepto_a_cristo,
      },
    ]);
    setEvangelizadosPendientes((prev) => [
      ...prev,
      {
        clave: `v-${clave}`,
        visitaNuevaClave: clave,
        nombre_completo: [datos.primer_nombre, datos.segundo_nombre, datos.primer_apellido, datos.segundo_apellido].filter(Boolean).join(' '),
        primer_nombre: datos.primer_nombre,
        segundo_nombre: datos.segundo_nombre,
        primer_apellido: datos.primer_apellido,
        segundo_apellido: datos.segundo_apellido,
        sexo: datos.sexo,
        domicilio: datos.domicilio,
        telefono: datos.telefono,
        fecha_nacimiento: datos.fecha_nacimiento,
      },
    ]);
    if (!salioEvangelizar) setValue('salio_evangelizar', true);
  }

  function quitarVisitaNueva(clave: string) {
    setVisitasNuevas((prev) => prev.filter((v) => v.clave !== clave));
    // Espejo: la entrada de Evangelismo que vino de esta misma alta se va con ella.
    setEvangelizadosPendientes((prev) => prev.filter((p) => p.visitaNuevaClave !== clave));
  }

  // Persona ya existente en el sistema (encontrada por la búsqueda global de
  // "Asistentes nuevos") que asiste como visita -- no se crea una persona
  // nueva, se reutiliza su persona_id. No se sabe su fecha de nacimiento
  // desde este buscador (PersonaBusqueda no la trae), así que se encola de
  // una para el modal ModalFechaNacimientoFaltante (ver KAN-422/KAN-435).
  function agregarAsistenteExistente(persona: PersonaBusqueda) {
    setAsistentes((prev) => {
      const next = new Map(prev);
      next.set(persona.id, { esVisita: true });
      return next;
    });
    setAsistentesNuevosExistentes((prev) => [...prev, persona]);
    setTextoAsistenteNuevo('');
    // KAN-422: este buscador nunca trae fecha de nacimiento -- se encola
    // igual que un miembro sin fecha registrada.
    encolarSiFaltaFecha(persona.id, persona.nombre_completo, false);
  }

  function quitarAsistenteExistente(personaId: string) {
    setAsistentes((prev) => {
      const next = new Map(prev);
      next.delete(personaId);
      return next;
    });
    setAsistentesNuevosExistentes((prev) => prev.filter((p) => p.id !== personaId));
    quitarDeColaFechaNacimiento(personaId);
  }

  // Pedido del owner (2026-09-03): agregar a alguien en Evangelismo pregunta
  // si también asistió -- no se asume. "Sí" cuenta como asistente (persona
  // existente: entra directo al mapa con esVisita=true; persona nueva
  // cargada a mano: se linkea a una NuevaVisita, mismo mecanismo que
  // agregarAsistenteNuevo en sentido inverso, para no duplicar el alta).
  // "No" queda solo en Evangelismo. agregarNueva() de EvangelismoPendientePanel
  // ya exige nombre/apellido/sexo, así que una persona nueva siempre viene
  // completa acá.
  function agregarEvangelizado(p: EvangelizadoPendiente) {
    setPendienteConfirmarAsistente(p);
  }

  function confirmarEsAsistenteNuevo(esAsistente: boolean) {
    const p = pendienteConfirmarAsistente;
    if (!p) return;
    setPendienteConfirmarAsistente(null);

    if (!esAsistente) {
      setEvangelizadosPendientes((prev) => [...prev, p]);
      return;
    }

    if (p.persona_id) {
      // esMenor: false de una -- sin esto, alguien sin fecha de nacimiento
      // cargada dispararía el modal ModalFechaNacimientoFaltante para una
      // persona que ya existía en el sistema, no una recién creada; el
      // owner pidió que en este flujo se guarde directo sin preguntar.
      setAsistentes((prev) => {
        const next = new Map(prev);
        next.set(p.persona_id as string, { esVisita: true, esMenor: false });
        return next;
      });
      setEvangelizadosPendientes((prev) => [...prev, p]);
      return;
    }

    const clave = crypto.randomUUID();
    // fecha_nacimiento viene del mismo formulario que Domicilio/Teléfono en
    // EvangelismoPendientePanel -- antes se perdía acá (no se copiaba a la
    // NuevaVisita), pedido del owner (2026-09-04) de unificar los dos
    // formularios para que ningún dato se pierda según por dónde se cargue.
    setVisitasNuevas((prev) => [
      ...prev,
      {
        clave,
        primer_nombre: p.primer_nombre ?? '',
        segundo_nombre: p.segundo_nombre,
        primer_apellido: p.primer_apellido ?? '',
        segundo_apellido: p.segundo_apellido,
        sexo: p.sexo ?? 'M',
        // Sin fecha de nacimiento se asume que no es menor -- mismo motivo
        // que en agregarAsistenteNuevo (evitar el rechazo del backend).
        es_menor: p.fecha_nacimiento ? calcularEdad(p.fecha_nacimiento) < edadMinima : false,
        fecha_nacimiento: p.fecha_nacimiento,
        telefono: p.telefono,
      },
    ]);
    setEvangelizadosPendientes((prev) => [...prev, { ...p, visitaNuevaClave: clave }]);
  }

  // Espejo de quitarVisitaNueva pero al revés: si lo que se saca vino de
  // "Asistentes nuevos" (visitaNuevaClave) o es una persona existente
  // agregada directo en Evangelismo (persona_id), deja de contar como
  // asistente del todo -- no tiene sentido que siga marcada si el líder
  // decide que en realidad no corresponde. Si es nueva cargada a mano en
  // Evangelismo, se saca de ambos lados por el mismo motivo (se agregó a la
  // vez, ver agregarEvangelizado).
  function quitarEvangelizadoPendiente(clave: string) {
    const entrada = evangelizadosPendientes.find((p) => p.clave === clave);
    if (entrada?.visitaNuevaClave) {
      setVisitasNuevas((prev) => prev.filter((v) => v.clave !== entrada.visitaNuevaClave));
    }
    if (entrada?.persona_id) {
      setAsistentes((prev) => {
        const next = new Map(prev);
        next.delete(entrada.persona_id as string);
        return next;
      });
    }
    setEvangelizadosPendientes((prev) => prev.filter((p) => p.clave !== clave));
  }

  function cambiarTipoEvangelizado(clave: string, tipoId: string) {
    const tipo = tiposEvangelismo.find((t) => t.id === tipoId);
    setEvangelizadosPendientes((prev) =>
      prev.map((p) =>
        p.clave === clave
          ? { ...p, tipo_evangelismo_id: tipo?.id, tipo_evangelismo_nombre: tipo?.nombre, tipo_evangelismo_color: tipo?.color }
          : p
      )
    );
  }

  function agregarDiezmanteExistente(persona: PersonaBusqueda) {
    setDiezmos((prev) => {
      if (prev.some((d) => d.personaId === persona.id)) return prev; // ya está en la lista
      return [...prev, { clave: crypto.randomUUID(), personaId: persona.id, nombre_completo: persona.nombre_completo, monto: 0 }];
    });
    setTextoBuscadorDiezmante('');
  }

  function agregarDiezmanteManual() {
    if (!nombreDiezmante.trim() || !apellidoDiezmante.trim() || !sexoDiezmante) return;
    const monto = Number(montoDiezmanteManual);
    setDiezmos((prev) => [
      ...prev,
      {
        clave: crypto.randomUUID(),
        nombre_completo: `${nombreDiezmante.trim()} ${apellidoDiezmante.trim()}`,
        primer_nombre: nombreDiezmante.trim(),
        primer_apellido: apellidoDiezmante.trim(),
        sexo: sexoDiezmante,
        telefono: telefonoDiezmante.trim() || undefined,
        monto: Number.isFinite(monto) && monto > 0 ? monto : 0,
      },
    ]);
    cancelarDiezmanteManual();
  }

  // Bug real encontrado (pedido del owner, 2026-09-17): no había forma de
  // cerrar este mini-formulario sin completarlo -- si alguien lo abría, se
  // arrepentía o borraba lo que había escrito, quedaba atascado ahí (el
  // botón "Agregar" no hacía nada sin nombre/apellido/sexo, y no había
  // Cancelar/X). Mismo patrón que ya usan "Asistentes nuevos"/Evangelismo.
  function cancelarDiezmanteManual() {
    setNombreDiezmante('');
    setApellidoDiezmante('');
    setSexoDiezmante('');
    setTelefonoDiezmante('');
    setMontoDiezmanteManual('');
    setMostrarFormDiezmante(false);
  }

  function cambiarMontoDiezmo(clave: string, monto: number) {
    setDiezmos((prev) => prev.map((d) => (d.clave === clave ? { ...d, monto } : d)));
  }

  function quitarDiezmo(clave: string) {
    setDiezmos((prev) => prev.filter((d) => d.clave !== clave));
  }

  const totalDiezmosCalc = diezmos.reduce((suma, d) => suma + (d.monto || 0), 0);

  const idsNuevos = Array.from(asistentes.entries())
    .filter(([, v]) => v.esVisita)
    .map(([id]) => id);

  // Personas ya existentes agregadas directo desde Evangelismo (persona_id) Y
  // que el líder confirmó como asistentes en el modal (quedaron en el mapa
  // `asistentes` -- si contestó "No" en el modal, no están ahí y no
  // aparecen acá). Excluye las que en realidad vinieron al revés (desde
  // "Asistentes nuevos", visitaNuevaClave) -- esas ya se muestran como visita.
  const evangelizadosExistentesComoAsistentes = evangelizadosPendientes.filter(
    (p) => p.persona_id && !p.visitaNuevaClave && idsNuevos.includes(p.persona_id)
  );
  const idsSinVisita = Array.from(asistentes.entries())
    .filter(([, v]) => !v.esVisita)
    .map(([id]) => id);
  const idsRegulares = idsSinVisita.filter((id) => {
    const m = miembros.find((mm) => mm.persona_id === id);
    return !m || m.edad === null || m.edad >= edadMinima;
  });
  const idsNinos = idsSinVisita.filter((id) => {
    const m = miembros.find((mm) => mm.persona_id === id);
    return !!m && m.edad !== null && m.edad < edadMinima;
  });
  const esMenorPorPersona: Record<string, boolean> = {};
  const asisteCdpPorPersona: Record<string, boolean> = {};
  for (const [id, v] of asistentes) {
    if (v.esMenor !== undefined) esMenorPorPersona[id] = v.esMenor;
    asisteCdpPorPersona[id] = !v.esVisita;
  }
  // Cada lista excluye a quien ya está seleccionado en otra, para que no se pueda marcar a la misma persona dos veces.
  // El corte "niño" vs. "regular" usa edadMinima (configurable por iglesia): cuando alguien
  // cumple esa edad, pasa solo a la lista de regulares en el siguiente render, sin acción manual.
  const poolRegulares = miembros.filter((m) => (m.edad === null || m.edad >= edadMinima) && !idsNuevos.includes(m.persona_id));
  const poolNinos = miembros.filter((m) => m.edad !== null && m.edad < edadMinima && !idsNuevos.includes(m.persona_id));
  // KAN-391 (2026-09-17, pedido del owner): un solo campo de búsqueda para
  // nuevos+regulares+niños -- regulares y niños particionan `miembros` sin
  // solapar (ver filtros de arriba), así que la unión es directa. La
  // clasificación real sigue siendo automática por edad vía idsRegulares/
  // idsNinos, esto solo unifica el buscador.
  const poolAsistenciaUnico = [...poolRegulares, ...poolNinos];

  // Búsqueda global de "Asistentes nuevos": excluye a quien ya es miembro de
  // esta CdP (esa persona corresponde a "Asistencia regular"/"de niños", no
  // acá) y a quien ya está marcado como asistente por cualquier otra vía,
  // para no ofrecerla dos veces.
  const resultadosAsistenteNuevoFiltrados = resultadosAsistenteNuevo.filter(
    (p) => !miembros.some((m) => m.persona_id === p.id) && !asistentes.has(p.id)
  );

  // Se usa en la descripción de la sección "Asistencia" más abajo.
  const totalAsistentesActual = idsNuevos.length + idsRegulares.length + idsNinos.length + visitasNuevas.length;

  // KAN-392: camino de guardado totalmente aparte de onSubmit -- no pasa por
  // react-hook-form/zod (el formulario normal ni se muestra cuando
  // `reunionNoRealizada` está tildado), solo motivo + fecha_reunion (mismo
  // input de fecha de siempre, reusado).
  async function enviarReunionNoRealizada() {
    if (!cdpActiva || !iglesiaActivaId || !motivoNoRealizada.trim()) return;
    try {
      await crearNoRealizada.mutateAsync({
        iglesia_id: iglesiaActivaId,
        casa_de_paz_id: cdpActiva,
        fecha_reunion: fechaReunion,
        motivo: motivoNoRealizada.trim(),
      });
      toast.success('Semana registrada como reunión no realizada');
      setReunionNoRealizada(false);
      setMotivoNoRealizada('');
      reset({ fecha_reunion: hoy, salio_evangelizar: false, moneda_id: monedas[0]?.moneda_id });
    } catch (e) {
      const error = e as { code?: string; message?: string } | null;
      if (error?.code === '23505') {
        toast.error('Ya existe un reporte para esa fecha en esta Casa de Paz.');
      } else {
        toast.error('No se pudo guardar');
      }
    }
  }

  async function onSubmit(valores: FormValues) {
    if (!cdpActiva || !iglesiaActivaId) return;

    // Cierra el teclado en mobile antes de validar/enviar -- si quedaba
    // abierto (por ejemplo, viniendo de escribir en Comentarios), el toast
    // de error ("ya existe un reporte para esa fecha", etc.) podía quedar
    // tapado por el teclado y sentirse como que el botón no hizo nada
    // (reportado por el owner, 2026-09-05).
    (document.activeElement as HTMLElement | null)?.blur?.();

    if (totalAsistentesActual === 0) {
      toast.error('Marcá al menos una persona antes de enviar el reporte');
      return;
    }

    for (const v of visitasNuevas) {
      if (v.es_menor === undefined) {
        toast.error(`Indicá si ${v.primer_nombre} ${v.primer_apellido} es menor`);
        return;
      }
    }

    const diezmoSinMonto = diezmos.find((d) => !(d.monto > 0));
    if (diezmoSinMonto) {
      toast.error(`Ingresá el monto del diezmo de ${diezmoSinMonto.nombre_completo}`);
      return;
    }

    // KAN-423: una línea de testimonio a medias (categoría sin texto, o
    // texto sin categoría elegida) no se guarda silenciosamente -- se avisa
    // para que la complete o la quite antes de enviar.
    const testimonioAMedias = testimoniosCategorizados.find((t) => !!t.categoria !== !!t.texto.trim());
    if (testimonioAMedias) {
      toast.error(
        testimonioAMedias.categoria ? 'Falta el texto de uno de los testimonios' : 'Elegí la categoría de uno de los testimonios'
      );
      return;
    }

    // El backend exige estos campos según la configuración de la iglesia
    // (trigger fn_validar_campos_reporte) pero el formulario no lo mostraba
    // antes de intentar enviar -- se valida acá con el mismo criterio para
    // avisar de una sin necesidad de un viaje al servidor.
    // KAN-373: elegir "Tema especial" sin describirlo no es un tema real --
    // se bloquea siempre, sin importar si el tema es obligatorio en esta
    // iglesia (mismo criterio que ya exige el backend, fn_validar_campos_reporte).
    if (valores.tema_id === TEMA_ESPECIAL_SENTINEL && !valores.tema_especial_txt?.trim()) {
      toast.error('Describí el tema especial');
      return;
    }
    if (campos?.REPORTE_TEMA_OBLIGATORIO && !valores.tema_id) {
      toast.error('El tema es obligatorio en esta iglesia');
      return;
    }
    if (campos?.REPORTE_DISERTADOR_OBLIGATORIO && !valores.disertador_id) {
      toast.error('El disertador es obligatorio en esta iglesia');
      return;
    }
    if (campos?.REPORTE_TESTIMONIOS_OBLIGATORIO && !valores.testimonios?.trim()) {
      toast.error('El testimonio es obligatorio en esta iglesia');
      return;
    }

    try {
      const datosComunes = {
        casa_de_paz_id: cdpActiva,
        iglesia_id: iglesiaActivaId,
        fecha_reunion: valores.fecha_reunion,
        libro_id: valores.libro_id,
        // KAN-373: el sentinel no es un tema_id real -- se manda null y el
        // texto libre queda como el único registro del tema.
        tema_id: valores.tema_id === TEMA_ESPECIAL_SENTINEL ? undefined : valores.tema_id,
        tema_especial_txt: esTemaEspecial ? valores.tema_especial_txt : undefined,
        disertador_id: valores.disertador_id,
        // KAN-409: el reporte normal ya no se vincula a una Megafiesta acá --
        // ese vínculo ahora solo lo crea el formulario reducido
        // (crearReporteMegafiesta/onSubmitMegafiesta), evolución del checkbox
        // viejo "Fue la Mega Fiesta de Casas de Paz" que se retiró.
        salio_evangelizar: valores.salio_evangelizar,
        evangelizados_declarados: valores.salio_evangelizar
          ? modoEdicion
            ? evangelizadosDeclaradosEdicion
            : evangelizadosPendientes.length
          : undefined,
        testimonios: valores.testimonios,
        testimoniosCategorizados,
        asistentesExistentes: Array.from(asistentes.entries()).map(([id, v]) => ({
          personaId: id,
          esMenor: v.esMenor,
          esVisita: v.esVisita,
        })),
        visitasNuevas,
        totalOfrendas: Number(valores.total_ofrendas),
        diezmos,
        monedaId: valores.moneda_id,
      };

      const resultado = modoEdicion
        ? await actualizar.mutateAsync({ reporteId: reporteId as string, datos: datosComunes })
        : await crear.mutateAsync(datosComunes);

      // KAN-271: en edición el panel de "agregar evangelizado" a mano está
      // oculto (evangelizadosPendientes solo se llena por acá si el líder
      // agrega una persona nueva desde "Asistentes nuevos", que sí sigue
      // disponible en edición).
      if (evangelizadosPendientes.length > 0) {
        // Las que vinieron de "Asistentes nuevos" (visitaNuevaClave) ya
        // tienen su persona creada por crearReporte/actualizarReporte -- se
        // linkea a ESA persona (fn_registrar_evangelizado con persona_id no
        // crea una nueva) en vez de duplicar el alta.
        const personaIdPorVisitaClave = new Map(resultado.visitasNuevasCreadas.map((v) => [v.clave, v.personaId]));
        try {
          // Cada evangelizado es independiente del resto -- antes se creaban
          // uno por uno en serie (N round-trips seguidos), ahora en paralelo.
          await Promise.all(
            evangelizadosPendientes.map((ev) => {
              const personaIdDeVisita = ev.visitaNuevaClave ? personaIdPorVisitaClave.get(ev.visitaNuevaClave) : undefined;
              return crearEvangelizado({
                casa_de_paz_id: cdpActiva,
                iglesia_id: iglesiaActivaId,
                fecha: valores.fecha_reunion,
                persona_id: ev.persona_id ?? personaIdDeVisita,
                primer_nombre: ev.primer_nombre,
                segundo_nombre: ev.segundo_nombre,
                primer_apellido: ev.primer_apellido,
                segundo_apellido: ev.segundo_apellido,
                sexo: ev.sexo,
                domicilio: ev.domicilio,
                telefono: ev.telefono,
                fecha_nacimiento: ev.fecha_nacimiento,
                tipo_evangelismo_id: ev.tipo_evangelismo_id,
              });
            })
          );
          queryClient.invalidateQueries({ queryKey: ['evangelismo'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        } catch {
          toast.error('El reporte se guardó, pero no se pudieron registrar todos los evangelizados');
        }
      }

      // KAN-390 (2026-09-17): "se reconcilió" tildado en alguna pastilla --
      // mejor esfuerzo igual que los evangelizados de arriba, el reporte ya
      // se guardó y no debe revertirse si esto falla.
      const idsReconciliados = Object.entries(reconciliadosPorPersona)
        .filter(([id, marcado]) => marcado && asistentes.has(id))
        .map(([id]) => id);
      if (idsReconciliados.length > 0) {
        try {
          await Promise.all(
            idsReconciliados.map((personaId) =>
              crearEvangelizado({
                casa_de_paz_id: cdpActiva,
                iglesia_id: iglesiaActivaId,
                fecha: valores.fecha_reunion,
                persona_id: personaId,
                es_reconciliacion: true,
              })
            )
          );
          queryClient.invalidateQueries({ queryKey: ['evangelismo'] });
        } catch {
          toast.error('El reporte se guardó, pero no se pudieron registrar todas las reconciliaciones');
        }
      }

      if (modoEdicion) {
        toast.success(
          `Reporte actualizado: ${resultado.totalAsistentes} asistentes (${resultado.totalMenores} menores, ${resultado.totalMayores} mayores)`
        );
        navigate(-1);
        return;
      }

      toast.success(
        `Reporte enviado: ${resultado.totalAsistentes} asistentes (${resultado.totalMenores} menores, ${resultado.totalMayores} mayores)`
      );
      limpiarBorradorEnviado();
      reset({ fecha_reunion: hoy, salio_evangelizar: false, moneda_id: monedas[0]?.moneda_id, testimonios: '' });
      setAsistentes(new Map());
      setVisitasNuevas([]);
      setAsistentesNuevosExistentes([]);
      setTextoAsistenteNuevo('');
      setDiezmos([]);
      setTextoBuscadorDiezmante('');
      setTestimoniosCategorizados([nuevoTestimonioVacio()]);
      setEvangelizadosPendientes([]);
      setReconciliadosPorPersona({});
      setDisertadorNombre('');
    } catch (e) {
      const error = e as { code?: string; message?: string } | null;
      const mensaje = typeof error?.message === 'string' ? error.message : '';
      if (error?.code === '23514' && mensaje.includes('chk_reporte_fecha')) {
        toast.error('La fecha de la reunión no puede ser en el futuro');
      } else if (error?.code === '23505' && mensaje.includes('uq_reporte_cdp_fecha')) {
        // Índice único (casa_de_paz_id, fecha_reunion): ya hay un reporte para esa
        // reunión. Antes esto dejaba crear duplicados; ahora se avisa y se apunta
        // a editar el existente en vez de generar otro.
        toast.error('Ya existe un reporte para esa fecha en esta Casa de Paz. Editá el existente en vez de crear otro.');
      } else if (mensaje.includes('ASISTENCIA_EDAD_INDEFINIDA')) {
        // Red de seguridad: el modal ModalFechaNacimientoFaltante ya obliga a
        // declarar si cada persona sin fecha de nacimiento es menor, pero por
        // si acaso llega a pasar, el mensaje es claro en vez del genérico.
        toast.error('Falta indicar si algún asistente sin fecha de nacimiento es menor de edad');
      } else if (mensaje.includes('REPORTE_OFRENDAS_OBLIGATORIO')) {
        toast.error('El total de ofrendas es obligatorio, aunque sea 0');
      } else if (mensaje.includes('CAMPO_OBLIGATORIO')) {
        // Igual que las validaciones de arriba, pero cubre el caso de que la
        // configuración cambie entre que se cargó la página y que se envió el
        // formulario: el mensaje del backend ya trae el detalle en español.
        toast.error(mensaje.split('CAMPO_OBLIGATORIO:')[1]?.trim() || 'Falta completar un campo obligatorio');
      } else {
        toast.error('No se pudo enviar el reporte');
      }
    }
  }

  /**
   * KAN-409: envío del formulario reducido de Megafiesta -- solo fecha +
   * asistencia. Camino de guardado totalmente aparte de onSubmit (mismo
   * patrón que enviarReunionNoRealizada): no pasa por react-hook-form/zod
   * (el schema exige total_ofrendas/moneda_id, campos que este modo ni
   * muestra), llama directo a crearReporteMegafiesta. El backend busca o
   * crea el consolidado (evento tipo MEGA_FIESTA de la Red+fecha) solo --
   * el Líder de CdP puede enviarla sin que el Líder de Red la haya
   * programado antes.
   */
  async function onSubmitMegafiesta() {
    if (!cdpActiva || !iglesiaActivaId) return;
    (document.activeElement as HTMLElement | null)?.blur?.();

    if (totalAsistentesActual === 0) {
      toast.error('Marcá al menos una persona antes de enviar el reporte');
      return;
    }
    for (const v of visitasNuevas) {
      if (v.es_menor === undefined) {
        toast.error(`Indicá si ${v.primer_nombre} ${v.primer_apellido} es menor`);
        return;
      }
    }

    try {
      const resultado = await crearMegafiesta.mutateAsync({
        casa_de_paz_id: cdpActiva,
        iglesia_id: iglesiaActivaId,
        fecha_reunion: fechaReunion,
        asistentesExistentes: Array.from(asistentes.entries()).map(([id, v]) => ({ personaId: id, esMenor: v.esMenor, esVisita: v.esVisita })),
        visitasNuevas,
      });
      toast.success(
        `Megafiesta enviada: ${resultado.totalAsistentes} asistentes (${resultado.totalMenores} menores, ${resultado.totalMayores} mayores)`
      );
      reset({ fecha_reunion: hoy, salio_evangelizar: false, moneda_id: monedas[0]?.moneda_id });
      setAsistentes(new Map());
      setVisitasNuevas([]);
      setAsistentesNuevosExistentes([]);
      setTextoAsistenteNuevo('');
      setEsMegafiestaForm(false);
    } catch (e) {
      const error = e as { code?: string; message?: string } | null;
      const mensaje = typeof error?.message === 'string' ? error.message : '';
      if (error?.code === '23514' && mensaje.includes('chk_reporte_fecha')) {
        toast.error('La fecha de la reunión no puede ser en el futuro');
      } else if (error?.code === '23505' && mensaje.includes('uq_reporte_cdp_fecha')) {
        toast.error('Ya existe un reporte para esa fecha en esta Casa de Paz. Editá el existente en vez de crear otro.');
      } else if (mensaje.includes('ASISTENCIA_EDAD_INDEFINIDA')) {
        toast.error('Falta indicar si algún asistente sin fecha de nacimiento es menor de edad');
      } else if (mensaje.includes('MEGAFIESTA_SIN_RED')) {
        toast.error('Tu Casa de Paz no pertenece a ninguna Red activa -- no se puede reportar una Megafiesta');
      } else {
        toast.error('No se pudo enviar el reporte de la Megafiesta');
      }
    }
  }

  /**
   * KAN-409: sección "Asistencia" extraída a una función local (no un
   * componente separado -- se invoca como `{renderAsistenciaSection()}`,
   * nunca como `<RenderAsistenciaSection/>`, para no crear un nuevo tipo de
   * componente en cada render, que forzaría un remount completo -- incluido
   * el foco del buscador -- en cada tecla escrita). Se reusa tal cual entre
   * el formulario completo y el formulario reducido de Megafiesta (mismo
   * criterio de asistencia en los dos).
   */
  function renderAsistenciaSection() {
    // KAN-435: datos de la persona con la ficha rápida abierta -- busca en
    // los 3 orígenes posibles (miembros regulares, niños, encontrada por
    // búsqueda global) porque cada uno trae un shape distinto.
    const fichaRapidaMiembro = fichaRapidaId
      ? (poolRegulares.find((m) => m.persona_id === fichaRapidaId) ?? poolNinos.find((m) => m.persona_id === fichaRapidaId))
      : undefined;
    const fichaRapidaExistente = !fichaRapidaMiembro && fichaRapidaId ? asistentesNuevosExistentes.find((p) => p.id === fichaRapidaId) : undefined;
    const fichaRapidaDatos = fichaRapidaMiembro
      ? {
          nombreCompleto: fichaRapidaMiembro.nombre_completo,
          estadoSigla: fichaRapidaMiembro.estado_sigla,
          edad: fichaRapidaMiembro.edad,
          tieneFechaNacimiento: fichaRapidaMiembro.tiene_fecha_nacimiento,
        }
      : fichaRapidaExistente
        ? { nombreCompleto: fichaRapidaExistente.nombre_completo, estadoSigla: undefined, edad: null, tieneFechaNacimiento: false }
        : undefined;

    return (
      <>
        <section className={CARD_SECCION_CON_DESPLEGABLE}>
          <div className="overflow-hidden rounded-t-2xl">
            <TarjetaHeader
              icon={Users}
              color={TEAL}
              titulo="Asistencia"
              descripcion={`${totalAsistentesActual} persona${totalAsistentesActual === 1 ? '' : 's'} marcada${totalAsistentesActual === 1 ? '' : 's'} hasta ahora`}
            />
          </div>
          <div className="flex flex-col gap-4 p-5">
                {cargandoMiembros ? (
                  <Skeleton className="h-32 w-full" />
                ) : (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">Asistencia</Label>
                      {/* KAN-391 (2026-09-17, pedido del owner): un solo campo
                          busca a la vez en el pool de la CdP (regulares+niños,
                          poolAsistenciaUnico) y en toda la iglesia
                          (resultadosAsistenteNuevoFiltrados + alta de persona
                          nueva) -- antes eran 3 buscadores separados y había
                          que adivinar en cuál escribir si la persona ya
                          existía en otra CdP. La clasificación nuevo/regular/
                          niño sigue siendo automática (esVisita + edad, sin
                          tocar esa lógica); acá solo se unifica el campo de
                          entrada -- el resultado se sigue mostrando agrupado
                          abajo en las mismas 3 categorías visuales de
                          siempre (ocultarResultados suprime las pastillas
                          propias del componente, se arman a mano por grupo). */}
                      <BuscadorPersonaMultiple
                        titulo="Buscar persona"
                        iglesiaId={iglesiaActivaId}
                        miembros={poolAsistenciaUnico}
                        seleccionados={idsSinVisita}
                        onToggle={(id) => toggleAsistente(id, false)}
                        placeholder="Escribí el nombre de la persona..."
                        colorChip={AZUL}
                        esMenorPorPersona={esMenorPorPersona}
                        onEsMenorChange={cambiarEsMenorAsistente}
                        asisteCdpPorPersona={asisteCdpPorPersona}
                        onAsisteCdpChange={cambiarAsisteCdp}
                        idsOriginales={modoEdicion ? idsAsistentesOriginales : undefined}
                        permitirAgregarNueva
                        onAgregarNueva={agregarAsistenteNuevo}
                        resultadosBusquedaGlobal={resultadosAsistenteNuevoFiltrados}
                        buscandoGlobal={buscandoAsistenteNuevo}
                        onSeleccionarGlobal={agregarAsistenteExistente}
                        onTextoCambia={setTextoAsistenteNuevo}
                        ocultarResultados
                        mostrarOrigenBusquedaGlobal={!esRolCdp || (campos?.REPORTE_MOSTRAR_ORIGEN_ASISTENTE ?? true)}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Asistentes nuevos ({visitasNuevas.length + evangelizadosExistentesComoAsistentes.length + asistentesNuevosExistentes.length})
                      </Label>
                      {(visitasNuevas.length > 0 || evangelizadosExistentesComoAsistentes.length > 0 || asistentesNuevosExistentes.length > 0) ? (
                        <div className="flex flex-wrap gap-1.5">
                          {visitasNuevas.map((v) => (
                            <span
                              key={v.clave}
                              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                              style={{ backgroundColor: `color-mix(in oklab, ${VERDE} 14%, transparent)`, color: VERDE }}
                            >
                              <UserPlus className="h-3 w-3 shrink-0" />
                              {[v.primer_nombre, v.segundo_nombre, v.primer_apellido, v.segundo_apellido].filter(Boolean).join(' ')}
                              {v.es_menor && <span className="text-[10px] opacity-80">(menor)</span>}
                              <button type="button" onClick={() => quitarVisitaNueva(v.clave)} className="rounded-full p-0.5 hover:bg-black/10">
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                          {evangelizadosExistentesComoAsistentes.map((p) => (
                            <span
                              key={p.clave}
                              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                              style={{ backgroundColor: `color-mix(in oklab, ${VERDE} 14%, transparent)`, color: VERDE }}
                            >
                              <Check className="h-3 w-3 shrink-0" />
                              {p.nombre_completo}
                              <button
                                type="button"
                                onClick={() => quitarEvangelizadoPendiente(p.clave)}
                                className="rounded-full p-0.5 hover:bg-black/10"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                          {asistentesNuevosExistentes.map((p) => {
                            // KAN-367 (2026-09-17): mismo criterio que las demás
                            // pastillas -- si ya estaba guardada al abrir el
                            // reporte para editar, se ve en rojo suave.
                            const colorPastilla = idsAsistentesOriginales.has(p.id) ? 'var(--destructive)' : VERDE;
                            return (
                              <button
                                type="button"
                                key={p.id}
                                onClick={() => setFichaRapidaId(p.id)}
                                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80"
                                style={{ backgroundColor: `color-mix(in oklab, ${colorPastilla} 14%, transparent)`, color: colorPastilla }}
                              >
                                <Check className="h-3 w-3 shrink-0" />
                                {p.nombre_completo}
                                {reconciliadosPorPersona[p.id] && <span className="text-[10px] font-semibold opacity-80">RE</span>}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Nadie todavía.</p>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Asistencia regular, mayores de {edadMinima} años ({idsRegulares.length})
                      </Label>
                      {/* KAN-391: ya no tiene buscador propio (unificado
                          arriba) -- estas son las pastillas de quienes
                          quedaron clasificados acá, con los mismos controles
                          de siempre (es menor / asiste a esta CDP) más el
                          nuevo de RE (KAN-390). */}
                      {idsRegulares.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {idsRegulares.map((id) => {
                            const persona = poolRegulares.find((m) => m.persona_id === id);
                            if (!persona) return null;
                            const esOriginal = modoEdicion && idsAsistentesOriginales.has(id);
                            const colorPastilla = esOriginal ? 'var(--destructive)' : AZUL;
                            return (
                              <button
                                type="button"
                                key={id}
                                onClick={() => setFichaRapidaId(id)}
                                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80"
                                style={{ backgroundColor: `color-mix(in oklab, ${colorPastilla} 14%, transparent)`, color: colorPastilla }}
                              >
                                {persona.nombre_completo}
                                {/* KAN-435 (pedido explícito del owner): edad por clasificación
                                    entre paréntesis, y el estado SSVA vigente (SIM/NC/CRE/RE)
                                    -- todo asistente ya registrado tiene uno al llegar a la
                                    iglesia, no solo cuando es NC. */}
                                {persona.edad !== null && (
                                  <span className="text-[10px] opacity-70">({RANGO_EDAD_LABEL_PERSONA[clasificarEdad(persona.edad)]})</span>
                                )}
                                {persona.estado_sigla && (
                                  <span
                                    className="rounded-full px-1 text-[10px] font-semibold"
                                    style={{ backgroundColor: 'rgba(255,255,255,0.5)', color: COLOR_ESTADO_SSVA[persona.estado_sigla] ?? colorPastilla }}
                                  >
                                    {persona.estado_sigla}
                                  </span>
                                )}
                                {reconciliadosPorPersona[id] && <span className="text-[10px] font-semibold opacity-80">RE</span>}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Nadie todavía.</p>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Asistencia de niños, menores de {edadMinima} años ({idsNinos.length})
                      </Label>
                      {idsNinos.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {idsNinos.map((id) => {
                            const persona = poolNinos.find((m) => m.persona_id === id);
                            if (!persona) return null;
                            const esOriginal = modoEdicion && idsAsistentesOriginales.has(id);
                            const colorPastilla = esOriginal ? 'var(--destructive)' : AMBAR;
                            return (
                              <button
                                type="button"
                                key={id}
                                onClick={() => setFichaRapidaId(id)}
                                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80"
                                style={{ backgroundColor: `color-mix(in oklab, ${colorPastilla} 14%, transparent)`, color: colorPastilla }}
                              >
                                {persona.nombre_completo}
                                {persona.edad !== null && (
                                  <span className="text-[10px] opacity-70">({RANGO_EDAD_LABEL_PERSONA[clasificarEdad(persona.edad)]})</span>
                                )}
                                {persona.estado_sigla && (
                                  <span
                                    className="rounded-full px-1 text-[10px] font-semibold"
                                    style={{ backgroundColor: 'rgba(255,255,255,0.5)', color: COLOR_ESTADO_SSVA[persona.estado_sigla] ?? colorPastilla }}
                                  >
                                    {persona.estado_sigla}
                                  </span>
                                )}
                                {reconciliadosPorPersona[id] && <span className="text-[10px] font-semibold opacity-80">RE</span>}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Nadie todavía.</p>
                      )}
                    </div>
                  </>
                )}
          </div>
        </section>

        {fichaRapidaId && fichaRapidaDatos && (
          <FichaRapidaAsistente
            open
            onOpenChange={(v) => !v && setFichaRapidaId(null)}
            personaId={fichaRapidaId}
            nombreCompleto={fichaRapidaDatos.nombreCompleto}
            estadoSigla={fichaRapidaDatos.estadoSigla}
            edad={fichaRapidaDatos.edad}
            tieneFechaNacimiento={fichaRapidaDatos.tieneFechaNacimiento}
            esMenor={esMenorPorPersona[fichaRapidaId]}
            edadMinima={edadMinima}
            esReconciliado={reconciliadosPorPersona[fichaRapidaId] ?? false}
            asisteCdp={asisteCdpPorPersona[fichaRapidaId] ?? true}
            guardandoFecha={actualizarFechaNacimiento.isPending}
            onGuardarFecha={(fecha) => guardarFechaNacimientoFichaRapida(fichaRapidaId, fecha)}
            onGuardarEdadAproximada={(edad) => guardarEdadAproximadaFichaRapida(fichaRapidaId, edad)}
            onCambiarEsMenor={(v) => cambiarEsMenorAsistente(fichaRapidaId, v)}
            onCambiarReconciliacion={(v) => cambiarReconciliacion(fichaRapidaId, v)}
            onCambiarAsisteCdp={(v) => cambiarAsisteCdp(fichaRapidaId, v)}
            onQuitarDelReporte={() => quitarDelReporte(fichaRapidaId)}
            onAbrirFichaCompleta={() => {
              setFichaCompletaId(fichaRapidaId);
              setFichaRapidaId(null);
            }}
          />
        )}
        <FichaPersonaSheet personaId={fichaCompletaId} onOpenChange={(v) => !v && setFichaCompletaId(undefined)} />
      </>
    );
  }

  if (modoEdicion) {
    if (cargandoReporteExistente || cargandoPuedeEditar || !formPrecargado) {
      return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <Skeleton className="h-20 w-full rounded-3xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      );
    }
    if (errorReporteExistente || !reporteExistente) {
      return <ProximamentePlaceholder titulo="Editar reporte" descripcion="No se pudo cargar este reporte." />;
    }
    if (!puedeEditar) {
      if (cargandoPuedeSolicitar) {
        return (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
            <Skeleton className="h-20 w-full rounded-3xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        );
      }
      if (!puedeSolicitarFueraVentana) {
        return (
          <ProximamentePlaceholder
            titulo="Ya no se puede editar"
            descripcion="Este reporte ya pasó tu ventana de edición, o no tenés permiso sobre esta Casa de Paz. Pedile al Líder de Red, Pastor o Supervisor de la Visión en Acción que lo corrija -- ellos tienen más margen y pueden autorizar la edición fuera de ventana."
          />
        );
      }
      // KAN-367: Pastor / Supervisor de la Visión en Acción -- pueden pedir
      // autorización puntual (justificación + OTP) para editar igual.
      return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <DashboardHero
            icon={ClipboardList}
            eyebrow="Editar reporte"
            title={`Reunión del ${fechaLegible(reporteExistente?.fecha_reunion ?? hoy)}`}
            color={colorRed ?? undefined}
          />
          <section className={CARD_SECCION}>
            <div className="flex flex-col gap-4 p-5">
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                <div className="flex flex-col gap-1 text-sm">
                  <p className="font-medium">Este reporte ya pasó la ventana normal de edición</p>
                  <p className="text-muted-foreground">
                    Podés editarlo igual, pero necesitamos un motivo y confirmación por código -- queda registrado quién lo autorizó y por qué.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="justificacion_fuera_ventana">Motivo *</Label>
                <Textarea
                  id="justificacion_fuera_ventana"
                  value={justificacionFueraVentana}
                  onChange={(e) => setJustificacionFueraVentana(e.target.value)}
                  placeholder="Por qué hace falta editar este reporte fuera de la ventana normal"
                />
              </div>
              <CampoOtp value={pinFueraVentana} onChange={setPinFueraVentana} />
              <Button
                type="button"
                className="gap-2 self-start"
                disabled={autorizarFueraVentana.isPending || !justificacionFueraVentana.trim() || pinFueraVentana.length !== 6}
                onClick={solicitarAutorizacionFueraVentana}
              >
                <Pencil className="h-4 w-4" /> Autorizar y modificar
              </Button>
            </div>
          </section>
        </div>
      );
    }
    if (!activado) {
      return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <DashboardHero
            icon={ClipboardList}
            eyebrow="Editar reporte"
            title={`Reunión del ${fechaLegible(reporteExistente?.fecha_reunion ?? hoy)}`}
            color={colorRed ?? undefined}
          />
          <section className={CARD_SECCION}>
            <div className="flex flex-col gap-4 p-5">
              {esCdpAjena && cdpContexto && (
                <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-sm">
                  <p className="font-medium">{cdpContexto.etiqueta}</p>
                  <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <UserRound className="h-3 w-3" /> Anfitrión: {cdpContexto.anfitrion_nombre || '—'}
                  </p>
                  <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {[cdpContexto.direccion, cdpContexto.ciudad].filter(Boolean).join(', ') || '—'}
                  </p>
                </div>
              )}
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                <div className="flex flex-col gap-1 text-sm">
                  <p className="font-medium">Vas a modificar un reporte ya enviado</p>
                  <p className="text-muted-foreground">
                    Puede afectar estadísticas ya calculadas.
                    {diasLimiteEdicionCdp !== undefined &&
                      ` Tenés hasta ${diasLimiteEdicionCdp} día${diasLimiteEdicionCdp === 1 ? '' : 's'} desde que se cargó (configurable en Supervisión).`}
                  </p>
                </div>
              </div>
              <Button type="button" variant="destructive" className="gap-2 self-start" onClick={() => setActivado(true)}>
                <Pencil className="h-4 w-4" /> Modificar este reporte
              </Button>
            </div>
          </section>
        </div>
      );
    }
  } else if (!contextoCdp) {
    return (
      <ProximamentePlaceholder
        titulo="Reporte de Casa de Paz"
        descripcion="Todavía no tenés una Casa de Paz asignada como líder o sublíder, así que no hay reporte que llenar."
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <DashboardHero
        icon={ClipboardList}
        eyebrow={modoEdicion ? 'Editar reporte' : 'Reporte semanal'}
        title={modoEdicion ? `Reunión del ${fechaLegible(reporteExistente?.fecha_reunion ?? hoy)}` : 'Reporte de la reunión'}
        color={colorRed ?? undefined}
      />

      {/* KAN-435 (pedido explícito del owner): distintivo, no una advertencia
          estricta -- solo para orientar de que este reporte en blanco
          corresponde a una semana atrasada (se llegó acá desde el círculo
          rojo del calendario, ?fecha=), no a la reunión de hoy. Se oculta
          si hay conflicto (ver abajo) -- ya no aplica "atrasado" si
          alguien más ya lo envió. */}
      {borradorAplica && fechaQueryParam && !reporteConflictoId && (
        <div
          className="-mt-2 flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-medium"
          style={{
            borderColor: `color-mix(in oklab, ${AMBAR} 35%, transparent)`,
            backgroundColor: `color-mix(in oklab, ${AMBAR} 10%, transparent)`,
            color: AMBAR,
          }}
        >
          <Clock className="h-3.5 w-3.5 shrink-0" />
          Reporte atrasado: semana sin enviar.
        </div>
      )}

      {/* Punto 2 (pedido explícito del owner, 2026-09-23): el borrador que
          se iba a restaurar quedó obsoleto -- alguien ya envió el reporte
          real de esta misma fecha mientras tanto (ej. desde otra
          sesión/cuenta). No se restauran los datos viejos: se ofrece ir a
          editar el reporte real, o descartar este borrador. El caso grave
          (mandar el mismo reporte dos veces) ya lo bloquea el backend
          (uq_reporte_cdp_fecha) -- esto es solo para no hacer descubrir
          el choque recién al final, después de volver a cargar todo. */}
      {reporteConflictoId && (
        <div
          className="-mt-2 flex flex-col gap-2 rounded-xl border px-3 py-2.5 text-[12px] sm:flex-row sm:items-center sm:justify-between"
          style={{
            borderColor: `color-mix(in oklab, ${AZUL} 35%, transparent)`,
            backgroundColor: `color-mix(in oklab, ${AZUL} 8%, transparent)`,
          }}
        >
          <span className="flex items-center gap-2 font-medium" style={{ color: AZUL }}>
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Ya se envió el reporte de esta fecha. Tu borrador quedó desactualizado.
          </span>
          <span className="flex shrink-0 gap-2">
            <Button type="button" size="sm" className="h-7 rounded-lg text-xs" onClick={() => navigate(rutaReporteEditar(reporteConflictoId))}>
              Editar ese reporte
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 rounded-lg text-xs"
              onClick={() => setConfirmandoDescartarBorrador(true)}
            >
              Descartar borrador
            </Button>
          </span>
        </div>
      )}

      {/* Punto 1 (pedido explícito del owner, 2026-09-23): escape manual --
          descartar el borrador y arrancar en blanco, para cuando quedó
          obsoleto o simplemente no se lo quiere seguir. Siempre visible en
          un reporte nuevo (no aparece/desaparece de golpe), pero
          deshabilitado hasta que haya algo real que descartar -- recién
          se activa cuando el autoguardado creó un borrador de verdad
          (pedido explícito del owner: "desactivado a menos que se haga
          una modificación"). */}
      {borradorAplica && !reporteConflictoId && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!borradorId}
          className="-mt-4 h-8 self-end gap-1.5 rounded-lg border-destructive/40 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
          onClick={() => setConfirmandoDescartarBorrador(true)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Descartar borrador y empezar de nuevo
        </Button>
      )}

      {/* KAN-367 (mismo patrón que "Anular reporte" más abajo): advertencia
          destacada en rojo, no un diálogo gris neutro -- pedido explícito
          del owner para que la acción se sienta como lo que es (se pierde
          progreso), aunque nunca toque un reporte ya enviado. */}
      <Dialog open={confirmandoDescartarBorrador} onOpenChange={setConfirmandoDescartarBorrador}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
            <Trash2 className="h-6 w-6 shrink-0 text-destructive" />
            <div className="flex flex-col gap-1">
              <p className="font-semibold text-destructive">Vas a descartar este borrador</p>
              <p className="text-sm text-muted-foreground">Se pierde lo que llevás sin enviar. No afecta ningún reporte ya enviado.</p>
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => setConfirmandoDescartarBorrador(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={descartarBorrador}>
              Sí, empezar de nuevo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* KAN-435 (pedido explícito del owner, versión simplificada tras
          feedback en vivo: "un mensaje es muy largo... un ícono de disco
          flotante que no estorbe"): destello flotante, no clickeable,
          mientras se autoguarda -- aparece con una animación y se
          desvanece solo a los ~1.6s de confirmado el guardado. Nada de
          esto cuenta como reporte real hasta tocar "Enviar reporte" (ver
          limpiarBorradorEnviado); si falla, se avisa con un toast puntual
          en vez de dejar el ícono pegado en un estado de error. */}
      <AnimatePresence>
        {borradorAplica && mostrarIndicadorBorrador && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-none fixed right-5 bottom-5 z-50 flex h-11 w-11 items-center justify-center rounded-full"
            style={{
              backgroundColor: `color-mix(in oklab, ${TEAL} 22%, transparent)`,
              boxShadow: `0 0 18px 3px color-mix(in oklab, ${TEAL} 55%, transparent)`,
            }}
          >
            {estadoBorrador === 'guardando' ? (
              <Loader2 className="h-4.5 w-4.5 animate-spin" style={{ color: TEAL }} />
            ) : (
              <Save className="h-4.5 w-4.5" style={{ color: TEAL }} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* KAN-367 (pedido del owner, 2026-09-17): explica qué significa el
          rojo -- sin esto no queda claro que es "esto ya está guardado", no
          un error. */}
      {modoEdicion && (
        <p className="-mt-2 flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <span className="h-2 w-2 shrink-0 rounded-full bg-destructive/40" />
          Los campos en rojo tienen el dato ya guardado. Al escribir en uno, pasa a blanco para mostrar que lo estás modificando.
        </p>
      )}

      {esCdpAjena && cdpContexto && (
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-sm">
          <p className="font-medium">{cdpContexto.etiqueta}</p>
          <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <UserRound className="h-3 w-3" /> Anfitrión: {cdpContexto.anfitrion_nombre || '—'}
          </p>
          <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <MapPin className="h-3 w-3" /> {[cdpContexto.direccion, cdpContexto.ciudad].filter(Boolean).join(', ') || '—'}
          </p>
        </div>
      )}

      {/* KAN-392 (2026-09-17, pedido del owner): solo tiene sentido al cargar
          un reporte nuevo -- no se ofrece editando uno ya existente.
          KAN-409 (pedido explícito del owner, 2026-09-21): este checkbox y el
          de Megafiesta van lado a lado, mismo tamaño -- grid de 2 columnas en
          desktop, apilados en mobile. Texto de ayuda acortado a pedido del
          owner ("Queda como semana justificada.", nada más). */}
      {!modoEdicion && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label
            className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border/60 bg-card p-4 text-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              className="mt-0.5"
              checked={reunionNoRealizada}
              onCheckedChange={(v) => {
                setReunionNoRealizada(v === true);
                if (v !== true) setMotivoNoRealizada('');
                if (v === true) setEsMegafiestaForm(false);
              }}
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">Esta semana no se realizó la reunión de Casa de Paz</span>
              <span className="text-[12px] text-muted-foreground">Queda como semana justificada.</span>
            </span>
          </label>

          {/* KAN-409: reemplaza el formulario por uno reducido (fecha +
              asistencia) -- el resto (tema/libro, disertador, evangelismo,
              finanzas, testimonio) se completa a nivel del consolidado, no
              acá. El Líder de CdP puede marcar y enviar una Megafiesta aunque
              el Líder de Red no la haya programado antes (se busca o crea sola). */}
          <label
            className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border/60 bg-card p-4 text-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              className="mt-0.5"
              checked={esMegafiestaForm}
              onCheckedChange={(v) => {
                setEsMegafiestaForm(v === true);
                if (v === true) {
                  setReunionNoRealizada(false);
                  setMotivoNoRealizada('');
                }
              }}
            />
            <span className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1.5 font-medium">
                <PartyPopper className="h-4 w-4 text-primary" />
                Esta reunión es una Megafiesta de Casa de Paz
              </span>
              <span className="text-[12px] text-muted-foreground">
                Solo pedimos la fecha y la asistencia -- lo demás lo completa el Líder de Red desde el consolidado.
              </span>
            </span>
          </label>
        </div>
      )}

      {reunionNoRealizada ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fecha_reunion_no_realizada">Fecha de la reunión *</Label>
            <Input
              id="fecha_reunion_no_realizada"
              type="date"
              max={hoy}
              className={CAMPO_ESTILO}
              value={fechaReunion}
              onChange={(e) => setValue('fecha_reunion', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="motivo_no_realizada">Motivo por el que no se realizó la reunión *</Label>
            <Textarea
              id="motivo_no_realizada"
              className={CAMPO_ESTILO}
              value={motivoNoRealizada}
              onChange={(e) => setMotivoNoRealizada(e.target.value)}
              placeholder="Ej: se suspendió por una actividad general de la iglesia"
            />
          </div>
          <Button
            type="button"
            className="h-11 gap-2 self-start rounded-xl"
            disabled={!motivoNoRealizada.trim() || crearNoRealizada.isPending}
            onClick={enviarReunionNoRealizada}
          >
            {crearNoRealizada.isPending ? 'Guardando...' : 'Guardar semana sin reunión'}
          </Button>
        </div>
      ) : esMegafiestaForm ? (
        <div className="flex flex-col gap-6">
          {/* Información general reducida: solo la fecha -- tema/libro/
              disertador no aplican a una Megafiesta (se completan una sola
              vez a nivel del consolidado, no por cada CdP). */}
          <section className={CARD_SECCION_CON_DESPLEGABLE}>
            <div className="overflow-hidden rounded-t-2xl">
              <TarjetaHeader icon={CalendarDays} color={AZUL} titulo="Información general" descripcion="Fecha de la Megafiesta" />
            </div>
            <div className="p-5">
              <div className="flex max-w-xs flex-col gap-1.5">
                <Label htmlFor="fecha_reunion_megafiesta">Fecha de la reunión *</Label>
                <Input
                  id="fecha_reunion_megafiesta"
                  type="date"
                  max={hoy}
                  className={CAMPO_ESTILO}
                  value={fechaReunion}
                  onChange={(e) => setValue('fecha_reunion', e.target.value)}
                />
              </div>
            </div>
          </section>

          {renderAsistenciaSection()}

          <Button
            type="button"
            className="h-11 gap-2 self-start rounded-xl"
            disabled={crearMegafiesta.isPending}
            onClick={onSubmitMegafiesta}
          >
            {crearMegafiesta.isPending ? 'Enviando...' : 'Enviar reporte de Megafiesta'}
          </Button>
        </div>
      ) : (
      <form
        onSubmit={handleSubmit(onSubmit)}
        className={cn('flex flex-col gap-6', modoEdicion && '-mx-4 rounded-3xl p-4 sm:-mx-5 sm:p-5')}
        // KAN-367 (pedido del owner, 2026-09-17): tinte rojo sutil solo en
        // modo edición, para que se note a simple vista que se está
        // modificando un dato ya guardado -- mismo patrón de color-mix que
        // ya usan TarjetaHeader/franjas de sección, no un color plano nuevo.
        style={modoEdicion ? { backgroundColor: `color-mix(in oklab, ${ROJO} 4%, transparent)` } : undefined}
      >
        {/* Información General */}
        <section className={CARD_SECCION_CON_DESPLEGABLE}>
          <div className="overflow-hidden rounded-t-2xl">
            <TarjetaHeader
              icon={CalendarDays}
              color={AZUL}
              titulo="Información general"
              descripcion="Cuándo fue la reunión y quién enseñó"
            />
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="fecha_reunion">Fecha de la reunión *</Label>
                    <Input
                      id="fecha_reunion"
                      type="date"
                      max={hoy}
                      className={claseCampoEdicion(modoEdicion, !!dirtyFields.fecha_reunion)}
                      {...register('fecha_reunion')}
                    />
                    {/* KAN-435 (pedido explícito del owner): el input de fecha nativo
                        no muestra el día de la semana -- se agrega acá al lado, en
                        vivo, según lo que se va eligiendo (el input solo muestra
                        DD/MM/AAAA). */}
                    {fechaReunion && (
                      <p className="text-[11px] text-muted-foreground">
                        {fechaLegibleConDia(fechaReunion).replace(/^./, (c) => c.toUpperCase())}
                      </p>
                    )}
                  </div>

                  {/* KAN-367 (2026-09-17): Disertador sube acá, al lado de la
                      fecha -- antes quedaba al final y ese espacio de al lado
                      de la fecha quedaba vacío en desktop. */}
                  <div className="flex flex-col gap-1.5">
                    <Label>Disertador {campos?.REPORTE_DISERTADOR_OBLIGATORIO && '*'}</Label>
                    <BuscadorPersonaCampo
                      iglesiaId={iglesiaActivaId}
                      cdpId={cdpActiva}
                      valor={disertadorNombre}
                      seleccionado={!!disertadorId}
                      onCambiarTexto={cambiarTextoDisertador}
                      onSeleccionar={seleccionarDisertador}
                      placeholder="Buscar por nombre..."
                      edadMinima={edadMinima}
                    />
                    {/* KAN-419 (2026-09-22): busca primero en tu Casa de Paz,
                        luego en toda tu Red y recién si ahí tampoco aparece,
                        en toda la iglesia. */}
                    <p className="text-[11px] text-muted-foreground">Busca primero en tu Casa de Paz, luego en tu Red, y si no aparece, en toda la iglesia.</p>
                  </div>

                  {/* KAN-367 (2026-09-17): atajo para quien sabe el nombre del
                      tema pero no el libro -- busca en los 13 a la vez y
                      completa Libro+Tema solos. Los selects de abajo siguen
                      funcionando igual para quien sí sabe el libro. */}
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <Label>Buscar tema</Label>
                    <BuscadorTemaCampo
                      iglesiaId={iglesiaActivaId}
                      onSeleccionar={(nuevoLibroId, nuevoTemaId) => {
                        setValue('libro_id', nuevoLibroId, { shouldDirty: true });
                        // tema_id se aplica solo (ver useEffect de temaIdPendiente)
                        // recién cuando useTemas ya trajo los temas de este libro.
                        setTemaIdPendiente(nuevoTemaId);
                      }}
                    />
                    <p className="text-[11px] text-muted-foreground">Si sabés el libro, también podés elegirlo directo abajo.</p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label>Libro {campos?.REPORTE_TEMA_OBLIGATORIO && '*'}</Label>
                    <Select
                      value={libroId ?? ''}
                      onValueChange={(v) => {
                        setValue('libro_id', v, { shouldDirty: true });
                        // Si había un tema pendiente de una selección previa
                        // por el buscador (de otro libro), un cambio manual
                        // de libro lo invalida -- si no, podría aplicarse
                        // tarde y de sorpresa si se vuelve a ese libro después.
                        setTemaIdPendiente(undefined);
                      }}
                    >
                      <SelectTrigger className={cn('w-full', claseCampoEdicion(modoEdicion, !!dirtyFields.libro_id))}>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {libros.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            Libro {l.numero} — {l.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label>Tema {campos?.REPORTE_TEMA_OBLIGATORIO && '*'}</Label>
                    <Select
                      value={temaId ?? ''}
                      onValueChange={(v) => {
                        setValue('tema_id', v, { shouldDirty: true });
                        // Elección manual gana sobre cualquier tema pendiente
                        // del buscador que todavía no se haya aplicado.
                        setTemaIdPendiente(undefined);
                      }}
                      disabled={!libroId}
                    >
                      <SelectTrigger className={cn('w-full', claseCampoEdicion(modoEdicion, !!dirtyFields.tema_id))}>
                        <SelectValue placeholder={libroId ? '—' : 'Elegí primero un libro'} />
                      </SelectTrigger>
                      <SelectContent>
                        {temas.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.es_especial ? 'Especial: ' : `${t.numero}. `}
                            {t.nombre}
                          </SelectItem>
                        ))}
                        {/* KAN-373: disponible en cualquier libro, no depende
                            de que el catálogo tenga una fila es_especial
                            para el libro elegido (hoy solo 2 de 13 la tienen). */}
                        <SelectItem value={TEMA_ESPECIAL_SENTINEL}>Especial: tema fuera del libro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {esTemaEspecial && (
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <Label htmlFor="tema_especial_txt">Descripción del tema especial</Label>
                      <Input
                        id="tema_especial_txt"
                        className={claseCampoEdicion(modoEdicion, !!dirtyFields.tema_especial_txt)}
                        {...register('tema_especial_txt')}
                      />
                    </div>
                  )}
                </div>
          </div>
        </section>

        {/* Evangelismo */}
        {campos?.REPORTE_SALIO_EVANGELIZAR_VISIBLE && (
          <section className={CARD_SECCION_CON_DESPLEGABLE}>
            <div className="overflow-hidden rounded-t-2xl">
              <TarjetaHeader
                icon={HeartHandshake}
                color={DEPARTAMENTO_META.EVANGELISMO.color}
                titulo="Evangelismo"
                descripcion="¿Salieron a evangelizar en esta reunión?"
              />
            </div>
            <div className="flex flex-col gap-4 p-5">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={salioEvangelizar} onCheckedChange={(v) => setValue('salio_evangelizar', v === true)} />
                    Salieron a evangelizar
                  </label>
                  {salioEvangelizar && modoEdicion && (
                    // KAN-271: en edición no se reabre el alta de evangelizados
                    // (ya se creó su registro de Evangelismo al enviar el
                    // reporte original) -- solo se corrige el conteo.
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="evangelizados_declarados">Evangelizados</Label>
                      <Input
                        id="evangelizados_declarados"
                        type="number"
                        min="0"
                        value={evangelizadosDeclaradosEdicion ?? ''}
                        onChange={(e) => setEvangelizadosDeclaradosEdicion(e.target.value === '' ? undefined : Number(e.target.value))}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Solo corrige el conteo del reporte -- no vuelve a crear los registros de Evangelismo.
                      </p>
                    </div>
                  )}
                  {/* En edición el alta manual (buscar y agregar un evangelizado
                      cualquiera) sigue oculta -- KAN-271, para no reabrir ese
                      flujo sobre un reporte ya enviado. Pero si el líder agrega
                      un asistente nuevo desde "Asistentes nuevos" durante la
                      edición, esa persona SÍ necesita poder elegir su tipo de
                      evangelismo acá, así que el panel (con la lista y el
                      selector de tipo) igual se muestra en ese caso puntual. */}
                  {salioEvangelizar && (!modoEdicion || evangelizadosPendientes.length > 0) && (
                    <EvangelismoPendientePanel
                      iglesiaId={iglesiaActivaId}
                      soloListado={modoEdicion}
                      pendientes={evangelizadosPendientes}
                      onAgregar={agregarEvangelizado}
                      onQuitar={quitarEvangelizadoPendiente}
                      onCambiarTipo={cambiarTipoEvangelizado}
                    />
                  )}
            </div>
          </section>
        )}

        {renderAsistenciaSection()}

        {/* Finanzas */}
        <section className={CARD_SECCION_CON_DESPLEGABLE}>
          <div className="overflow-hidden rounded-t-2xl">
            <TarjetaHeader icon={DollarSign} color={VERDE} titulo="Finanzas" descripcion="Ofrendas y diezmos recogidos en la reunión" />
          </div>
          <div className="flex flex-col gap-5 p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="total_ofrendas">Total ofrendas *</Label>
                    <Input
                      id="total_ofrendas"
                      type="number"
                      step="0.01"
                      min="0"
                      className={claseCampoEdicion(modoEdicion, !!dirtyFields.total_ofrendas)}
                      {...register('total_ofrendas')}
                    />
                    {errors.total_ofrendas ? (
                      <p className="text-sm text-destructive">{errors.total_ofrendas.message}</p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">Obligatorio, aunque sea 0</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Moneda</Label>
                    <Select
                      value={monedaId ?? ''}
                      onValueChange={(v) => setValue('moneda_id', v, { shouldValidate: true, shouldDirty: true })}
                    >
                      <SelectTrigger className={cn('w-full', claseCampoEdicion(modoEdicion, !!dirtyFields.moneda_id))}>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {monedas.map((m) => (
                          <SelectItem key={m.moneda_id} value={m.moneda_id}>
                            {m.simbolo} {m.codigo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.moneda_id ? (
                      <p className="text-sm text-destructive">
                        {monedas.length === 0
                          ? 'No hay monedas activas para esta iglesia. Pedile a tu Pastor o Supervisor que active una en el Panel.'
                          : errors.moneda_id.message}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">Obligatorio</p>
                    )}
                  </div>
                </div>

            {/* Diezmos por persona: cada diezmante con su monto (+ celular
                opcional). Prioriza miembros de esta Casa de Paz (Q-MR-12) y
                cae a toda la iglesia solo si no aparece nadie ahí -- para
                poder anotar a un visitante de otra CdP que diezmó en la
                reunión (2026-09-09, pedido de Matías: antes buscaba en toda
                la iglesia sin ninguna prioridad). O se agrega a mano. Total = suma. */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>Diezmos por persona</Label>
                {diezmos.length > 0 && (
                  <span className="text-sm font-medium text-muted-foreground">
                    Total: {monedas.find((m) => m.moneda_id === monedaId)?.simbolo ?? ''}
                    {totalDiezmosCalc.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>

              <BuscadorPersonaCampo
                iglesiaId={iglesiaActivaId}
                cdpId={cdpActiva}
                valor={textoBuscadorDiezmante}
                seleccionado={false}
                onCambiarTexto={setTextoBuscadorDiezmante}
                onSeleccionar={agregarDiezmanteExistente}
                placeholder="Buscar diezmante por nombre..."
              />
              <p className="text-[11px] text-muted-foreground">Prioriza a los miembros de tu Casa de Paz; si no aparece, busca en toda la iglesia.</p>

              {diezmos.map((d) => (
                <div key={d.clave} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm">
                  <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">
                    {d.nombre_completo}
                    {!d.personaId && (
                      <span className="text-xs text-muted-foreground">
                        {' '}(nueva{d.telefono ? ` · ${d.telefono}` : ''})
                      </span>
                    )}
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-28 shrink-0"
                    placeholder="Monto"
                    value={d.monto || ''}
                    onChange={(e) => cambiarMontoDiezmo(d.clave, Number(e.target.value))}
                  />
                  <button type="button" onClick={() => quitarDiezmo(d.clave)} className="shrink-0 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}

              {mostrarFormDiezmante ? (
                <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="flex flex-1 flex-col gap-1.5">
                      <Label className="text-xs">Nombre</Label>
                      <Input value={nombreDiezmante} onChange={(e) => setNombreDiezmante(e.target.value)} />
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5">
                      <Label className="text-xs">Apellido</Label>
                      <Input value={apellidoDiezmante} onChange={(e) => setApellidoDiezmante(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs">Sexo</Label>
                      <Select value={sexoDiezmante} onValueChange={(v) => setSexoDiezmante(v as 'M' | 'F')}>
                        <SelectTrigger className="w-28">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="M">Masculino</SelectItem>
                          <SelectItem value="F">Femenino</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="flex flex-1 flex-col gap-1.5">
                      <Label className="text-xs">Celular</Label>
                      <Input type="tel" placeholder="Opcional" value={telefonoDiezmante} onChange={(e) => setTelefonoDiezmante(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs">Monto</Label>
                      <Input type="number" step="0.01" min="0" className="w-28" value={montoDiezmanteManual} onChange={(e) => setMontoDiezmanteManual(e.target.value)} />
                    </div>
                    <Button
                      type="button"
                      onClick={agregarDiezmanteManual}
                      disabled={!nombreDiezmante.trim() || !apellidoDiezmante.trim() || !sexoDiezmante}
                    >
                      Agregar
                    </Button>
                    <Button type="button" variant="outline" onClick={cancelarDiezmanteManual}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" className="w-fit gap-2" onClick={() => setMostrarFormDiezmante(true)}>
                  <Plus className="h-4 w-4" />
                  Diezmante que no está en el sistema
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* Testimonios -- KAN-423 (2026-09-22, pedido explícito del owner):
            se separa en 2 cosas. Testimonios personales (categoría + texto,
            se pueden cargar varios) más abajo la narración general de la
            reunión ("¿Qué se desató en la CdP?", mismo campo `testimonios`
            de siempre -- antes se llamaba "Comentarios"/"Testimonio", solo
            cambia la etiqueta). */}
        <section className={CARD_SECCION}>
          <TarjetaHeader icon={MessageSquare} color={MARINO} titulo="Testimonios" descripcion="Lo que Dios hizo en esta reunión" />
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-2">
              {testimoniosCategorizados.map((t) => (
                <div key={t.clave} className="flex flex-col gap-2 rounded-xl border border-border/60 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    <Select value={t.categoria} onValueChange={(v) => cambiarCategoriaTestimonio(t.clave, v as CategoriaTestimonio)}>
                      <SelectTrigger className={cn('w-full sm:w-44 sm:shrink-0', CAMPO_ESTILO)}>
                        <SelectValue placeholder="Categoría..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FINANZAS">Finanzas</SelectItem>
                        <SelectItem value="SANIDAD">Sanidad</SelectItem>
                        <SelectItem value="RESTAURACION">Restauración</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      {t.esExterno ? (
                        <Input
                          className={CAMPO_ESTILO}
                          placeholder="Nombre de quién lo contó"
                          value={t.nombrePersona}
                          onChange={(e) => cambiarNombrePersonaTestimonio(t.clave, e.target.value)}
                        />
                      ) : (
                        <BuscadorPersonaCampo
                          iglesiaId={iglesiaActivaId}
                          cdpId={cdpActiva}
                          valor={t.nombrePersona}
                          seleccionado={!!t.personaId}
                          onCambiarTexto={(texto) => cambiarNombrePersonaTestimonio(t.clave, texto)}
                          onSeleccionar={(p) => seleccionarPersonaTestimonio(t.clave, p)}
                          placeholder="Quién lo contó (opcional)..."
                        />
                      )}
                      <label className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground">
                        <Checkbox
                          className="h-3.5 w-3.5"
                          checked={t.esExterno}
                          onCheckedChange={(v) => toggleEsExternoTestimonio(t.clave, v === true)}
                        />
                        No es de la iglesia
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => quitarTestimonioCategorizado(t.clave)}
                      className="shrink-0 self-start rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <Textarea
                    placeholder="Contá el testimonio..."
                    rows={3}
                    className={CAMPO_ESTILO}
                    value={t.texto}
                    onChange={(e) => cambiarTextoTestimonioCategorizado(t.clave, e.target.value)}
                  />
                </div>
              ))}
              <div className="flex justify-end">
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={agregarTestimonioCategorizado}>
                  <Plus className="h-3.5 w-3.5" />
                  Agregar testimonio
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="testimonios">¿Qué se desató en la CdP? {campos?.REPORTE_TESTIMONIOS_OBLIGATORIO && '*'}</Label>
              <Textarea
                id="testimonios"
                placeholder="Contá qué pasó en general durante esta reunión de Casa de Paz"
                rows={4}
                className={claseCampoEdicion(modoEdicion, !!dirtyFields.testimonios)}
                {...register('testimonios')}
              />
            </div>
          </div>
        </section>

        {/* KAN-367 (2026-09-17, pedido del owner): "Enviar reporte"/"Guardar
            cambios" centrado en la fila -- sm:justify-center centra el botón
            principal; los botones admin (historial/anular) igual quedan a la
            derecha porque usan sm:ml-auto, que gana sobre justify-content. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
          <div className="flex w-full flex-col gap-1.5 sm:w-auto">
            <Button
              type="submit"
              variant={modoEdicion ? 'destructive' : 'default'}
              disabled={isSubmitting || totalAsistentesActual === 0}
              title={totalAsistentesActual === 0 ? 'Marcá al menos una persona antes de enviar el reporte' : undefined}
              className={cn(
                'h-12 w-full gap-2 rounded-xl text-[15px] font-semibold sm:w-auto sm:px-8',
                // KAN-367 (pedido del owner, 2026-09-17): rojo sólido + texto
                // blanco, no el destructive suave -- que se note el peligro
                // de verdad en el botón principal de guardar una edición.
                modoEdicion && 'bg-destructive text-white shadow-sm shadow-destructive/30 hover:bg-destructive/90'
              )}
            >
              {isSubmitting && <Spinner className="h-4 w-4" />}
              {isSubmitting ? (modoEdicion ? 'Guardando...' : 'Enviando...') : modoEdicion ? 'Guardar cambios' : 'Enviar reporte'}
            </Button>
            {/* KAN-367 (pedido del owner, 2026-09-17): aviso de que esto
                reemplaza los datos guardados -- entre comillas porque en
                realidad no se pierde nada, queda en el historial de cambios
                que solo puede ver Supervisión de la Visión en Acción. */}
            {modoEdicion && (
              <p className="text-[11px] text-muted-foreground">Esto "reemplaza" los datos guardados -- queda un historial que solo ve Supervisión.</p>
            )}
            {/* El botón deshabilitado usa disabled:pointer-events-none (button.tsx)
                -- ni siquiera recibe el toque, así que un toast al tocarlo no es
                posible. Antes la única explicación era el `title` de arriba, un
                tooltip por hover invisible en celular: se reportó como "el botón
                no responde" después de enviar un reporte (que vacía la lista de
                asistentes) y volver a tocarlo sin marcar gente de nuevo (owner,
                2026-09-05). Este texto queda siempre visible, sin depender de hover. */}
            {!isSubmitting && totalAsistentesActual === 0 && (
              <p className="text-[11px] text-muted-foreground">Marcá al menos una persona en Asistencia antes de enviar.</p>
            )}
          </div>

          {/* Anular reporte (solo en edición): baja lógica para sacar un reporte
              cargado por error/duplicado. KAN-367: tiene su propia ventana (en
              horas, más corta que la de editar) -- puedeAnular !== false deja
              el botón visible mientras carga (undefined) y solo lo oculta
              cuando ya se confirmó que la ventana pasó. El backend igual
              vuelve a validar el permiso real al confirmar. */}
          {modoEdicion && esSupervisionVisionAccion && (
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2 rounded-xl sm:ml-auto"
              onClick={() => setMostrandoHistorial(true)}
            >
              <History className="h-4 w-4" />
              Ver historial de cambios
            </Button>
          )}
          {modoEdicion && puedeAnular !== false && (
            <Button
              type="button"
              variant="ghost"
              className={cn('h-11 gap-2 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive', !esSupervisionVisionAccion && 'sm:ml-auto')}
              onClick={() => setConfirmandoAnular(true)}
            >
              <Trash2 className="h-4 w-4" />
              Anular reporte
            </Button>
          )}
        </div>
      </form>
      )}

      {/* KAN-367 (pedido del owner, 2026-09-17): confirmación fuerte -- diálogo
          con advertencia destacada + botón bloqueado 3 segundos, en vez del
          confirm inline chiquito de antes. */}
      <Dialog open={confirmandoAnular} onOpenChange={(v) => !anular.isPending && setConfirmandoAnular(v)}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
            <AlertTriangle className="h-6 w-6 shrink-0 text-destructive" />
            <div className="flex flex-col gap-1">
              <p className="font-semibold text-destructive">Vas a anular este reporte</p>
              <p className="text-sm text-muted-foreground">
                Se da de baja el reporte y su asistencia. No es para corregir un dato -- para eso usá "Guardar cambios". Esta acción queda registrada.
              </p>
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => setConfirmandoAnular(false)} disabled={anular.isPending}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" disabled={segundosParaAnular > 0 || anular.isPending} onClick={anularReporteActual}>
              {anular.isPending && <Spinner className="h-4 w-4" />}
              {segundosParaAnular > 0 ? `Esperá ${segundosParaAnular}s...` : 'Sí, anular'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* KAN-367 (2026-09-17): historial de cambios -- solo Pastor/Supervisor.
          Muestra el valor ANTERIOR de cada edición (lo que decía antes de
          ese guardado), más nuevo primero -- incluye tema/fecha, asistencia
          e ingresos (ofrenda + diezmos) tal como estaban antes del cambio. */}
      <Dialog open={mostrandoHistorial} onOpenChange={setMostrandoHistorial}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Historial de cambios</DialogTitle>
            <DialogDescription>Solo visible para Pastor/Supervisor. Cada entrada muestra cómo estaba el reporte antes de ese cambio.</DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
            {cargandoHistorial ? (
              <Skeleton className="h-24 w-full rounded-xl" />
            ) : !historial || historial.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Este reporte nunca se modificó ni se anuló.</p>
            ) : (
              historial.map((h) => {
                // KAN-367 (2026-09-17): entradas viejas guardaron el snapshot
                // "plano" (solo columnas de casa_de_paz_reporte). Las nuevas
                // lo anidan en { reporte, asistencia, ingresos } -- se soporta
                // ambos formatos para no romper el historial ya guardado.
                const snap = h.snapshotAnterior;
                const reporteAntes = ((snap.reporte as Record<string, unknown> | undefined) ?? snap) as Record<string, unknown>;
                const asistenciaAntes = Array.isArray(snap.asistencia)
                  ? (snap.asistencia as { nombre_completo: string; es_visita: boolean }[])
                  : null;
                const ingresosAntes = Array.isArray(snap.ingresos)
                  ? (snap.ingresos as { tipo: string; nombre_completo: string | null; monto: number }[])
                  : null;
                const ofrendaAntes = ingresosAntes?.find((i) => i.tipo === 'OFRENDA')?.monto;
                const diezmosAntes = ingresosAntes?.filter((i) => i.tipo === 'DIEZMO') ?? [];

                return (
                  <div key={h.id} className="flex flex-col gap-1.5 rounded-xl border border-border/60 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                          h.tipo === 'ANULADO' ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                        )}
                      >
                        {h.tipo === 'ANULADO' ? 'Anulado' : 'Modificado'}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(h.fechaCreacion).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>
                    <p className="text-muted-foreground">
                      Por <span className="font-medium text-foreground">{h.modificadoPorNombre}</span>
                    </p>
                    {typeof reporteAntes.fecha_reunion === 'string' && (
                      <p className="text-muted-foreground">Fecha de reunión antes: {fechaLegible(reporteAntes.fecha_reunion as string)}</p>
                    )}
                    {asistenciaAntes && (
                      <p className="text-muted-foreground">
                        Asistencia antes: {asistenciaAntes.length} persona{asistenciaAntes.length === 1 ? '' : 's'}
                        {asistenciaAntes.length > 0 && ` (${asistenciaAntes.map((a) => a.nombre_completo).join(', ')})`}
                      </p>
                    )}
                    {ingresosAntes && (ofrendaAntes !== undefined || diezmosAntes.length > 0) && (
                      <p className="text-muted-foreground">
                        {ofrendaAntes !== undefined && `Ofrenda antes: ${ofrendaAntes}`}
                        {ofrendaAntes !== undefined && diezmosAntes.length > 0 && ' · '}
                        {diezmosAntes.length > 0 &&
                          `Diezmos antes: ${diezmosAntes.length} persona${diezmosAntes.length === 1 ? '' : 's'} (${diezmosAntes.reduce((s, d) => s + d.monto, 0)})`}
                      </p>
                    )}
                    <details className="text-[11px] text-muted-foreground">
                      <summary className="cursor-pointer select-none">Ver datos completos de antes</summary>
                      <pre className="mt-1 overflow-x-auto rounded-lg bg-muted/40 p-2 text-[10px]">{JSON.stringify(h.snapshotAnterior, null, 2)}</pre>
                    </details>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendienteConfirmarAsistente} onOpenChange={(v) => !v && setPendienteConfirmarAsistente(null)}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>¿Es un asistente nuevo?</DialogTitle>
            <DialogDescription>
              {pendienteConfirmarAsistente?.nombre_completo}: si asistió a esta reunión, también va a contar y aparecer marcada en "Asistentes nuevos". Si no, queda solo en Evangelismo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => confirmarEsAsistenteNuevo(false)}>
              No, solo evangelismo
            </Button>
            <Button type="button" onClick={() => confirmarEsAsistenteNuevo(true)}>
              Sí, es asistente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ModalFechaNacimientoFaltante
        open={colaFechaNacimiento.length > 0}
        onOpenChange={(v) => !v && colaFechaNacimiento[0] && quitarDeColaFechaNacimiento(colaFechaNacimiento[0].id)}
        nombrePersona={colaFechaNacimiento[0]?.nombre ?? ''}
        guardando={actualizarFechaNacimiento.isPending}
        edadMinima={edadMinima}
        onGuardarFecha={guardarFechaNacimientoPendiente}
        onGuardarEdadAproximada={guardarEdadAproximadaPendiente}
        onResolverEsMenor={resolverEsMenorPendiente}
        onCancelar={cancelarColaFechaNacimiento}
      />
    </div>
  );
}
