import { useContextoActivo } from '@/hooks/useContextoActivo';

/**
 * KAN-339: true solo cuando el Super Admin está navegando un Departamento
 * (Afirmación/Evangelismo) en modo "Visualizar" (contexto sintético, ver
 * contexto-activo.types.ts). Un Líder de Departamento real nunca tiene
 * `soloLectura` en su contexto -- construirContextosDisponibles() no lo
 * agrega.
 *
 * Esto es solo para la experiencia visual (ocultar botones de escritura,
 * mostrar el banner "Modo lectura"): la barrera de seguridad real vive en
 * el backend (las RPC de escritura de Afirmación/Evangelismo nunca suman
 * fn_es_super_admin() a su chequeo de acceso).
 */
export function useSoloLectura(): boolean {
  const { contextoActivo } = useContextoActivo();
  return contextoActivo?.rolUI === 'LIDER_DEPARTAMENTO' && contextoActivo.soloLectura === true;
}
