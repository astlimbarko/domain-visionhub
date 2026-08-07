import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  ClipboardList,
  DollarSign,
  HeartHandshake,
  MessageSquare,
  PartyPopper,
  Plus,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { DashboardHero, AZUL, VERDE, AMBAR, MARINO, TEAL } from '@/components/dashboard/DashboardUI';
import { DEPARTAMENTO_META } from '@/utils/departamentos';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/store/auth.store';
import { useMisCasasDePaz } from '@/hooks/useCalendario';
import { useMonedasActivas } from '@/hooks/usePanelSupervisor';
import {
  useCamposObligatoriosReporte,
  useCrearReporte,
  useEdadMinimaCreyente,
  useLibros,
  useMegaFiestaDelDia,
  useMiembrosCdp,
  useTemas,
} from '@/hooks/useReporte';
import { crearEvangelizado } from '@/services/evangelismo.service';
import { BuscadorPersonaCampo } from '@/components/reporte/BuscadorPersonaCampo';
import { BuscadorPersonaMultiple } from '@/components/reporte/BuscadorPersonaMultiple';
import { EvangelismoPendientePanel } from '@/components/reporte/EvangelismoPendientePanel';
import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';
import { aISO } from '@/utils/calendario-fechas';
import type { EvangelizadoPendiente, NuevaVisita } from '@/types/reporte.types';
import type { PersonaBusqueda } from '@/types/casas-de-paz.types';

const esquema = z.object({
  fecha_reunion: z.string().min(1),
  libro_id: z.string().optional(),
  tema_id: z.string().optional(),
  tema_especial_txt: z.string().optional(),
  disertador_id: z.string().optional(),
  salio_evangelizar: z.boolean(),
  testimonios: z.string().optional(),
  comentarios: z.string().optional(),
  total_ofrendas: z.string().min(1, 'El total de ofrendas es obligatorio, aunque sea 0'),
  total_diezmos: z.string().optional(),
  moneda_id: z.string().min(1),
});

type FormValues = z.infer<typeof esquema>;

/** Wrapper estándar del design system para toda card de sección (ver skill frontend-style). */
const CARD_SECCION = 'overflow-hidden rounded-2xl border border-border/60 bg-card';

