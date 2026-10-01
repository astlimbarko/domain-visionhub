// KAN-488 (harness/21): campos de la "Membresía desde 0" (gente nueva), una
// sola página con scroll. Reusa DatosBasicosPersonaFields para los datos
// básicos y agrega las secciones del inventario del spec + la opción "Asignar"
// (harness/23). Componente controlado: recibe valores + onChange.
import { cn } from '@/lib/utils';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatosBasicosPersonaFields } from '@/components/personas/DatosBasicosPersonaFields';
import { GRADOS_INSTRUCCION } from '@/components/shared/CamposMembresiaFields';
import { SelectorCasaDePaz } from '@/components/afirmacion/SelectorCasaDePaz';
import type { DatosMembresiaNuevos } from '@/types/membresia-nuevos.types';
import { DISCIPULADO_NIVEL_LABELS } from '@/types/persona.types';

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
          <div className="flex flex-col gap-1.5">
            <Label>¿Está en discipulado? (nivel)</Label>
            <Select value={valores.discipuladoNivel} onValueChange={(v) => set('discipuladoNivel', v)}>
              <SelectTrigger className={cn('w-full', CAMPO_ESTILO)}><SelectValue placeholder="No está en discipulado" /></SelectTrigger>
              <SelectContent>
                {Object.entries(DISCIPULADO_NIVEL_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Seccion>

      {/* Casa de Paz (KAN-490): selector unificado -- invitador (sistema o texto
          libre) + auto-sugerir su CdP con override + buscador por nombre/líder/Red
          + fallback "sin asignar" (designación). Mismo componente que Altar/Bautismo/RSIL. */}
      <Seccion titulo="Casa de Paz">
        <SelectorCasaDePaz
          iglesiaId={iglesiaId}
          valores={{
            invitadorPersonaId: valores.invitadorPersonaId,
            invitadorNombre: valores.invitadorNombre,
            invitadorEsLibre: valores.invitadorEsLibre,
            casaDePazId: valores.casaDePazId,
            casaDePazNombre: valores.casaDePazNombre,
          }}
          onChange={(cdp) => onChange({ ...valores, ...cdp })}
        />
      </Seccion>
    </div>
  );
}
