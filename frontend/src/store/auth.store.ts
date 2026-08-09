import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { IglesiaAccesible } from '../types/auth.types';
import type { MembresiaIncompleta } from '../types/membresia-extendida.types';
import type { RolUI } from '../utils/permisos';

interface AuthState {
  isAuthenticated: boolean;
  personaId: string | null;
  nombreCompleto: string | null;
  correo: string | null;
  iglesias: IglesiaAccesible[];
  iglesiaActivaId: string | null;
  esSuperAdmin: boolean;
  // KAN-126 (autorizado explícitamente por Matías en chat, 2026-08-09):
  // MembresiaIncompleta es superset de la vieja InvitacionPendiente --
  // fn_mi_membresia_incompleta delega en fn_mi_invitacion_pendiente primero,
  // así que el caso de invitación sigue funcionando igual que antes.
  membresiaPendiente: MembresiaIncompleta | null;
  /** Rol elegido en /seleccionar-rol cuando el usuario tiene más de un sombrero en la iglesia activa. */
  rolActivo: RolUI | null;
  setSesion: (data: {
    personaId: string | null;
    nombreCompleto: string | null;
    correo: string | null;
    iglesias: IglesiaAccesible[];
    esSuperAdmin: boolean;
    membresiaPendiente?: MembresiaIncompleta | null;
  }) => void;
  setIglesiaActiva: (iglesiaId: string) => void;
  setRolActivo: (rol: RolUI | null) => void;
  renombrarIglesiaLocal: (iglesiaId: string, nombre: string) => void;
  completarMembresiaLocal: (personaId: string, nombreCompleto: string) => void;
  /** KAN-126: botón "Saltar" del caso general (sin invitación asociada) --
   * entra al sistema sin completar, pero solo por esta sesión: el próximo
   * login vuelve a pedirlo (setSesion repuebla membresiaPendiente desde el
   * servidor). No se usa para el caso de invitación, que sigue siendo
   * obligatorio como hasta ahora. */
  saltarMembresiaLocal: () => void;
  logout: () => void;
}

// Iglesia por default al loguearse: preferimos una donde el usuario tenga
// un rol operativo real (Pastor/Supervisor/Líder de Afirmación) antes que
// la primera de la lista sin más -- para un Super Admin, esa lista incluye
// TODAS las iglesias del sistema, y la primera alfabéticamente puede ser
// una donde no tiene ningún otro rol. Si eso pasa, `useOpcionesRol` no
// encuentra ambigüedad ahí y el usuario nunca ve el selector multi-rol,
// aunque sí tenga varios roles en otra iglesia (KAN-67).
function elegirIglesiaPorDefecto(iglesias: IglesiaAccesible[]): string | null {
  const conRolOperativo = iglesias.find((i) => i.es_pastor || i.es_operativo || i.es_lider_afirmacion);
  return (conRolOperativo ?? iglesias[0])?.id ?? null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      personaId: null,
      nombreCompleto: null,
      correo: null,
      iglesias: [],
      iglesiaActivaId: null,
      esSuperAdmin: false,
      membresiaPendiente: null,
      rolActivo: null,

      setSesion: ({ personaId, nombreCompleto, correo, iglesias, esSuperAdmin, membresiaPendiente = null }) => {
        const iglesiaActualSigueValida = iglesias.some((i) => i.id === get().iglesiaActivaId);
        set({
          isAuthenticated: true,
          personaId,
          nombreCompleto,
          correo,
          iglesias,
          esSuperAdmin,
          membresiaPendiente,
          iglesiaActivaId: iglesiaActualSigueValida ? get().iglesiaActivaId : elegirIglesiaPorDefecto(iglesias),
          // Cada login nuevo re-obliga a elegir rol si hay ambigüedad.
          rolActivo: null,
        });
      },

      setIglesiaActiva: (iglesiaId) => set({ iglesiaActivaId: iglesiaId, rolActivo: null }),

      setRolActivo: (rol) => set({ rolActivo: rol }),

      renombrarIglesiaLocal: (iglesiaId, nombre) =>
        set({
          iglesias: get().iglesias.map((i) => (i.id === iglesiaId ? { ...i, nombre } : i)),
        }),

      completarMembresiaLocal: (personaId, nombreCompleto) =>
        set({ personaId, nombreCompleto, membresiaPendiente: null }),

      saltarMembresiaLocal: () => set({ membresiaPendiente: null }),

      logout: () =>
        set({
          isAuthenticated: false,
          personaId: null,
          nombreCompleto: null,
          correo: null,
          iglesias: [],
          iglesiaActivaId: null,
          esSuperAdmin: false,
          membresiaPendiente: null,
          rolActivo: null,
        }),
    }),
    {
      name: 'visionhub-auth',
      partialize: (state) => ({
        personaId: state.personaId,
        nombreCompleto: state.nombreCompleto,
        correo: state.correo,
        iglesias: state.iglesias,
        iglesiaActivaId: state.iglesiaActivaId,
        isAuthenticated: state.isAuthenticated,
        esSuperAdmin: state.esSuperAdmin,
        membresiaPendiente: state.membresiaPendiente,
        rolActivo: state.rolActivo,
      }),
    }
  )
);
