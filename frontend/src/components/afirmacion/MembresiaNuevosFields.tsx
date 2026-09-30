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
import type { DatosMembresiaNuevos, EsBautizado } from '@/types/membresia-nuevos.types';

const ESTADOS_CIVILES = [
  ['SOLTERO', 'Soltero/a'],
  ['CASADO', 'Casado/a'],
  ['VIUDO', 'Viudo/a'],
  ['DIVORCIADO', 'Divorciado/a'],
  ['CONCUBINATO', 'Concubinato'],
] as const;

const BAUTIZADO_OPCIONES: [EsBautizado, string][] = [
  ['NO', 'No está bautizado'],
  ['CATOLICA', 'Sí — Iglesia Católica'],
  ['EVANGELICA', 'Sí — Iglesia Evangélica'],
  ['CENTRO_VIDA', 'Sí — Centro de Vida'],
];

const CATEGORIA_EVANGELISMO = [
  ['UNO_A_UNO', '1+1'],
  ['CDP', 'CdP'],
  ['ELITE', 'Elite'],
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
}

export function MembresiaNuevosFields({ valores, onChange }: Props) {
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mn_horario">Horario de contacto</Label>
            <Input id="mn_horario" className={CAMPO_ESTILO} placeholder="Ej. tardes, después de las 18h" value={valores.horarioContacto} onChange={(e) => set('horarioContacto', e.target.value)} />
          </div>
        </div>
      </Seccion>

      {/* Familia */}
      <Seccion titulo="Familia">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mn_conyuge">Cónyuge (nombre)</Label>
            <Input id="mn_conyuge" className={CAMPO_ESTILO} value={valores.conyugeNombre} onChange={(e) => set('conyugeNombre', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mn_hijos">Hijos (nombres)</Label>
            <Input id="mn_hijos" className={CAMPO_ESTILO} placeholder="Separados por coma" value={valores.hijos} onChange={(e) => set('hijos', e.target.value)} />
          </div>
        </div>
      </Seccion>

      {/* Proceso / evangelismo */}
      <Seccion titulo="Proceso">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>¿Está bautizado?</Label>
            <Select value={valores.esBautizado} onValueChange={(v) => set('esBautizado', v as EsBautizado)}>
              <SelectTrigger className={cn('w-full', CAMPO_ESTILO)}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                {BAUTIZADO_OPCIONES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {(valores.esBautizado === 'CATOLICA' || valores.esBautizado === 'EVANGELICA') && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mn_iglesia">¿Cuál iglesia?</Label>
              <Input id="mn_iglesia" className={CAMPO_ESTILO} value={valores.bautismoIglesiaNombre} onChange={(e) => set('bautismoIglesiaNombre', e.target.value)} />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>Categoría de evangelismo</Label>
            <Select value={valores.categoriaEvangelismo} onValueChange={(v) => set('categoriaEvangelismo', v)}>
              <SelectTrigger className={cn('w-full', CAMPO_ESTILO)}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                {CATEGORIA_EVANGELISMO.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
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

      {/* Casa de Paz / afinidad (harness/23) */}
      <Seccion titulo="Casa de Paz">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mn_invitador">¿Quién lo invitó? (afinidad)</Label>
            <Input
              id="mn_invitador"
              className={CAMPO_ESTILO}
              placeholder="Nombre de quien lo invitó / con quién tiene afinidad"
              value={valores.invitadorNombre}
              disabled={valores.asignar}
              onChange={(e) => set('invitadorNombre', e.target.value)}
            />
          </div>
          <SiNo
            label="No fue invitado por nadie — asignar Casa de Paz después"
            value={valores.asignar}
            onChange={(v) => onChange({ ...valores, asignar: v, invitadorNombre: v ? '' : valores.invitadorNombre })}
          />
        </div>
      </Seccion>
    </div>
  );
}
