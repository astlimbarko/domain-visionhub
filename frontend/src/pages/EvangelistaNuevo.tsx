import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import {
  DatosBasicosPersonaFields,
  DATOS_BASICOS_PERSONA_VACIO,
  datosBasicosPersonaValidos,
  type DatosBasicosPersonaValores,
} from '@/components/personas/DatosBasicosPersonaFields';
import { ConfirmarPosibleDuplicadoDialog } from '@/components/shared/ConfirmarPosibleDuplicadoDialog';
import { EvangelistaSubHeader } from '@/components/evangelista/EvangelistaSubHeader';
import { IndicadorBorrador } from '@/components/evangelista/IndicadorBorrador';
import { useAuthStore } from '@/store/auth.store';
import { useDebounce } from '@/hooks/useDebounce';
import { useBuscarPersonasSimilares } from '@/hooks/useCasasDePaz';
import { useRegistrarPersonaEvangelizada, useTiposEvangelismoPersonal } from '@/hooks/useEvangelistaPersonal';
import { componerTelefono } from '@/utils/paises-telefono';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/utils/constants';
import type { PersonaSimilar } from '@/types/casas-de-paz.types';

const CLAVE_BORRADOR = 'evangelista-borrador-nueva-persona';

interface Borrador {
  valores: DatosBasicosPersonaValores;
  tipoEvangelismoId: string;
}

function hayContenidoReal(valores: DatosBasicosPersonaValores, tipoEvangelismoId: string): boolean {
  return (
    valores.primerNombre.trim() !== '' ||
    valores.primerApellido.trim() !== '' ||
    valores.sexo !== '' ||
    valores.telefonoNumero.trim() !== '' ||
    valores.fechaNacimiento !== '' ||
    valores.direccion.trim() !== '' ||
    tipoEvangelismoId !== ''
  );
}

/**
 * KAN-430: alta de persona evangelizada desde el panel personal (boceto
 * `evangelismo2.jpeg`). Reusa `DatosBasicosPersonaFields` tal cual (mismo
 * set de campos que Altar de Afirmación, KAN-481) + un selector propio de
 * tipo de evangelismo. Borrador progresivo guardado en `localStorage`
 * (debounce 1500ms) -- a diferencia del borrador de Reportes.tsx (KAN-443,
 * tabla propia en el servidor), acá alcanza con guardado local: es un
 * formulario de una sola persona, de un solo dispositivo, pensado para no
 * perder los datos si el Evangelista se distrae a mitad de la carga, no
 * para continuar en otro dispositivo. El borrador NUNCA cuenta como
 * registro real (Requisito 5 AC5) -- nada se manda al backend hasta
 * "Guardar".
 */
