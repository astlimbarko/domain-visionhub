// KAN-488 (harness/21): campos de la "Membresía desde 0" (gente nueva), una
// sola página con scroll. Reusa DatosBasicosPersonaFields para los datos
// básicos y agrega las secciones del inventario del spec + la opción "Asignar"
// (harness/23). Componente controlado: recibe valores + onChange.
import { cn } from '@/lib/utils';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatosBasicosPersonaFields } from '@/components/personas/DatosBasicosPersonaFields';
import { GRADOS_INSTRUCCION } from '@/components/shared/CamposMembresiaFields';
import { BuscadorPersona } from '@/components/casas-de-paz/BuscadorPersona';
import { useCasasDePazAfirmacion } from '@/hooks/useAfirmacion';
import type { PersonaBusqueda } from '@/types/casas-de-paz.types';
import type { DatosMembresiaNuevos } from '@/types/membresia-nuevos.types';

const ESTADOS_CIVILES = [
  ['SOLTERO', 'Soltero/a'],
  ['CASADO', 'Casado/a'],
  ['VIUDO', 'Viudo/a'],
  ['DIVORCIADO', 'Divorciado/a'],
  ['CONCUBINATO', 'Concubinato'],
] as const;

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{titulo}</h3>
      {children}
    </section>
  );
}

function SiNo({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3.5 py-2.5">
      <span className="text-sm">{label}</span>
      <Checkbox checked={value} onCheckedChange={(v) => onChange(v === true)} />
    </label>
  );
}

interface Props {
  valores: DatosMembresiaNuevos;
  onChange: (valores: DatosMembresiaNuevos) => void;
  iglesiaId: string;
}

