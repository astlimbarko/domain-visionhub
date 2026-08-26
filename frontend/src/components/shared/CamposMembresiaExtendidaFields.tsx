/**
 * KAN-123: los 8 grupos de campos nuevos del formulario de Membresía
 * (Discipulados, Seminario, Universidad del Rey Jesús, Mentor, Bautismo,
 * Cónyuge, Familia, Ministerios), organizados en 3 secciones para el wizard
 * de KAN-124 (Formación / Mentor+Bautismo / Familia+Ministerios).
 *
 * Componente 100% controlado (value/onChange) y desacoplado de
 * react-hook-form a propósito: los 3 formularios que lo usan
 * (FormularioMembresiaPublico, MembresiaObligatoria, RegistrarPersonaAfirmacion)
 * tienen cada uno su propio esquema zod distinto para los campos censales
 * base -- estos campos son todos opcionales y se mandan tal cual al backend
 * (fn_guardar_membresia_extendida), así que no hace falta que compartan
 * resolver de validación.
 */
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { useTiposDiscipulado } from '@/hooks/useMembresiaExtendida';
import {
  OPCIONES_EFESIO,
  OPCIONES_PRECISION_FECHA,
  OPCIONES_RANGO_MIEMBRO,
  TIPOS_RELACION_FAMILIA,
  type DatosMembresiaExtendida,
  type EfesioTipo,
  type FamiliarInput,
  type FechaConPrecision,
  type PrecisionFecha,
  type RangoMiembro,
} from '@/types/membresia-extendida.types';

interface MinisterioOpcion {
  id: string;
  nombre: string;
}

function actualizarValor<K extends keyof DatosMembresiaExtendida>(
  valor: DatosMembresiaExtendida,
  onChange: (v: DatosMembresiaExtendida) => void,
  campo: K,
  dato: DatosMembresiaExtendida[K]
) {
  onChange({ ...valor, [campo]: dato });
}

