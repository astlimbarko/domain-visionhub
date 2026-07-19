import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { IglesiaAccesible } from '../types/auth.types';
import type { InvitacionPendiente } from '../types/invitacion-lider.types';

interface AuthState {
  isAuthenticated: boolean;
  personaId: string | null;
  nombreCompleto: string | null;
  correo: string | null;
  iglesias: IglesiaAccesible[];
  iglesiaActivaId: string | null;
  esSuperAdmin: boolean;
  membresiaPendiente: InvitacionPendiente | null;
  setSesion: (data: {
    personaId: string | null;
    nombreCompleto: string | null;
    correo: string | null;
    iglesias: IglesiaAccesible[];
    esSuperAdmin: boolean;
    membresiaPendiente?: InvitacionPendiente | null;
  }) => void;
  setIglesiaActiva: (iglesiaId: string) => void;
  renombrarIglesiaLocal: (iglesiaId: string, nombre: string) => void;
  completarMembresiaLocal: (personaId: string, nombreCompleto: string) => void;
  logout: () => void;
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
          iglesiaActivaId: iglesiaActualSigueValida ? get().iglesiaActivaId : (iglesias[0]?.id ?? null),
        });
      },

      setIglesiaActiva: (iglesiaId) => set({ iglesiaActivaId: iglesiaId }),

      renombrarIglesiaLocal: (iglesiaId, nombre) =>
        set({
          iglesias: get().iglesias.map((i) => (i.id === iglesiaId ? { ...i, nombre } : i)),
        }),

      completarMembresiaLocal: (personaId, nombreCompleto) =>
        set({ personaId, nombreCompleto, membresiaPendiente: null }),

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
      }),
    }
  )
);
