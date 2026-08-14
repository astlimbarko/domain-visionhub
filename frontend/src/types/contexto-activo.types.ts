import type { RolUI } from '@/utils/permisos';

interface ContextoBase<Rol extends RolUI, Alcance extends string> {
  /** Identificador estable de la asignación seleccionada. */
  clave: string;
  rolUI: Rol;
  alcance: Alcance;
}

export type ContextoActivo =
  | ContextoBase<'SUPER_ADMIN', 'GLOBAL'>
  | (ContextoBase<'PASTOR', 'IGLESIA'> & { iglesiaId: string })
  | (ContextoBase<'SUPERVISOR', 'IGLESIA'> & { iglesiaId: string })
  | (ContextoBase<'LIDER_DEPARTAMENTO', 'DEPARTAMENTO'> & {
      iglesiaId: string;
      /** El RPC de sesión todavía no expone el UUID; se conserva el código estable. */
      departamentoId: string | null;
      departamentoCodigo: 'AFIRMACION';
    })
  | (ContextoBase<'LIDER_RED', 'RED'> & {
      iglesiaId: string;
      redId: string;
      /** Ambos cargos comparten permisos y panel, pero conservan identidad visual propia. */
      cargoRed: 'LIDER' | 'SUPERVISOR';
    })
  | (ContextoBase<'LIDER_CDP' | 'SUBLIDER_CDP', 'CDP'> & {
      iglesiaId: string;
      redId: string | null;
      cdpId: string;
    })
  | (ContextoBase<'LIDER_JOVENES', 'IGLESIA'> & { iglesiaId: string })
  | (ContextoBase<'ENCARGADO_MATRIMONIOS', 'IGLESIA'> & { iglesiaId: string });

export function contextoPerteneceAIglesia(
  contexto: ContextoActivo,
  iglesiaId: string | null,
): boolean {
  return contexto.alcance === 'GLOBAL' || contexto.iglesiaId === iglesiaId;
}