// Fecha + precisión: solo pide los campos que la precisión elegida permite
// contestar (regla de negocio heredada, technical-design.md §2.1 -- nunca
// obligar a inventar un día o mes que la persona no recuerda).
function CampoFechaConPrecision({
  valor,
  onChange,
}: {
  valor: FechaConPrecision;
  onChange: (v: FechaConPrecision) => void;
}) {
  const precision = valor.precision_fecha;
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg bg-muted/40 p-2">
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Precisión de la fecha</Label>
        <Select
          value={precision ?? ''}
          onValueChange={(v) => onChange({ ...valor, precision_fecha: v as PrecisionFecha })}
        >
          <SelectTrigger className={cn('h-8 w-44 text-xs', CAMPO_ESTILO)}>
            <SelectValue placeholder="No recuerdo / prefiero no decir" />
          </SelectTrigger>
          <SelectContent>
            {OPCIONES_PRECISION_FECHA.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {precision && (
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Año</Label>
          <Input
            type="number"
            className={cn('h-8 w-20 text-xs', CAMPO_ESTILO)}
            value={valor.anio ?? ''}
            onChange={(e) => onChange({ ...valor, anio: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
      )}
      {(precision === 'EXACTA' || precision === 'APROXIMADA' || precision === 'SOLO_MES_ANIO') && (
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Mes</Label>
          <Input
            type="number"
            min={1}
            max={12}
            className={cn('h-8 w-16 text-xs', CAMPO_ESTILO)}
            value={valor.mes ?? ''}
            onChange={(e) => onChange({ ...valor, mes: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
      )}
      {(precision === 'EXACTA' || precision === 'APROXIMADA') && (
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Día</Label>
          <Input
            type="number"
            min={1}
            max={31}
            className={cn('h-8 w-16 text-xs', CAMPO_ESTILO)}
            value={valor.dia ?? ''}
            onChange={(e) => onChange({ ...valor, dia: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
      )}
    </div>
  );
}

interface SeccionProps {
  value: DatosMembresiaExtendida;
  onChange: (v: DatosMembresiaExtendida) => void;
}

// Página 1a: Discipulados realizados (separado de Seminario/Universidad --
// KAN-228, paso demasiado denso cuando se marcan varios discipulados con
// fecha cada uno).
export function SeccionDiscipuladosMembresia({ value, onChange }: SeccionProps) {
  const { data: tiposDiscipulado = [], isLoading } = useTiposDiscipulado();
  const seleccionados = value.discipulados ?? [];
  const ninguno = value.discipulados_ninguno ?? false;

  function estaSeleccionado(tipoId: string) {
    return seleccionados.some((d) => d.tipo_discipulado_id === tipoId);
  }

  function alternarDiscipulado(tipoId: string, marcado: boolean) {
    if (marcado) {
      onChange({
        ...value,
        discipulados_ninguno: false,
        discipulados: [...seleccionados, { tipo_discipulado_id: tipoId }],
      });
    } else {
      actualizarValor(
        value,
        onChange,
        'discipulados',
        seleccionados.filter((d) => d.tipo_discipulado_id !== tipoId)
      );
    }
  }

  function actualizarFechaDiscipulado(tipoId: string, fecha: FechaConPrecision) {
    actualizarValor(
      value,
      onChange,
      'discipulados',
      seleccionados.map((d) => (d.tipo_discipulado_id === tipoId ? { ...d, ...fecha } : d))
    );
  }

  function marcarNinguno(marcado: boolean) {
    onChange({ ...value, discipulados_ninguno: marcado, discipulados: marcado ? [] : seleccionados });
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>Discipulados realizados *</Label>
      {isLoading ? (
        <Skeleton className="h-24 w-full rounded-lg" />
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 rounded-lg border border-border p-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={ninguno} onCheckedChange={(v) => marcarNinguno(v === true)} />
              Ninguno
            </label>
          </div>
          {tiposDiscipulado.map((tipo) => (
            <div key={tipo.id} className="flex flex-col gap-2 rounded-lg border border-border p-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={estaSeleccionado(tipo.id)}
                  onCheckedChange={(v) => alternarDiscipulado(tipo.id, v === true)}
                />
                {tipo.nombre}
              </label>
              {estaSeleccionado(tipo.id) && (
                <CampoFechaConPrecision
                  valor={seleccionados.find((d) => d.tipo_discipulado_id === tipo.id) ?? {}}
                  onChange={(fecha) => actualizarFechaDiscipulado(tipo.id, fecha)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// KAN-252: true si la sección cumple "eligió al menos una opción" (Ninguno
// o algún discipulado real) -- lo usan los 3 formularios que la envuelven
// para bloquear el avance de página sin obligar a que esta sección conozca
// nada de FormularioPaginado/toasts.
export function discipuladosRespondido(value: DatosMembresiaExtendida): boolean {
  return !!value.discipulados_ninguno || (value.discipulados ?? []).length > 0;
}

// Página 1b: Seminario + Universidad del Rey Jesús.
export function SeccionSeminarioUniversidadMembresia({ value, onChange }: SeccionProps) {
  function marcarSeminario(marcado: boolean) {
    onChange({ ...value, seminario: marcado, seminario_universidad_ninguna: marcado ? false : value.seminario_universidad_ninguna });
  }

  function marcarUniversidad(marcado: boolean) {
    onChange({ ...value, universidad: marcado, seminario_universidad_ninguna: marcado ? false : value.seminario_universidad_ninguna });
  }

  function marcarNinguna(marcado: boolean) {
    onChange({
      ...value,
      seminario_universidad_ninguna: marcado,
      seminario: marcado ? false : value.seminario,
      universidad: marcado ? false : value.universidad,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <label className="flex items-center gap-2 text-sm font-medium">
        <Checkbox
          checked={value.seminario_universidad_ninguna ?? false}
          onCheckedChange={(v) => marcarNinguna(v === true)}
        />
        Ninguna
      </label>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <Checkbox checked={value.seminario ?? false} onCheckedChange={(v) => marcarSeminario(v === true)} />
          ¿Está o estuvo en el Seminario?
        </label>
        {value.seminario && (
          <CampoFechaConPrecision
            valor={{
              anio: value.seminario_anio,
              mes: value.seminario_mes,
              dia: value.seminario_dia,
              precision_fecha: value.seminario_precision_fecha,
            }}
            onChange={(f) =>
              onChange({
                ...value,
                seminario_anio: f.anio,
                seminario_mes: f.mes,
                seminario_dia: f.dia,
                seminario_precision_fecha: f.precision_fecha,
              })
            }
          />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <Checkbox checked={value.universidad ?? false} onCheckedChange={(v) => marcarUniversidad(v === true)} />
          ¿Cursó la Universidad del Rey Jesús?
        </label>
        {value.universidad && (
          <CampoFechaConPrecision
            valor={{
              anio: value.universidad_anio,
              mes: value.universidad_mes,
              dia: value.universidad_dia,
              precision_fecha: value.universidad_precision_fecha,
            }}
            onChange={(f) =>
              onChange({
                ...value,
                universidad_anio: f.anio,
                universidad_mes: f.mes,
                universidad_dia: f.dia,
                universidad_precision_fecha: f.precision_fecha,
              })
            }
          />
        )}
      </div>
    </div>
  );
}

// KAN-252: true si la sección cumple "eligió al menos una opción" (Ninguna,
// Seminario o Universidad) -- mismo criterio que discipuladosRespondido.
export function seminarioUniversidadRespondido(value: DatosMembresiaExtendida): boolean {
  return !!value.seminario_universidad_ninguna || !!value.seminario || !!value.universidad;
}

// Página 2: Mentor + Bautismo.
export function SeccionMentorBautismoMembresia({ value, onChange }: SeccionProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <Checkbox
            checked={value.mentor ?? false}
            onCheckedChange={(v) => actualizarValor(value, onChange, 'mentor', v === true)}
          />
          ¿Tenés un mentor?
        </label>
        {value.mentor && (
          <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-2 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Nombre del mentor</Label>
              <Input
                className={CAMPO_ESTILO}
                value={value.mentor_nombre_txt ?? ''}
                onChange={(e) => actualizarValor(value, onChange, 'mentor_nombre_txt', e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 pb-1.5 text-sm">
              <Checkbox
                checked={value.mentor_es_miembro ?? false}
                onCheckedChange={(v) => actualizarValor(value, onChange, 'mentor_es_miembro', v === true)}
              />
              Es miembro de la iglesia
            </label>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <Checkbox
            checked={value.bautizado ?? false}
            onCheckedChange={(v) => actualizarValor(value, onChange, 'bautizado', v === true)}
          />
          ¿Está bautizado/a en agua?
        </label>
        {value.bautizado && (
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={value.bautizado_en_nuestra_iglesia ?? false}
                onCheckedChange={(v) => actualizarValor(value, onChange, 'bautizado_en_nuestra_iglesia', v === true)}
              />
              Fue bautizado/a en esta iglesia
            </label>
            <CampoFechaConPrecision
              valor={{
                anio: value.bautismo_anio,
                mes: value.bautismo_mes,
                dia: value.bautismo_dia,
                precision_fecha: value.bautismo_precision_fecha,
              }}
              onChange={(f) =>
                onChange({
                  ...value,
                  bautismo_anio: f.anio,
                  bautismo_mes: f.mes,
                  bautismo_dia: f.dia,
                  bautismo_precision_fecha: f.precision_fecha,
                })
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

const NINGUNO = '__ninguno__';

/**
 * Censo de cargos (plan panel Afirmación 2026-08-20, punto 4/4). Puramente
 * informativo/autodeclarado -- no toca persona_cargo/casa_de_paz_cargo/
 * red_cargo/departamento_cargo (las tablas operativas reales, con sus
 * propias reglas de exclusividad y permisos: por ejemplo solo el Pastor
 * asigna un Efesio real, y Líder de CdP dispara una URL pública). Efesio es
 * un combobox único (una persona es un solo tipo a la vez); el resto de
 * cargos son checks independientes entre sí.
 *
 * "Discípulo/Afirmado/Creyente" es el rango de un miembro sin ningún
 * liderazgo -- se oculta apenas la persona marca cualquier cargo arriba
 * (si tiene un cargo "alto", ya no tiene "rango bajo"). `formulario_version`
 * ('v1' hoy) queda guardado junto al resto para poder retirar esta pregunta
 * puntual el día que el sistema ya tenga datos reales que consultar en vez
 * de autodeclarados.
 */
export function SeccionCargoRangoMembresia({ value, onChange }: SeccionProps) {
  const tieneCargo =
    !!value.efesio_tipo ||
    !!value.cargo_ministro ||
    !!value.cargo_anciano ||
    !!value.cargo_diacono ||
    !!value.cargo_mentor ||
    !!value.cargo_sub_mentor ||
    !!value.cargo_lider_cdp ||
    !!value.cargo_sublider_cdp ||
    !!value.cargo_lider_ministerio;

  function toggleCargo(campo: keyof DatosMembresiaExtendida, marcado: boolean) {
    actualizarValor(value, onChange, campo, marcado as never);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label>Efesio</Label>
        <p className="text-xs text-muted-foreground">Apóstol, Profeta, Pastor, Evangelista o Maestro -- elegí uno, o "Ninguno".</p>
        <Select
          value={value.efesio_tipo ?? NINGUNO}
          onValueChange={(v) => actualizarValor(value, onChange, 'efesio_tipo', v === NINGUNO ? undefined : (v as EfesioTipo))}
        >
          <SelectTrigger className={cn('w-full sm:max-w-xs', CAMPO_ESTILO)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NINGUNO}>Ninguno</SelectItem>
            {OPCIONES_EFESIO.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Otros cargos</Label>
        <p className="text-xs text-muted-foreground">Marcá todos los que correspondan -- no son excluyentes entre sí.</p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {(
            [
              ['cargo_ministro', 'Ministro'],
              ['cargo_anciano', 'Anciano'],
              ['cargo_diacono', 'Diácono'],
              ['cargo_mentor', 'Mentor'],
              ['cargo_sub_mentor', 'Sub mentor'],
              ['cargo_lider_cdp', 'Líder de CdPz'],
              ['cargo_sublider_cdp', 'Sub líder de CdPz'],
              ['cargo_lider_ministerio', 'Líder de Ministerio'],
            ] as const
          ).map(([campo, etiqueta]) => (
            <label key={campo} className="flex items-center gap-2 text-sm">
              <Checkbox checked={!!value[campo]} onCheckedChange={(v) => toggleCargo(campo, v === true)} />
              {etiqueta}
            </label>
          ))}
        </div>
      </div>

      {!tieneCargo && (
        <div className="flex flex-col gap-2">
          <Label>Posición en la iglesia</Label>
          <p className="text-xs text-muted-foreground">Para quienes todavía no tienen ningún cargo o liderazgo.</p>
          <Select
            value={value.rango_miembro ?? NINGUNO}
            onValueChange={(v) => actualizarValor(value, onChange, 'rango_miembro', v === NINGUNO ? undefined : (v as RangoMiembro))}
          >
            <SelectTrigger className={cn('w-full', CAMPO_ESTILO)}>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {OPCIONES_RANGO_MIEMBRO.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label} — {o.descripcion}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

function FilaFamiliar({
  familiar,
  onChange,
  onQuitar,
  etiquetaTipoFija,
}: {
  familiar: FamiliarInput;
  onChange: (f: FamiliarInput) => void;
  onQuitar?: () => void;
  etiquetaTipoFija?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-2 sm:flex-row sm:items-end">
      {etiquetaTipoFija ? (
        <div className="flex flex-1 flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Parentesco</Label>
          <Input className={CAMPO_ESTILO} value={etiquetaTipoFija} disabled />
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Parentesco</Label>
          <Select
            value={familiar.tipo_relacion_codigo}
            onValueChange={(v) => onChange({ ...familiar, tipo_relacion_codigo: v })}
          >
            <SelectTrigger className={cn('w-full', CAMPO_ESTILO)}>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_RELACION_FAMILIA.map((t) => (
                <SelectItem key={t.codigo} value={t.codigo}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex flex-1 flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Nombre</Label>
        <Input
          className={CAMPO_ESTILO}
          value={familiar.nombre_familiar}
          onChange={(e) => onChange({ ...familiar, nombre_familiar: e.target.value })}
        />
      </div>
      <label className="flex items-center gap-2 pb-1.5 text-sm">
        <Checkbox
          checked={familiar.es_miembro}
          onCheckedChange={(v) => onChange({ ...familiar, es_miembro: v === true })}
        />
        Es miembro
      </label>
      {onQuitar && (
        <Button type="button" variant="ghost" size="icon-sm" onClick={onQuitar} aria-label="Quitar familiar">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      )}
    </div>
  );
}

// Página 3a: Cónyuge, separado de Familia/Ministerios (KAN-228 -- paso
// propio, más liviano).
export function SeccionConyugeMembresia({ value, onChange }: SeccionProps) {
  const [tieneConyuge, setTieneConyuge] = useState(
    (value.familiares ?? []).some((f) => f.tipo_relacion_codigo === 'CONYUGE')
  );

  const conyuge = (value.familiares ?? []).find((f) => f.tipo_relacion_codigo === 'CONYUGE');

  function setConyuge(f: FamiliarInput | null) {
    const resto = (value.familiares ?? []).filter((x) => x.tipo_relacion_codigo !== 'CONYUGE');
    actualizarValor(value, onChange, 'familiares', f ? [f, ...resto] : resto);
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-sm font-medium">
        <Checkbox
          checked={tieneConyuge}
          onCheckedChange={(v) => {
            const marcado = v === true;
            setTieneConyuge(marcado);
            if (!marcado) setConyuge(null);
            else setConyuge({ tipo_relacion_codigo: 'CONYUGE', nombre_familiar: '', es_miembro: false });
          }}
        />
        ¿Tiene cónyuge?
      </label>
      {tieneConyuge && conyuge && <FilaFamiliar familiar={conyuge} onChange={setConyuge} etiquetaTipoFija="Cónyuge" />}
    </div>
  );
}

// Página 3b: Familia + Ministerios (Cónyuge quedó en su propio paso,
// SeccionConyugeMembresia -- Ministerios es opcional, null/undefined en el
// flujo público, ver KAN-125).
export function SeccionFamiliaMinisteriosMembresia({
  value,
  onChange,
  ministerios,
}: SeccionProps & { ministerios?: MinisterioOpcion[] }) {
  const conyuge = (value.familiares ?? []).find((f) => f.tipo_relacion_codigo === 'CONYUGE');
  const otrosFamiliares = (value.familiares ?? []).filter((f) => f.tipo_relacion_codigo !== 'CONYUGE');

  function actualizarFamiliares(nuevos: FamiliarInput[]) {
    actualizarValor(value, onChange, 'familiares', conyuge ? [conyuge, ...nuevos] : nuevos);
  }

  function agregarFamiliar() {
    actualizarFamiliares([...otrosFamiliares, { tipo_relacion_codigo: 'HIJO', nombre_familiar: '', es_miembro: false }]);
  }

  const idsMinisterios = value.ministerios ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>Familia</Label>
          <Button type="button" variant="outline" size="sm" onClick={agregarFamiliar} className="gap-1">
            <Plus className="h-3.5 w-3.5" />
            Agregar familiar
          </Button>
        </div>
        {otrosFamiliares.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin familiares agregados.</p>
        )}
        {otrosFamiliares.map((f, i) => (
          <FilaFamiliar
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            familiar={f}
            onChange={(nuevo) =>
              actualizarFamiliares(otrosFamiliares.map((x, idx) => (idx === i ? nuevo : x)))
            }
            onQuitar={() => actualizarFamiliares(otrosFamiliares.filter((_, idx) => idx !== i))}
          />
        ))}
      </div>

      {ministerios && ministerios.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label>Ministerios</Label>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {ministerios.map((m) => (
              <label key={m.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={idsMinisterios.includes(m.id)}
                  onCheckedChange={(v) =>
                    actualizarValor(
                      value,
                      onChange,
                      'ministerios',
                      v === true ? [...idsMinisterios, m.id] : idsMinisterios.filter((id) => id !== m.id)
                    )
                  }
                />
                {m.nombre}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