export function EvangelistaNuevo() {
  const navigate = useNavigate();
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const [valores, setValores] = useState<DatosBasicosPersonaValores>(DATOS_BASICOS_PERSONA_VACIO);
  const [tipoEvangelismoId, setTipoEvangelismoId] = useState('');
  const [personaIdExistente, setPersonaIdExistente] = useState<string | undefined>(undefined);
  const { data: tipos = [], isLoading: cargandoTipos } = useTiposEvangelismoPersonal();
  const registrar = useRegistrarPersonaEvangelizada();

  // Hidratación del borrador -- una sola vez al montar.
  const hidratado = useRef(false);
  const [estadoBorrador, setEstadoBorrador] = useState<'inactivo' | 'guardando' | 'guardado'>('inactivo');
  const [mostrarIndicador, setMostrarIndicador] = useState(false);
  const ocultarIndicadorRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (hidratado.current) return;
    hidratado.current = true;
    try {
      const crudo = localStorage.getItem(CLAVE_BORRADOR);
      if (crudo) {
        const borrador = JSON.parse(crudo) as Borrador;
        setValores(borrador.valores);
        setTipoEvangelismoId(borrador.tipoEvangelismoId);
      }
    } catch {
      // Borrador corrupto -- se ignora, no bloquea el formulario.
    }
  }, []);

  useEffect(() => {
    if (!hidratado.current) return;
    if (!hayContenidoReal(valores, tipoEvangelismoId)) return;
    setEstadoBorrador('guardando');
    setMostrarIndicador(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        localStorage.setItem(CLAVE_BORRADOR, JSON.stringify({ valores, tipoEvangelismoId } satisfies Borrador));
      } catch {
        // Ignorado -- el borrador es una conveniencia, no algo crítico.
      }
      setEstadoBorrador('guardado');
      if (ocultarIndicadorRef.current) clearTimeout(ocultarIndicadorRef.current);
      ocultarIndicadorRef.current = setTimeout(() => setMostrarIndicador(false), 1600);
    }, 1500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valores, tipoEvangelismoId]);

  // KAN-407: mismo patrón de aviso de posible duplicado que ya usa
  // NuevoEvangelizadoDialog (CdP) -- debounced, se apaga hasta que se
  // vuelva a tocar algún campo de nombre.
  const primerNombreDebounced = useDebounce(valores.primerNombre);
  const segundoNombreDebounced = useDebounce(valores.segundoNombre);
  const primerApellidoDebounced = useDebounce(valores.primerApellido);
  const segundoApellidoDebounced = useDebounce(valores.segundoApellido);
  const { data: similares = [] } = useBuscarPersonasSimilares(
    iglesiaActivaId,
    {
      primer_nombre: primerNombreDebounced,
      segundo_nombre: segundoNombreDebounced,
      primer_apellido: primerApellidoDebounced,
      segundo_apellido: segundoApellidoDebounced,
    },
    !personaIdExistente
  );
  const [duplicadoDescartado, setDuplicadoDescartado] = useState(false);
  const [mostrarConfirmDuplicado, setMostrarConfirmDuplicado] = useState(false);
  useEffect(() => {
    setDuplicadoDescartado(false);
    setPersonaIdExistente(undefined);
  }, [valores.primerNombre, valores.segundoNombre, valores.primerApellido, valores.segundoApellido]);

  const formularioValido = datosBasicosPersonaValidos(valores) && !!tipoEvangelismoId;

  function limpiarBorrador() {
    try {
      localStorage.removeItem(CLAVE_BORRADOR);
    } catch {
      // Ignorado.
    }
  }

  async function guardar(personaId?: string) {
    try {
      await registrar.mutateAsync({
        persona_id: personaId,
        primer_nombre: valores.primerNombre,
        segundo_nombre: valores.segundoNombre || undefined,
        primer_apellido: valores.primerApellido,
        segundo_apellido: valores.segundoApellido || undefined,
        sexo: valores.sexo as 'M' | 'F',
        fecha_nacimiento: valores.fechaNacimiento || undefined,
        telefono: valores.telefonoNumero ? componerTelefono(valores.telefonoPais, valores.telefonoNumero) : undefined,
        domicilio: valores.direccion || undefined,
        tipo_evangelismo_id: tipoEvangelismoId,
      });
      limpiarBorrador();
      toast.success('Persona registrada');
      navigate(ROUTES.EVANGELISTA);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo registrar');
    }
  }

  function manejarGuardar() {
    if (!formularioValido) return;
    if (!duplicadoDescartado && similares.length > 0 && !personaIdExistente) {
      setMostrarConfirmDuplicado(true);
      return;
    }
    guardar(personaIdExistente);
  }

  function usarPersonaSimilar(persona: PersonaSimilar) {
    setPersonaIdExistente(persona.id);
    setDuplicadoDescartado(true);
    setMostrarConfirmDuplicado(false);
    guardar(persona.id);
  }

  return (
    <div className="flex flex-col gap-6">
      <EvangelistaSubHeader titulo="Nueva persona" />

      <div className="flex flex-col gap-6">
        <DatosBasicosPersonaFields valores={valores} onChange={setValores} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tipo_evangelismo">Tipo de evangelismo *</Label>
          <Select value={tipoEvangelismoId} onValueChange={setTipoEvangelismoId} disabled={cargandoTipos}>
            <SelectTrigger id="tipo_evangelismo" className={cn('w-full', CAMPO_ESTILO)}>
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {tipos.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          className="h-12 gap-2 rounded-2xl text-white"
          style={{ background: 'linear-gradient(135deg, #D9480F, #FF7A1A)' }}
          disabled={!formularioValido || registrar.isPending}
          onClick={manejarGuardar}
        >
          {registrar.isPending ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {registrar.isPending ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>

      <IndicadorBorrador mostrar={mostrarIndicador} estado={estadoBorrador === 'guardando' ? 'guardando' : 'guardado'} />

      <ConfirmarPosibleDuplicadoDialog
        open={mostrarConfirmDuplicado}
        onOpenChange={setMostrarConfirmDuplicado}
        candidatos={similares}
        nombreTentativo={[valores.primerNombre, valores.segundoNombre, valores.primerApellido, valores.segundoApellido].filter(Boolean).join(' ')}
        onUsarExistente={usarPersonaSimilar}
        onNoEsLaMisma={() => {
          setDuplicadoDescartado(true);
          setMostrarConfirmDuplicado(false);
          guardar();
        }}
      />
    </div>
  );
}
