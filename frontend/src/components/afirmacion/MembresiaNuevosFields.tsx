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
import { SeccionConyugeMembresia, SeccionFamiliaMembresia } from '@/components/shared/CamposMembresiaExtendidaFields';
import { SelectorCasaDePaz } from '@/components/afirmacion/SelectorCasaDePaz';
import { useMinisterios } from '@/hooks/useMinisterios';
import { useMotivosLlegada } from '@/hooks/usePersonas';
import type { DatosMembresiaNuevos } from '@/types/membresia-nuevos.types';
import { DISCIPULADO_NIVEL_LABELS } from '@/types/persona.types';

// Radix Select no permite value="" -- sentinela para la opción "Ninguno".
const NINGUNO = '__NINGUNO__';

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
  // Lista de ministerios de la iglesia, para el combobox "¿cuál ministerio?".
  const { data: ministerios = [] } = useMinisterios(valores.trabajoMinisterio ? iglesiaId : undefined);
  // Motivos de llegada (reusa el catálogo ya existente, igual que FichaLlegada).
  const { data: motivosLlegada = [] } = useMotivosLlegada();

  function set<K extends keyof DatosMembresiaNuevos>(campo: K, valor: DatosMembresiaNuevos[K]) {
    onChange({ ...valores, [campo]: valor });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Datos básicos de la persona (reuso el componente compartido) */}
      <Seccion titulo="Datos de la persona">
        <DatosBasicosPersonaFields valores={valores} onChange={(v) => onChange({ ...valores, ...v })} marcarObligatorios />
      </Seccion>

      {/* Datos complementarios */}
      <Seccion titulo="Datos complementarios">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mn_ci">Número de documento *</Label>
            <Input id="mn_ci" className={CAMPO_ESTILO} placeholder="CI, pasaporte u otro documento" value={valores.ci} onChange={(e) => set('ci', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mn_correo">Correo</Label>
            <Input id="mn_correo" type="email" className={CAMPO_ESTILO} placeholder="Opcional — recibirá un correo de bienvenida" value={valores.correo} onChange={(e) => set('correo', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Estado civil *</Label>
            <Select value={valores.estadoCivil} onValueChange={(v) => set('estadoCivil', v)}>
              <SelectTrigger className={cn('w-full', CAMPO_ESTILO)}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                {ESTADOS_CIVILES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mn_ocupacion">Ocupación *</Label>
            <Input id="mn_ocupacion" className={CAMPO_ESTILO} value={valores.ocupacion} onChange={(e) => set('ocupacion', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Grado de instrucción *</Label>
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
            <Label>¿Cómo llegó a la iglesia? *</Label>
            <Select value={valores.motivoLlegadaId} onValueChange={(v) => set('motivoLlegadaId', v)}>
              <SelectTrigger className={cn('w-full', CAMPO_ESTILO)}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                {motivosLlegada.map((m) => <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Seccion>

      {/* Preguntas livianas sobre vínculo con la iglesia */}
      <Seccion titulo="Vínculo con la iglesia">
        <div className="flex flex-col gap-3">
          <SiNo label="¿Ya asiste a la iglesia?" value={valores.yaAsisteIglesia} onChange={(v) => set('yaAsisteIglesia', v)} />
          <SiNo label="¿Ha trabajado en algún ministerio?" value={valores.trabajoMinisterio} onChange={(v) => set('trabajoMinisterio', v)} />
          {valores.trabajoMinisterio && (
            <div className="flex flex-col gap-1.5">
              <Label>¿Cuál ministerio?</Label>
              <Select value={valores.ministerioCual} onValueChange={(v) => set('ministerioCual', v)}>
                <SelectTrigger className={cn('w-full', CAMPO_ESTILO)}><SelectValue placeholder="Elegí el ministerio" /></SelectTrigger>
                <SelectContent>
                  {ministerios.filter((m) => m.activo).map((m) => (
                    <SelectItem key={m.id} value={m.nombre}>{m.nombre}</SelectItem>
                  ))}
                  {ministerios.filter((m) => m.activo).length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">No hay ministerios cargados en esta iglesia.</div>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>¿Está en algún discipulado?</Label>
            <Select
              value={valores.discipuladoNivel || NINGUNO}
              onValueChange={(v) => set('discipuladoNivel', v === NINGUNO ? '' : v)}
            >
              <SelectTrigger className={cn('w-full', CAMPO_ESTILO)}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NINGUNO}>Ninguno</SelectItem>
                {Object.entries(DISCIPULADO_NIVEL_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Seccion>

      {/* Familia + Cónyuge (UX 2026-10-02): se reusan las secciones de la
          membresía extendida. Ambas operan solo sobre `familiares` (el cónyuge
          es un familiar con tipo_relacion_codigo='CONYUGE'). */}
      <Seccion titulo="Familia">
        <SeccionConyugeMembresia
          value={{ familiares: valores.familiares }}
          onChange={(v) => set('familiares', v.familiares ?? [])}
        />
        <SeccionFamiliaMembresia
          value={{ familiares: valores.familiares }}
          onChange={(v) => set('familiares', v.familiares ?? [])}
        />
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