export function MembresiaNuevosFields({ valores, onChange, iglesiaId }: Props) {
  const { data: casasDePaz = [] } = useCasasDePazAfirmacion(valores.cdpModo === 'LISTA' ? iglesiaId : undefined);

  function set<K extends keyof DatosMembresiaNuevos>(campo: K, valor: DatosMembresiaNuevos[K]) {
    onChange({ ...valores, [campo]: valor });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Datos básicos de la persona (reuso el componente compartido) */}
      <Seccion titulo="Datos de la persona">
        <DatosBasicosPersonaFields valores={valores} onChange={(v) => onChange({ ...valores, ...v })} />
      </Seccion>

      {/* Datos complementarios */}
      <Seccion titulo="Datos complementarios">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mn_ci">CI</Label>
            <Input id="mn_ci" className={CAMPO_ESTILO} value={valores.ci} onChange={(e) => set('ci', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mn_correo">Correo</Label>
            <Input id="mn_correo" type="email" className={CAMPO_ESTILO} value={valores.correo} onChange={(e) => set('correo', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Estado civil</Label>
            <Select value={valores.estadoCivil} onValueChange={(v) => set('estadoCivil', v)}>
              <SelectTrigger className={cn('w-full', CAMPO_ESTILO)}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                {ESTADOS_CIVILES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mn_ocupacion">Ocupación</Label>
            <Input id="mn_ocupacion" className={CAMPO_ESTILO} value={valores.ocupacion} onChange={(e) => set('ocupacion', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Grado de instrucción</Label>
            <Select value={valores.gradoInstruccion} onValueChange={(v) => set('gradoInstruccion', v)}>
              <SelectTrigger className={cn('w-full', CAMPO_ESTILO)}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                {GRADOS_INSTRUCCION.map((g) => <SelectItem key={g} value={g}>{g.replaceAll('_', ' ').toLowerCase()}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Seccion>

      {/* Proceso. Bautismo y categoría de evangelismo se quitaron (decisión del
          owner 2026-10-01): el bautismo vive solo en el proceso Bautismo. */}
      <Seccion titulo="Proceso">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mn_comollego">¿Cómo llegó a la iglesia?</Label>
            <Input id="mn_comollego" className={CAMPO_ESTILO} placeholder="Solo / alguien lo invitó (quién)" value={valores.comoLlego} onChange={(e) => set('comoLlego', e.target.value)} />
          </div>
          <SiNo label="¿Es visita / simpatizante?" value={valores.esVisita} onChange={(v) => set('esVisita', v)} />
        </div>
      </Seccion>

      {/* Preguntas livianas sobre vínculo con la iglesia */}
      <Seccion titulo="Vínculo con la iglesia">
        <div className="flex flex-col gap-3">
          <SiNo label="¿Ya asiste a la iglesia?" value={valores.yaAsisteIglesia} onChange={(v) => set('yaAsisteIglesia', v)} />
          <SiNo label="¿Ha trabajado en algún ministerio?" value={valores.trabajoMinisterio} onChange={(v) => set('trabajoMinisterio', v)} />
          {valores.trabajoMinisterio && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mn_min">¿Cuál ministerio?</Label>
              <Input id="mn_min" className={CAMPO_ESTILO} value={valores.ministerioCual} onChange={(e) => set('ministerioCual', e.target.value)} />
            </div>
          )}
          <SiNo label="¿Está en discipulado?" value={valores.enDiscipulado} onChange={(v) => set('enDiscipulado', v)} />
        </div>
      </Seccion>

      {/* Casa de Paz (harness/23): 3 formas -- por invitador/afinidad, de la
          lista, o ninguna (va a designaciones). */}
      <Seccion titulo="Casa de Paz">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>¿Cómo se define su Casa de Paz?</Label>
            <Select
              value={valores.cdpModo}
              onValueChange={(v) =>
                onChange({
                  ...valores,
                  cdpModo: v as DatosMembresiaNuevos['cdpModo'],
                  invitadorPersonaId: '',
                  invitadorNombre: '',
                  casaDePazId: '',
                  casaDePazNombre: '',
                })
              }
            >
              <SelectTrigger className={cn('w-full', CAMPO_ESTILO)}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INVITADOR">Por quién lo invitó (afinidad)</SelectItem>
                <SelectItem value="LISTA">Elegir de la lista</SelectItem>
                <SelectItem value="ASIGNAR">Ninguna — asignar después</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {valores.cdpModo === 'INVITADOR' &&
            (valores.invitadorNombre ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3.5 py-2.5">
                <span className="truncate text-sm font-medium">{valores.invitadorNombre}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...valores, invitadorPersonaId: '', invitadorNombre: '' })}>
                  Cambiar
                </Button>
              </div>
            ) : (
              <BuscadorPersona
                iglesiaId={iglesiaId}
                onSeleccionar={(p: PersonaBusqueda) => onChange({ ...valores, invitadorPersonaId: p.id, invitadorNombre: p.nombre_completo })}
              />
            ))}

          {valores.cdpModo === 'LISTA' && (
            <Select
              value={valores.casaDePazId}
              onValueChange={(v) => {
                const c = casasDePaz.find((x) => x.casa_de_paz_id === v);
                onChange({ ...valores, casaDePazId: v, casaDePazNombre: c?.casa_de_paz_etiqueta ?? '' });
              }}
            >
              <SelectTrigger className={cn('w-full', CAMPO_ESTILO)}><SelectValue placeholder="Elegí la Casa de Paz" /></SelectTrigger>
              <SelectContent>
                {casasDePaz.map((c) => <SelectItem key={c.casa_de_paz_id} value={c.casa_de_paz_id}>{c.casa_de_paz_etiqueta}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {valores.cdpModo === 'ASIGNAR' && (
            <p className="rounded-xl border border-border/50 bg-muted/30 px-3.5 py-2.5 text-xs text-muted-foreground">
              Esta persona quedará <span className="font-medium text-foreground">sin Casa de Paz</span> y su caso irá a la sección de designaciones, para que el líder de Afirmación le asigne una más adelante.
            </p>
          )}
        </div>
      </Seccion>
    </div>
  );
}
