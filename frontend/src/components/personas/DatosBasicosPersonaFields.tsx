// KAN-481 seguimiento: set de campos minimo para dar de alta una persona
// desde flujos rapidos de campo (Altar, y a futuro RSIL/Fiesta de
// Bienvenida/Membresia-Bautismo) -- nombre/apellido, telefono con prefijo
// de pais, sexo, fecha de nacimiento y direccion en texto libre. No sabe
// nada del proceso que lo usa (Altar, etc.) a proposito, para poder
// reusarlo sin acoplarlo.
//
// A diferencia de CrearPersonaDialog (Directorio general, CI/correo/
// ministerio, sin telefono ni direccion) este componente cubre justo los
// campos que pide el boceto de campo: nombre completo + como contactar/
// ubicar a la persona. CI/correo/ministerio se completan despues, desde la
// ficha completa -- mismo criterio de "completado progresivo" que ya usa
// el resto del sistema.
import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { normalizarNombre } from '@/utils/normalizarNombre';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PAISES_TELEFONO } from '@/utils/paises-telefono';
import type { Sexo } from '@/types/persona.types';

export interface DatosBasicosPersonaValores {
  primerNombre: string;
  segundoNombre: string;
  primerApellido: string;
  segundoApellido: string;
  telefonoPais: string;
  telefonoNumero: string;
  // KAN (UX 2026-10-02): si la persona no tiene celular, se marca este check
  // y el número queda vacío/deshabilitado -- así un teléfono vacío es una
  // respuesta explícita ("no tiene"), no un campo obligatorio sin contestar.
  sinCelular: boolean;
  sexo: Sexo | '';
  fechaNacimiento: string;
  direccion: string;
}

export const DATOS_BASICOS_PERSONA_VACIO: DatosBasicosPersonaValores = {
  primerNombre: '',
  segundoNombre: '',
  primerApellido: '',
  segundoApellido: '',
  telefonoPais: '+591',
  telefonoNumero: '',
  sinCelular: false,
  sexo: '',
  fechaNacimiento: '',
  direccion: '',
};

export function datosBasicosPersonaValidos(v: DatosBasicosPersonaValores): boolean {
  return v.primerNombre.trim() !== '' && v.primerApellido.trim() !== '' && v.sexo !== '';
}

interface Props {
  valores: DatosBasicosPersonaValores;
  onChange: (valores: DatosBasicosPersonaValores) => void;
  // UX 2026-10-02 (Membresía desde 0): marca con * teléfono, fecha de
  // nacimiento y dirección. Las puertas rápidas (Altar/Bautismo/RSIL) no lo
  // activan -- ahí esos datos siguen siendo opcionales (completado progresivo).
  marcarObligatorios?: boolean;
}

