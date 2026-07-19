import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { IglesiaAccesible } from '../types/auth.types';

interface AuthState {
  isAuthenticated: boolean;
  personaId: string | null;
  nombreCompleto: string | null;
  iglesias: IglesiaAccesible[];
  iglesiaActivaId: string | null;
  esSuperAdmin: boolean;
  setSesion: (data: {
    personaId: string | null;
    nombreCompleto: string | null;
    iglesias: IglesiaAccesible[];
    esSuperAdmin: boolean;
  }) => void;
  setIglesiaActiva: (iglesiaId: string) => void;
  renombrarIglesiaLocal: (iglesiaId: string, nombre: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      personaId: null,
      nombreCompleto: null,
      iglesias: [],
      iglesiaActivaId: null,
      esSuperAdmin: false,

      setSesion: ({ personaId, nombreCompleto, iglesias, esSuperAdmin }) => {
        const iglesiaActualSigueValida = iglesias.some((i) => i.id === get().iglesiaActivaId);
        set({
          isAuthenticated: true,
          personaId,
          nombreCompleto,
          iglesias,
          esSuperAdmin,
          iglesiaActivaId: iglesiaActualSigueValida ? get().iglesiaActivaId : (iglesias[0]?.id ?? null),
        });
      },

      setIglesiaActiva: (iglesiaId) => set({ iglesiaActivaId: iglesiaId }),

      renombrarIglesiaLocal: (iglesiaId, nombre) =>
        set({
          iglesias: get().iglesias.map((i) => (i.id === iglesiaId ? { ...i, nombre } : i)),
        }),

      logout: () =>
        set({
          isAuthenticated: false,
          personaId: null,
          nombreCompleto: null,
          iglesias: [],
          iglesiaActivaId: null,
          esSuperAdmin: false,
        }),
    }),
    {
      name: 'visionhub-auth',
      partialize: (state) => ({
        personaId: state.personaId,
        nombreCompleto: state.nombreCompleto,
        iglesias: state.iglesias,
        iglesiaActivaId: state.iglesiaActivaId,
        isAuthenticated: state.isAuthenticated,
        esSuperAdmin: state.esSuperAdmin,
      }),
    }
  )
);
