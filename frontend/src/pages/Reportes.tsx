import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ClipboardList,
  History,
  DollarSign,
  HeartHandshake,
  MapPin,
  MessageSquare,
  PartyPopper,
  Pencil,
  Plus,
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
import { DashboardHero, AZUL, VERDE, AMBAR, MARINO, TEAL } from '@/components/dashboard/DashboardUI';
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
import { useMonedasActivas } from '@/hooks/usePanelSupervisor';
import {
  useActualizarReporte,
  useAnularReporte,
  useAutorizarEdicionReporteFueraVentana,
  useCamposObligatoriosReporte,
  useCdpContextoReporte,
  useCrearReporte,
  useEdadMinimaCreyente,
  useIdsLiderCdp,
  useLibros,
  useDiasLimiteEdicionReporte,
  useHistorialReporte,
  useMegaFiestaDelDia,
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
import { EvangelismoPendientePanel } from '@/components/reporte/EvangelismoPendientePanel';
import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';
import { aISO, fechaLegible } from '@/utils/calendario-fechas';
import { calcularEdad } from '@/utils/edad';
import { cn } from '@/lib/utils';
import { CAMPO_ESTILO } from '@/lib/estilos';
import type { DiezmoLinea, EvangelizadoPendiente, NuevaVisita } from '@/types/reporte.types';
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

export function Reportes() {
  const { reporteId } = useParams<{ reporteId?: string }>();
  const modoEdicion = !!reporteId;
  const navigate = useNavigate();
  const { contextoActivo } = useContextoActivo();
  const contextoCdp = contextoActivo?.alcance === 'CDP' ? contextoActivo : null;

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

  const { data: libros = [] } = useLibros();
  const { data: miembrosCrudo = [], isLoading: cargandoMiembros } = useMiembrosCdp(cdpActiva);
  // El Líder de la CdP no es "alguien a quien marcarle asistencia" -- pedido
  // del owner (2026-09-10). Se filtra acá, no en useMiembrosCdp (compartida
  // con MultiplicarCdpDialog.tsx, donde el Líder sí debe poder elegirse al
  // dividir una CdP).
  const { data: idsLider } = useIdsLiderCdp(cdpActiva);
  const miembros = useMemo(
    () => (idsLider ? miembrosCrudo.filter((m) => !idsLider.has(m.persona_id)) : miembrosCrudo),
    [miembrosCrudo, idsLider]
  );
  const { data: campos } = useCamposObligatoriosReporte(iglesiaActivaId);
  // Umbral configurable por iglesia (default 12): mismo criterio que ya usa el backend
  // para Estados SSVA y el Dashboard, en vez de un "12" fijo que podía no coincidir.
  const { data: edadMinima = 12 } = useEdadMinimaCreyente(iglesiaActivaId);
  const { data: monedas = [] } = useMonedasActivas(iglesiaActivaId);
  const crear = useCrearReporte(cdpActiva);
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
  // Diezmos por persona: cada diezmante (existente o tecleado a mano) con su
  // monto y celular opcional. El total es la suma. El campo único "Total
  // diezmos" se reemplazó por esta lista.
  const [diezmos, setDiezmos] = useState<DiezmoLinea[]>([]);
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
  const [esMegaFiesta, setEsMegaFiesta] = useState(false);
  const [disertadorNombre, setDisertadorNombre] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<FormValues>({
    resolver: zodResolver(esquema),
    defaultValues: { fecha_reunion: hoy, salio_evangelizar: false, moneda_id: monedas[0]?.moneda_id },
  });

  const fechaReunion = watch('fecha_reunion');
  const libroId = watch('libro_id');
  const temaId = watch('tema_id');
  const disertadorId = watch('disertador_id');
  const salioEvangelizar = watch('salio_evangelizar');
  const monedaId = watch('moneda_id');

  const { data: temas = [] } = useTemas(libroId, iglesiaActivaId);
  const { data: tiposEvangelismo = [] } = useTiposEvangelismo(iglesiaActivaId);
  const { data: megaFiesta } = useMegaFiestaDelDia(cdpActiva, fechaReunion);
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
    setAsistentes((prev) => {
      const next = new Map(prev);
      const actual = next.get(personaId);
      if (actual && actual.esVisita === esVisita) {
        next.delete(personaId);
      } else {
        next.set(personaId, { esVisita, esMenor: actual?.esMenor });
      }
      return next;
    });
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
    // Si no dio fecha de nacimiento, se asume que no es menor -- sin esto, el
    // backend (fn_validar_asistencia) rechaza el reporte entero recién al
    // enviarlo (ASISTENCIA_EDAD_INDEFINIDA), porque antes el checkbox "es
    // menor" siempre mandaba un valor definido y ahora la fecha es opcional.
    const esMenor = datos.fecha_nacimiento ? calcularEdad(datos.fecha_nacimiento) < edadMinima : false;
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
        telefono: datos.telefono,
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
  // desde este buscador (PersonaBusqueda no la trae), así que esMenor queda
  // sin definir a propósito: el aviso "¿es menor?" (pendientesEsMenor) se
  // encarga de preguntarlo antes de poder enviar el reporte.
  function agregarAsistenteExistente(persona: PersonaBusqueda) {
    setAsistentes((prev) => {
      const next = new Map(prev);
      next.set(persona.id, { esVisita: true });
      return next;
    });
    setAsistentesNuevosExistentes((prev) => [...prev, persona]);
    setTextoAsistenteNuevo('');
  }

  function quitarAsistenteExistente(personaId: string) {
    setAsistentes((prev) => {
      const next = new Map(prev);
      next.delete(personaId);
      return next;
    });
    setAsistentesNuevosExistentes((prev) => prev.filter((p) => p.id !== personaId));
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
      // cargada dispararía el aviso de "¿es menor?" (pendientesEsMenor) para
      // una persona que ya existía en el sistema, no una recién creada; el
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

  // Búsqueda global de "Asistentes nuevos": excluye a quien ya es miembro de
  // esta CdP (esa persona corresponde a "Asistencia regular"/"de niños", no
  // acá) y a quien ya está marcado como asistente por cualquier otra vía,
  // para no ofrecerla dos veces.
  const resultadosAsistenteNuevoFiltrados = resultadosAsistenteNuevo.filter(
    (p) => !miembros.some((m) => m.persona_id === p.id) && !asistentes.has(p.id)
  );

  // Sin fecha de nacimiento no hay forma de saber la edad: se les pide que
  // digan a mano si son menores, en vez de asumirlo y arriesgar un dato mal
  // cargado. Se muestran todos juntos acá para que no haya que enviar el
  // formulario una vez por persona para enterarse de a uno.
  //
  // Se controla a CUALQUIER asistente ya registrado sin fecha de nacimiento,
  // sin importar en qué lista esté seleccionado (nuevos, regulares o niños).
  // Antes solo se miraba la lista de "regulares": elegir a alguien sin fecha
  // como "asistente nuevo" pasaba este control y recién explotaba con un 400
  // del backend (fn_validar_asistencia rechaza es_menor nulo sin fecha de
  // nacimiento), dejando además un reporte huérfano.
  // Las personas encontradas por la búsqueda global de "Asistentes nuevos"
  // (PersonaBusqueda) no traen fecha de nacimiento -- se tratan igual que un
  // miembro sin fecha registrada, mismo aviso "¿es menor?" antes de enviar.
  const pendientesEsMenor = [
    ...Array.from(asistentes.keys())
      .map((id) => miembros.find((mm) => mm.persona_id === id))
      .filter((m): m is (typeof miembros)[number] => !!m && !m.tiene_fecha_nacimiento && esMenorPorPersona[m.persona_id] === undefined),
    ...asistentesNuevosExistentes
      .filter((p) => asistentes.has(p.id) && esMenorPorPersona[p.id] === undefined)
      .map((p) => ({ persona_id: p.id, nombre_completo: p.nombre_completo, tiene_fecha_nacimiento: false, edad: null })),
  ];

  // Se usa en la descripción de la sección "Asistencia" más abajo.
  const totalAsistentesActual = idsNuevos.length + idsRegulares.length + idsNinos.length + visitasNuevas.length;

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

    if (pendientesEsMenor.length > 0) {
      const nombres = pendientesEsMenor.map((m) => m.nombre_completo).join(', ');
      toast.error(
        pendientesEsMenor.length === 1
          ? `${nombres} no tiene fecha de nacimiento registrada: indicá arriba si es menor de ${edadMinima} años`
          : `${nombres} no tienen fecha de nacimiento registrada: indicá arriba si son menores de ${edadMinima} años`
      );
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
        evento_megafiesta_id: esMegaFiesta && megaFiesta ? megaFiesta.evento_id : undefined,
        salio_evangelizar: valores.salio_evangelizar,
        evangelizados_declarados: valores.salio_evangelizar
          ? modoEdicion
            ? evangelizadosDeclaradosEdicion
            : evangelizadosPendientes.length
          : undefined,
        testimonios: valores.testimonios,
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
      reset({ fecha_reunion: hoy, salio_evangelizar: false, moneda_id: monedas[0]?.moneda_id });
      setAsistentes(new Map());
      setVisitasNuevas([]);
      setAsistentesNuevosExistentes([]);
      setTextoAsistenteNuevo('');
      setDiezmos([]);
      setTextoBuscadorDiezmante('');
      setEvangelizadosPendientes([]);
      setEsMegaFiesta(false);
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
        // Red de seguridad: el formulario ya obliga a declarar si cada persona
        // sin fecha de nacimiento es menor (ver pendientesEsMenor), pero por si
        // acaso llega a pasar, el mensaje es claro en vez del genérico.
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
                  </div>

                  {/* KAN-367 (2026-09-17): Disertador sube acá, al lado de la
                      fecha -- antes quedaba al final y ese espacio de al lado
                      de la fecha quedaba vacío en desktop. */}
                  <div className="flex flex-col gap-1.5">
                    <Label>Disertador {campos?.REPORTE_DISERTADOR_OBLIGATORIO && '*'}</Label>
                    <BuscadorPersonaCampo
                      iglesiaId={iglesiaActivaId}
                      valor={disertadorNombre}
                      seleccionado={!!disertadorId}
                      onCambiarTexto={cambiarTextoDisertador}
                      onSeleccionar={seleccionarDisertador}
                      placeholder="Buscar por nombre..."
                      edadMinima={edadMinima}
                    />
                    <p className="text-[11px] text-muted-foreground">Buscá en toda la iglesia, no solo entre los miembros de tu Casa de Paz.</p>
                  </div>

                  {megaFiesta && (
                    <label className="flex items-center gap-2 text-sm sm:col-span-2">
                      <Checkbox checked={esMegaFiesta} onCheckedChange={(v) => setEsMegaFiesta(v === true)} />
                      <PartyPopper className="h-4 w-4 text-primary" />
                      Fue la Mega Fiesta de Casas de Paz
                    </label>
                  )}

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

        {/* Asistencia */}
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
                      <Label className="text-xs text-muted-foreground">Asistentes nuevos</Label>
                      {/* Sin pool local -- por definición "nuevo" es alguien
                          fuera del sistema. Pero antes de ofrecer crearla,
                          se busca en toda la iglesia (resultadosAsistenteNuevoFiltrados):
                          una visita recurrente ya tiene persona_id de otra
                          semana, y sin esto se duplicaba cada vez que volvía
                          a asistir (bug real reportado por el owner, 2026-09-05). */}
                      <BuscadorPersonaMultiple
                        titulo="Agregar asistente nuevo"
                        miembros={[]}
                        seleccionados={[]}
                        onToggle={() => {}}
                        placeholder="Escribí el nombre de la persona..."
                        colorChip={VERDE}
                        permitirAgregarNueva
                        onAgregarNueva={agregarAsistenteNuevo}
                        resultadosBusquedaGlobal={resultadosAsistenteNuevoFiltrados}
                        buscandoGlobal={buscandoAsistenteNuevo}
                        onSeleccionarGlobal={agregarAsistenteExistente}
                        onTextoCambia={setTextoAsistenteNuevo}
                      />
                      {/* Mismo diseño de chip que "Asistencia regular"/"de niños" al
                          seleccionar a alguien (pastilla de color + X) -- pedido del
                          owner (2026-09-03), y va debajo de este buscador (no al
                          final de la sección) para que se vea justo donde se agregó. */}
                      {(visitasNuevas.length > 0 || evangelizadosExistentesComoAsistentes.length > 0 || asistentesNuevosExistentes.length > 0) && (
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
                            <span
                              key={p.id}
                              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                              style={{ backgroundColor: `color-mix(in oklab, ${colorPastilla} 14%, transparent)`, color: colorPastilla }}
                            >
                              <Check className="h-3 w-3 shrink-0" />
                              {p.nombre_completo}
                              {esMenorPorPersona[p.id] && <span className="text-[10px] opacity-80">(menor)</span>}
                              <button
                                type="button"
                                onClick={() => quitarAsistenteExistente(p.id)}
                                className="rounded-full p-0.5 hover:bg-black/10"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">Asistencia regular (mayores de {edadMinima} años)</Label>
                      <BuscadorPersonaMultiple
                        titulo={`Seleccionar personas (≥${edadMinima} años)`}
                        miembros={poolRegulares}
                        seleccionados={idsRegulares}
                        onToggle={(id) => toggleAsistente(id, false)}
                        placeholder={`Buscar personas mayores de ${edadMinima} años...`}
                        colorChip={AZUL}
                        esMenorPorPersona={esMenorPorPersona}
                        onEsMenorChange={cambiarEsMenorAsistente}
                        asisteCdpPorPersona={asisteCdpPorPersona}
                        onAsisteCdpChange={cambiarAsisteCdp}
                        idsOriginales={modoEdicion ? idsAsistentesOriginales : undefined}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">Asistencia de niños (menores de {edadMinima} años)</Label>
                      <BuscadorPersonaMultiple
                        titulo={`Seleccionar niños (<${edadMinima} años)`}
                        miembros={poolNinos}
                        seleccionados={idsNinos}
                        onToggle={(id) => toggleAsistente(id, false)}
                        placeholder={`Buscar niños menores de ${edadMinima} años...`}
                        colorChip={AMBAR}
                        asisteCdpPorPersona={asisteCdpPorPersona}
                        onAsisteCdpChange={cambiarAsisteCdp}
                        idsOriginales={modoEdicion ? idsAsistentesOriginales : undefined}
                      />
                    </div>

                    {pendientesEsMenor.length > 0 && (
                      <div className="flex flex-col gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                          {pendientesEsMenor.length === 1
                            ? 'Esta persona no tiene fecha de nacimiento registrada. ¿Es menor?'
                            : 'Estas personas no tienen fecha de nacimiento registrada. ¿Son menores?'}
                        </p>
                        <div className="flex flex-col gap-1.5">
                          {pendientesEsMenor.map((m) => (
                            <div key={m.persona_id} className="flex items-center justify-between gap-3 rounded-lg bg-background/60 px-3 py-1.5 text-sm">
                              <span className="truncate font-medium">{m.nombre_completo}</span>
                              <div className="flex shrink-0 gap-1.5">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2.5 text-xs"
                                  onClick={() => cambiarEsMenorAsistente(m.persona_id, true)}
                                >
                                  Sí, es menor
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2.5 text-xs"
                                  onClick={() => cambiarEsMenorAsistente(m.persona_id, false)}
                                >
                                  No
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
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

        {/* Testimonio -- KAN-367 (2026-09-17, pedido del owner): antes era
            "Narración" con 2 campos (Testimonios + Comentarios). Se unifica
            en un solo campo -- lo que se pide es que se cuente como
            testimonio lo que Dios hizo en la reunión, no un dato suelto. */}
        <section className={CARD_SECCION}>
          <TarjetaHeader icon={MessageSquare} color={MARINO} titulo="Testimonio" descripcion="Lo que Dios hizo en esta reunión" />
          <div className="p-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="testimonios">Testimonio {campos?.REPORTE_TESTIMONIOS_OBLIGATORIO && '*'}</Label>
              <Textarea
                id="testimonios"
                placeholder="Contá como testimonio lo que Dios hizo durante esta reunión de Casa de Paz"
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
    </div>
  );
}