export function DatosBasicosPersonaFields({ valores, onChange, marcarObligatorios = false }: Props) {
  const req = marcarObligatorios ? ' *' : '';
  // ¿El código de país actual es uno de la lista corta? Si no, estamos en modo
  // "Otro país" (prefijo libre) -- KAN-490/UX: permitir cualquier país.
  const paisConocido = PAISES_TELEFONO.some((p) => p.codigo === valores.telefonoPais);

  function set<K extends keyof DatosBasicosPersonaValores>(campo: K, valor: DatosBasicosPersonaValores[K]) {
    onChange({ ...valores, [campo]: valor });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dbp_primer_nombre">Primer nombre *</Label>
        <Input
          id="dbp_primer_nombre"
          className={CAMPO_ESTILO}
          placeholder="Ingrese el primer nombre"
          value={valores.primerNombre}
          onChange={(e) => set('primerNombre', e.target.value)}
          onBlur={(e) => set('primerNombre', normalizarNombre(e.target.value, true))}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dbp_segundo_nombre">Segundo nombre</Label>
        <Input
          id="dbp_segundo_nombre"
          className={CAMPO_ESTILO}
          placeholder="Ingrese el segundo nombre"
          value={valores.segundoNombre}
          onChange={(e) => set('segundoNombre', e.target.value)}
          onBlur={(e) => set('segundoNombre', normalizarNombre(e.target.value))}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dbp_primer_apellido">Primer apellido *</Label>
        <Input
          id="dbp_primer_apellido"
          className={CAMPO_ESTILO}
          placeholder="Ingrese el primer apellido"
          value={valores.primerApellido}
          onChange={(e) => set('primerApellido', e.target.value)}
          onBlur={(e) => set('primerApellido', normalizarNombre(e.target.value))}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dbp_segundo_apellido">Segundo apellido</Label>
        <Input
          id="dbp_segundo_apellido"
          className={CAMPO_ESTILO}
          placeholder="Ingrese el segundo apellido"
          value={valores.segundoApellido}
          onChange={(e) => set('segundoApellido', e.target.value)}
          onBlur={(e) => set('segundoApellido', normalizarNombre(e.target.value))}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dbp_telefono_numero">Teléfono{valores.sinCelular ? '' : req}</Label>
        <div className="flex gap-2">
          <Select
            value={paisConocido ? valores.telefonoPais : 'OTRO'}
            onValueChange={(v) => set('telefonoPais', v === 'OTRO' ? '' : v)}
            disabled={valores.sinCelular}
          >
            <SelectTrigger className={cn('w-24 shrink-0 sm:w-28', CAMPO_ESTILO)}>
              <SelectValue>
                {paisConocido ? (
                  <>
                    <span className={cn('fi', `fi-${PAISES_TELEFONO.find((p) => p.codigo === valores.telefonoPais)?.iso ?? 'bo'}`, 'mr-1 shrink-0 rounded-[2px]')} />
                    {valores.telefonoPais}
                  </>
                ) : (
                  <span className="flex items-center gap-1"><Globe className="h-3.5 w-3.5" /> Otro</span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PAISES_TELEFONO.map((p) => (
                <SelectItem key={p.codigo} value={p.codigo}>
                  <span className={cn('fi', `fi-${p.iso}`, 'mr-1 shrink-0 rounded-[2px]')} />
                  {p.codigo}
                  <span className="ml-1.5 text-muted-foreground">{p.nombre}</span>
                </SelectItem>
              ))}
              <SelectItem value="OTRO">
                <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> Otro país</span>
              </SelectItem>
            </SelectContent>
          </Select>
          {!paisConocido && !valores.sinCelular && (
            <Input
              inputMode="tel"
              placeholder="+971"
              aria-label="Código de país"
              className={cn('w-20 shrink-0', CAMPO_ESTILO)}
              value={valores.telefonoPais}
              onChange={(e) => set('telefonoPais', e.target.value.replace(/[^\d+]/g, ''))}
            />
          )}
          <Input
            id="dbp_telefono_numero"
            inputMode="numeric"
            placeholder={valores.sinCelular ? 'Sin celular' : '70000000'}
            className={cn('min-w-0 flex-1', CAMPO_ESTILO)}
            value={valores.telefonoNumero}
            onChange={(e) => set('telefonoNumero', e.target.value.replace(/\D/g, ''))}
            disabled={valores.sinCelular}
          />
        </div>
        <label className="flex items-center gap-2 pt-0.5 text-xs text-muted-foreground">
          <Checkbox
            checked={valores.sinCelular}
            onCheckedChange={(v) => {
              const marcado = v === true;
              // Al marcar "no tiene celular" se limpia el número para que no
              // quede un dato viejo oculto detrás del check deshabilitado.
              onChange({ ...valores, sinCelular: marcado, telefonoNumero: marcado ? '' : valores.telefonoNumero });
            }}
          />
          No tiene celular
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dbp_sexo">Sexo *</Label>
        <Select value={valores.sexo} onValueChange={(v) => set('sexo', v as Sexo)}>
          <SelectTrigger id="dbp_sexo" className={cn('w-full', CAMPO_ESTILO)}>
            <SelectValue placeholder="Seleccionar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="M">Masculino</SelectItem>
            <SelectItem value="F">Femenino</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dbp_fecha_nacimiento">Fecha de nacimiento{req}</Label>
        <Input
          id="dbp_fecha_nacimiento"
          type="date"
          max={new Date().toISOString().slice(0, 10)}
          className={CAMPO_ESTILO}
          value={valores.fechaNacimiento}
          onChange={(e) => set('fechaNacimiento', e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dbp_direccion">Dirección{req}</Label>
        <Textarea
          id="dbp_direccion"
          placeholder="Ingrese la dirección"
          className={CAMPO_ESTILO}
          rows={3}
          value={valores.direccion}
          onChange={(e) => set('direccion', e.target.value)}
        />
      </div>
    </div>
  );
}