export function Reportes() {
  const personaId = useAuthStore((s) => s.personaId);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const queryClient = useQueryClient();

  const { data: misCasas, isLoading: cargandoCasas } = useMisCasasDePaz(personaId);
  const [casaDePazId, setCasaDePazId] = useState<string>();
  const cdpActiva = casaDePazId ?? misCasas?.[0]?.casa_de_paz_id;

  const hoy = aISO(new Date());

  const { data: libros = [] } = useLibros();
  const { data: miembros = [], isLoading: cargandoMiembros } = useMiembrosCdp(cdpActiva);
  const { data: campos } = useCamposObligatoriosReporte(iglesiaActivaId);
  // Umbral configurable por iglesia (default 12): mismo criterio que ya usa el backend
  // para Estados SSVA y el Dashboard, en vez de un "12" fijo que podía no coincidir.
  const { data: edadMinima = 12 } = useEdadMinimaCreyente(iglesiaActivaId);
  const { data: monedas = [] } = useMonedasActivas(iglesiaActivaId);
  const crear = useCrearReporte(cdpActiva);

  // Un único mapa persona → { esVisita, esMenor } evita que alguien quede
  // seleccionado en más de una de las 3 listas (nuevos / regulares / niños) a la vez.
  const [asistentes, setAsistentes] = useState<Map<string, { esVisita: boolean; esMenor?: boolean }>>(new Map());
  const [visitasNuevas, setVisitasNuevas] = useState<NuevaVisita[]>([]);
  const [mostrarFormVisita, setMostrarFormVisita] = useState(false);
  const [nombreVisita, setNombreVisita] = useState('');
  const [apellidoVisita, setApellidoVisita] = useState('');
  const [sexoVisita, setSexoVisita] = useState<'M' | 'F' | ''>('');
  const [telefonoVisita, setTelefonoVisita] = useState('');
  const [esMenorVisita, setEsMenorVisita] = useState(false);
  const [evangelizadosPendientes, setEvangelizadosPendientes] = useState<EvangelizadoPendiente[]>([]);
  const [esMegaFiesta, setEsMegaFiesta] = useState(false);
  const [disertadorNombre, setDisertadorNombre] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
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
  const { data: megaFiesta } = useMegaFiestaDelDia(cdpActiva, fechaReunion);
  const temaActual = useMemo(() => temas.find((t) => t.id === temaId), [temas, temaId]);

  // Las monedas activas se cargan de forma asincronica: si el default de
  // useForm se evaluara solo al montar, moneda_id quedaria vacio para siempre.
  useEffect(() => {
    if (!monedaId && monedas[0]) {
      setValue('moneda_id', monedas[0].moneda_id);
    }
  }, [monedas, monedaId, setValue]);

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

  function agregarVisitaNueva() {
    if (!nombreVisita.trim() || !apellidoVisita.trim() || !sexoVisita) return;
    setVisitasNuevas((prev) => [
      ...prev,
      {
        primer_nombre: nombreVisita.trim(),
        primer_apellido: apellidoVisita.trim(),
        sexo: sexoVisita,
        es_menor: esMenorVisita,
        telefono: telefonoVisita.trim() || undefined,
      },
    ]);
    setNombreVisita('');
    setApellidoVisita('');
    setSexoVisita('');
    setTelefonoVisita('');
    setEsMenorVisita(false);
    setMostrarFormVisita(false);
  }

  const idsNuevos = Array.from(asistentes.entries())
    .filter(([, v]) => v.esVisita)
    .map(([id]) => id);
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
  const poolNuevos = miembros.filter((m) => !idsRegulares.includes(m.persona_id) && !idsNinos.includes(m.persona_id));
  const poolRegulares = miembros.filter((m) => (m.edad === null || m.edad >= edadMinima) && !idsNuevos.includes(m.persona_id));
  const poolNinos = miembros.filter((m) => m.edad !== null && m.edad < edadMinima && !idsNuevos.includes(m.persona_id));

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
  const pendientesEsMenor = Array.from(asistentes.keys())
    .map((id) => miembros.find((mm) => mm.persona_id === id))
    .filter((m): m is (typeof miembros)[number] => !!m && !m.tiene_fecha_nacimiento && esMenorPorPersona[m.persona_id] === undefined);

  // Se usa en la descripción de la sección "Asistencia" más abajo.
  const totalAsistentesActual = idsNuevos.length + idsRegulares.length + idsNinos.length + visitasNuevas.length;

  async function onSubmit(valores: FormValues) {
    if (!cdpActiva || !iglesiaActivaId) return;

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

    // El backend exige estos campos según la configuración de la iglesia
    // (trigger fn_validar_campos_reporte) pero el formulario no lo mostraba
    // antes de intentar enviar -- se valida acá con el mismo criterio para
    // avisar de una sin necesidad de un viaje al servidor.
    if (campos?.REPORTE_TEMA_OBLIGATORIO && !valores.tema_id) {
      toast.error('El tema es obligatorio en esta iglesia');
      return;
    }
    if (campos?.REPORTE_DISERTADOR_OBLIGATORIO && !valores.disertador_id) {
      toast.error('El disertador es obligatorio en esta iglesia');
      return;
    }
    if (campos?.REPORTE_TESTIMONIOS_OBLIGATORIO && !valores.testimonios?.trim()) {
      toast.error('Los testimonios son obligatorios en esta iglesia');
      return;
    }
    if (campos?.REPORTE_COMENTARIOS_OBLIGATORIO && !valores.comentarios?.trim()) {
      toast.error('Los comentarios son obligatorios en esta iglesia');
      return;
    }

    try {
      const resultado = await crear.mutateAsync({
        casa_de_paz_id: cdpActiva,
        iglesia_id: iglesiaActivaId,
        fecha_reunion: valores.fecha_reunion,
        libro_id: valores.libro_id,
        tema_id: valores.tema_id,
        tema_especial_txt: temaActual?.es_especial ? valores.tema_especial_txt : undefined,
        disertador_id: valores.disertador_id,
        evento_megafiesta_id: esMegaFiesta && megaFiesta ? megaFiesta.evento_id : undefined,
        salio_evangelizar: valores.salio_evangelizar,
        evangelizados_declarados: valores.salio_evangelizar ? evangelizadosPendientes.length : undefined,
        testimonios: valores.testimonios,
        comentarios: valores.comentarios,
        asistentesExistentes: Array.from(asistentes.entries()).map(([id, v]) => ({
          personaId: id,
          esMenor: v.esMenor,
          esVisita: v.esVisita,
        })),
        visitasNuevas,
        totalOfrendas: Number(valores.total_ofrendas),
        totalDiezmos: valores.total_diezmos ? Number(valores.total_diezmos) : undefined,
        monedaId: valores.moneda_id,
      });

      if (evangelizadosPendientes.length > 0) {
        try {
          for (const ev of evangelizadosPendientes) {
            await crearEvangelizado({
              casa_de_paz_id: cdpActiva,
              iglesia_id: iglesiaActivaId,
              fecha: valores.fecha_reunion,
              persona_id: ev.persona_id,
              primer_nombre: ev.primer_nombre,
              primer_apellido: ev.primer_apellido,
              sexo: ev.sexo,
              domicilio: ev.domicilio,
              telefono: ev.telefono,
              fecha_nacimiento: ev.fecha_nacimiento,
              tipo_evangelismo_id: ev.tipo_evangelismo_id,
            });
          }
          queryClient.invalidateQueries({ queryKey: ['evangelismo'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        } catch {
          toast.error('El reporte se guardó, pero no se pudieron registrar todos los evangelizados');
        }
      }

      toast.success(
        `Reporte enviado: ${resultado.totalAsistentes} asistentes (${resultado.totalMenores} menores, ${resultado.totalMayores} mayores)`
      );
      reset({ fecha_reunion: hoy, salio_evangelizar: false, moneda_id: monedas[0]?.moneda_id });
      setAsistentes(new Map());
      setVisitasNuevas([]);
      setEvangelizadosPendientes([]);
      setEsMegaFiesta(false);
      setDisertadorNombre('');
    } catch (e) {
      const error = e as { code?: string; message?: string } | null;
      const mensaje = typeof error?.message === 'string' ? error.message : '';
      if (error?.code === '23514' && mensaje.includes('chk_reporte_fecha')) {
        toast.error('La fecha de la reunión no puede ser en el futuro');
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

  if (cargandoCasas) return <Skeleton className="h-96 w-full" />;

  if (!misCasas || misCasas.length === 0) {
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
        eyebrow="Reporte semanal"
        title="Reporte de la reunión"
        actions={
          misCasas.length > 1 && (
            <Select value={cdpActiva} onValueChange={setCasaDePazId}>
              <SelectTrigger size="sm" className="w-full border-white/25 bg-white/10 text-sm text-white [&_svg]:text-white/70 sm:w-56">
                <SelectValue placeholder="Casa de Paz" />
              </SelectTrigger>
              <SelectContent>
                {misCasas.map((c) => (
                  <SelectItem key={c.casa_de_paz_id} value={c.casa_de_paz_id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        {/* Información General */}
        <section className={CARD_SECCION}>
          <TarjetaHeader
            icon={CalendarDays}
            color={AZUL}
            titulo="Información general"
            descripcion="Cuándo fue la reunión y quién enseñó"
          />
          <div className="p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="fecha_reunion">Fecha de la reunión *</Label>
                    <Input id="fecha_reunion" type="date" max={hoy} {...register('fecha_reunion')} />
                  </div>

                  {megaFiesta && (
                    <label className="flex items-center gap-2 self-end pb-2 text-sm">
                      <Checkbox checked={esMegaFiesta} onCheckedChange={(v) => setEsMegaFiesta(v === true)} />
                      <PartyPopper className="h-4 w-4 text-primary" />
                      Fue la Mega Fiesta de Casas de Paz
                    </label>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <Label>Libro {campos?.REPORTE_TEMA_OBLIGATORIO && '*'}</Label>
                    <Select value={libroId ?? ''} onValueChange={(v) => setValue('libro_id', v)}>
                      <SelectTrigger className="w-full">
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
                    <Select value={temaId ?? ''} onValueChange={(v) => setValue('tema_id', v)} disabled={!libroId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={libroId ? '—' : 'Elegí primero un libro'} />
                      </SelectTrigger>
                      <SelectContent>
                        {temas.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.es_especial ? 'Especial: ' : `${t.numero}. `}
                            {t.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {temaActual?.es_especial && (
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <Label htmlFor="tema_especial_txt">Descripción del tema especial</Label>
                      <Input id="tema_especial_txt" {...register('tema_especial_txt')} />
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5 sm:col-span-2 sm:w-72">
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
                </div>
          </div>
        </section>

        {/* Asistencia */}
        <section className={CARD_SECCION}>
          <TarjetaHeader
            icon={Users}
            color={TEAL}
            titulo="Asistencia"
            descripcion={`${totalAsistentesActual} persona${totalAsistentesActual === 1 ? '' : 's'} marcada${totalAsistentesActual === 1 ? '' : 's'} hasta ahora`}
          />
          <div className="flex flex-col gap-4 p-5">
                {cargandoMiembros ? (
                  <Skeleton className="h-32 w-full" />
                ) : (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">Asistentes nuevos</Label>
                      <BuscadorPersonaMultiple
                        titulo="Seleccionar asistentes nuevos"
                        miembros={poolNuevos}
                        seleccionados={idsNuevos}
                        onToggle={(id) => toggleAsistente(id, true)}
                        placeholder="Buscar personas..."
                        colorChip={VERDE}
                        asisteCdpPorPersona={asisteCdpPorPersona}
                        onAsisteCdpChange={cambiarAsisteCdp}
                      />
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

                    <div className="flex flex-col gap-2">
                      {visitasNuevas.map((v, i) => (
                        <div key={i} className="flex items-center gap-3 rounded-xl border border-dashed border-border px-3 py-2 text-sm">
                          <UserRound className="h-4 w-4 text-muted-foreground" />
                          <span className="flex-1">
                            {v.primer_nombre} {v.primer_apellido}{' '}
                            <span className="text-xs text-muted-foreground">
                              (no está en el sistema{v.es_menor ? ', menor' : ''}
                              {v.telefono ? ` · ${v.telefono}` : ''})
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setVisitasNuevas((prev) => prev.filter((_, idx) => idx !== i))}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}

                      {mostrarFormVisita ? (
                        <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                            <div className="flex flex-1 flex-col gap-1.5">
                              <Label className="text-xs">Nombre</Label>
                              <Input value={nombreVisita} onChange={(e) => setNombreVisita(e.target.value)} />
                            </div>
                            <div className="flex flex-1 flex-col gap-1.5">
                              <Label className="text-xs">Apellido</Label>
                              <Input value={apellidoVisita} onChange={(e) => setApellidoVisita(e.target.value)} />
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <Label className="text-xs">Sexo</Label>
                              <Select value={sexoVisita} onValueChange={(v) => setSexoVisita(v as 'M' | 'F')}>
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
                              <Input
                                type="tel"
                                placeholder="Opcional"
                                value={telefonoVisita}
                                onChange={(e) => setTelefonoVisita(e.target.value)}
                              />
                            </div>
                            <label className="flex items-center gap-1.5 pb-2 text-xs text-muted-foreground">
                              <Checkbox checked={esMenorVisita} onCheckedChange={(v) => setEsMenorVisita(v === true)} />
                              es menor
                            </label>
                            <Button type="button" onClick={agregarVisitaNueva}>
                              Agregar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button type="button" variant="outline" size="sm" className="w-fit gap-2" onClick={() => setMostrarFormVisita(true)}>
                          <Plus className="h-4 w-4" />
                          Persona que no está en el sistema
                        </Button>
                      )}
                    </div>
                  </>
                )}
          </div>
        </section>

        {/* Evangelismo */}
        {campos?.REPORTE_SALIO_EVANGELIZAR_VISIBLE && (
          <section className={CARD_SECCION}>
            <TarjetaHeader
              icon={HeartHandshake}
              color={DEPARTAMENTO_META.EVANGELISMO.color}
              titulo="Evangelismo"
              descripcion="¿Salieron a evangelizar en esta reunión?"
            />
            <div className="flex flex-col gap-4 p-5">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={salioEvangelizar} onCheckedChange={(v) => setValue('salio_evangelizar', v === true)} />
                    Salieron a evangelizar
                  </label>
                  {salioEvangelizar && (
                    <EvangelismoPendientePanel
                      iglesiaId={iglesiaActivaId}
                      pendientes={evangelizadosPendientes}
                      onAgregar={(p) => setEvangelizadosPendientes((prev) => [...prev, p])}
                      onQuitar={(clave) => setEvangelizadosPendientes((prev) => prev.filter((p) => p.clave !== clave))}
                    />
                  )}
            </div>
          </section>
        )}

        {/* Finanzas */}
        <section className={CARD_SECCION}>
          <TarjetaHeader icon={DollarSign} color={VERDE} titulo="Finanzas" descripcion="Ofrendas y diezmos recogidos en la reunión" />
          <div className="p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="total_ofrendas">Total ofrendas *</Label>
                    <Input id="total_ofrendas" type="number" step="0.01" min="0" {...register('total_ofrendas')} />
                    {errors.total_ofrendas ? (
                      <p className="text-sm text-destructive">{errors.total_ofrendas.message}</p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">Obligatorio, aunque sea 0</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="total_diezmos">Total diezmos</Label>
                    <Input id="total_diezmos" type="number" step="0.01" min="0" {...register('total_diezmos')} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Moneda</Label>
                    <Select value={monedaId ?? ''} onValueChange={(v) => setValue('moneda_id', v)}>
                      <SelectTrigger className="w-full">
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
                  </div>
                </div>
          </div>
        </section>

        {/* Narración */}
        <section className={CARD_SECCION}>
          <TarjetaHeader icon={MessageSquare} color={MARINO} titulo="Narración" descripcion="Qué pasó durante la reunión" />
          <div className="p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="testimonios">Testimonios {campos?.REPORTE_TESTIMONIOS_OBLIGATORIO && '*'}</Label>
                    <Textarea id="testimonios" placeholder="¿Alguien compartió un testimonio?" {...register('testimonios')} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="comentarios">Comentarios {campos?.REPORTE_COMENTARIOS_OBLIGATORIO && '*'}</Label>
                    <Textarea id="comentarios" placeholder="Cualquier otro detalle de la reunión" {...register('comentarios')} />
                  </div>
                </div>
          </div>
        </section>

        <Button type="submit" disabled={isSubmitting} className="h-12 w-full gap-2 rounded-xl text-[15px] font-semibold sm:w-auto sm:self-start sm:px-8">
          {isSubmitting && <Spinner className="h-4 w-4" />}
          {isSubmitting ? 'Enviando...' : 'Enviar reporte'}
        </Button>
      </form>
    </div>
  );
}
