import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { PartyPopper, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
  useLibros,
  useMegaFiestaDelDia,
  useMiembrosCdp,
  useReportesRecientes,
  useTemas,
} from '@/hooks/useReporte';
import { AsistenciaChecklist } from '@/components/reporte/AsistenciaChecklist';
import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';
import { aISO } from '@/utils/calendario-fechas';
import type { NuevaVisita } from '@/types/reporte.types';

const esquema = z.object({
  fecha_reunion: z.string().min(1),
  libro_id: z.string().optional(),
  tema_id: z.string().optional(),
  tema_especial_txt: z.string().optional(),
  disertador_id: z.string().optional(),
  salio_evangelizar: z.boolean(),
  evangelizados_declarados: z.string().optional(),
  testimonios: z.string().optional(),
  comentarios: z.string().optional(),
  total_ofrendas: z.string().min(1, 'El total de ofrendas es obligatorio, aunque sea 0'),
  total_diezmos: z.string().optional(),
  moneda_id: z.string().min(1),
});

type FormValues = z.infer<typeof esquema>;

export function Reportes() {
  const personaId = useAuthStore((s) => s.personaId);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;

  const { data: misCasas, isLoading: cargandoCasas } = useMisCasasDePaz(personaId);
  const [casaDePazId, setCasaDePazId] = useState<string>();
  const cdpActiva = casaDePazId ?? misCasas?.[0]?.casa_de_paz_id;

  const hoy = aISO(new Date());

  const { data: libros = [] } = useLibros();
  const { data: miembros = [], isLoading: cargandoMiembros } = useMiembrosCdp(cdpActiva);
  const { data: campos } = useCamposObligatoriosReporte(iglesiaActivaId);
  const { data: monedas = [] } = useMonedasActivas(iglesiaActivaId);
  const { data: recientes = [] } = useReportesRecientes(cdpActiva);
  const crear = useCrearReporte(cdpActiva);

  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [esMenorPorPersona, setEsMenorPorPersona] = useState<Record<string, boolean>>({});
  const [visitasNuevas, setVisitasNuevas] = useState<NuevaVisita[]>([]);
  const [esMegaFiesta, setEsMegaFiesta] = useState(false);

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

  function toggleAsistente(personaId: string, marcado: boolean) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (marcado) next.add(personaId);
      else next.delete(personaId);
      return next;
    });
  }

  async function onSubmit(valores: FormValues) {
    if (!cdpActiva || !iglesiaActivaId) return;

    for (const id of seleccionados) {
      const m = miembros.find((mm) => mm.persona_id === id);
      if (m && !m.tiene_fecha_nacimiento && esMenorPorPersona[id] === undefined) {
        toast.error(`Indicá si ${m.nombre_completo} es menor: no tiene fecha de nacimiento registrada`);
        return;
      }
    }

    for (const v of visitasNuevas) {
      if (v.es_menor === undefined) {
        toast.error(`Indicá si ${v.primer_nombre} ${v.primer_apellido} es menor`);
        return;
      }
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
        evangelizados_declarados: valores.evangelizados_declarados ? Number(valores.evangelizados_declarados) : undefined,
        testimonios: valores.testimonios,
        comentarios: valores.comentarios,
        asistentesExistentes: Array.from(seleccionados).map((id) => ({
          personaId: id,
          esMenor: esMenorPorPersona[id],
        })),
        visitasNuevas,
        totalOfrendas: Number(valores.total_ofrendas),
        totalDiezmos: valores.total_diezmos ? Number(valores.total_diezmos) : undefined,
        monedaId: valores.moneda_id,
      });

      toast.success(
        `Reporte enviado: ${resultado.totalAsistentes} asistentes (${resultado.totalMenores} menores, ${resultado.totalMayores} mayores)`
      );
      reset({ fecha_reunion: hoy, salio_evangelizar: false, moneda_id: monedas[0]?.moneda_id });
      setSeleccionados(new Set());
      setEsMenorPorPersona({});
      setVisitasNuevas([]);
      setEsMegaFiesta(false);
    } catch (e) {
      const error = e as { code?: string; message?: string } | null;
      const mensaje = typeof error?.message === 'string' ? error.message : '';
      if (error?.code === '23505' || mensaje.includes('uq_reporte_cdp_fecha')) {
        toast.error('Ya existe un reporte de esta Casa de Paz para esa fecha');
      } else if (mensaje.includes('REPORTE_OFRENDAS_OBLIGATORIO')) {
        toast.error('El total de ofrendas es obligatorio, aunque sea 0');
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
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Reporte de la reunión</CardTitle>
            {misCasas.length > 1 && (
              <Select value={cdpActiva} onValueChange={setCasaDePazId}>
                <SelectTrigger className="mt-2 w-56">
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
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fecha_reunion">Fecha de la reunión *</Label>
                  <Input id="fecha_reunion" type="date" {...register('fecha_reunion')} />
                </div>

                {megaFiesta && (
                  <label className="flex items-center gap-2 self-end pb-2 text-sm">
                    <Checkbox checked={esMegaFiesta} onCheckedChange={(v) => setEsMegaFiesta(v === true)} />
                    <PartyPopper className="h-4 w-4 text-primary" />
                    Fue la Mega Fiesta de Casas de Paz
                  </label>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                      <SelectValue placeholder="—" />
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

                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label>Disertador {campos?.REPORTE_DISERTADOR_OBLIGATORIO && '*'}</Label>
                  <Select value={disertadorId ?? ''} onValueChange={(v) => setValue('disertador_id', v)}>
                    <SelectTrigger className="w-full sm:w-72">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {miembros.map((m) => (
                        <SelectItem key={m.persona_id} value={m.persona_id}>
                          {m.nombre_completo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Asistencia
                </Label>
                {cargandoMiembros ? (
                  <Skeleton className="h-32 w-full" />
                ) : (
                  <AsistenciaChecklist
                    miembros={miembros}
                    seleccionados={seleccionados}
                    onToggle={toggleAsistente}
                    esMenorPorPersona={esMenorPorPersona}
                    onEsMenorChange={(id, v) => setEsMenorPorPersona((prev) => ({ ...prev, [id]: v }))}
                    visitasNuevas={visitasNuevas}
                    onAgregarVisita={(v) => setVisitasNuevas((prev) => [...prev, v])}
                    onQuitarVisita={(i) => setVisitasNuevas((prev) => prev.filter((_, idx) => idx !== i))}
                  />
                )}
              </div>

              <div className="flex flex-col gap-3">
                {campos?.REPORTE_SALIO_EVANGELIZAR_VISIBLE && (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={salioEvangelizar}
                      onCheckedChange={(v) => setValue('salio_evangelizar', v === true)}
                    />
                    Salieron a evangelizar
                  </label>
                )}
                {salioEvangelizar && (
                  <div className="flex flex-col gap-1.5 sm:w-56">
                    <Label htmlFor="evangelizados_declarados">Evangelizados en la salida</Label>
                    <Input id="evangelizados_declarados" type="number" min="0" {...register('evangelizados_declarados')} />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="total_ofrendas">Total ofrendas *</Label>
                  <Input id="total_ofrendas" type="number" step="0.01" min="0" {...register('total_ofrendas')} />
                  {errors.total_ofrendas && <p className="text-sm text-destructive">{errors.total_ofrendas.message}</p>}
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="testimonios">Testimonios {campos?.REPORTE_TESTIMONIOS_OBLIGATORIO && '*'}</Label>
                  <Textarea id="testimonios" {...register('testimonios')} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="comentarios">Comentarios {campos?.REPORTE_COMENTARIOS_OBLIGATORIO && '*'}</Label>
                  <Textarea id="comentarios" {...register('comentarios')} />
                </div>
              </div>

              <Button type="submit" disabled={isSubmitting} className="self-start">
                {isSubmitting ? 'Enviando...' : 'Enviar reporte'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div>
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Reportes recientes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {recientes.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay reportes.</p>}
            {recientes.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span>{r.fecha_reunion}</span>
                <span className="text-muted-foreground">
                  {r.total_asistentes} ({r.total_menores}m/{r.total_mayores}M)
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
