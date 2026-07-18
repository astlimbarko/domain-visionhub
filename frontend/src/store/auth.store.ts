import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { IglesiaAccesible } from '../types/auth.types';

interface AuthState {
  isAuthenticated: boolean;
  personaId: string | null;
  nombreCompleto: string | null;
  iglesias: IglesiaAccesible[];
  iglesiaActivaId: string | null;
  setSesion: (data: { personaId: string | null; nombreCompleto: string | null; iglesias: IglesiaAccesible[] }) => void;
  setIglesiaActiva: (iglesiaId: string) => void;
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

      setSesion: ({ personaId, nombreCompleto, iglesias }) => {
        const iglesiaActualSigueValida = iglesias.some((i) => i.id === get().iglesiaActivaId);
        set({
          isAuthenticated: true,
          personaId,
          nombreCompleto,
          iglesias,
          iglesiaActivaId: iglesiaActualSigueValida ? get().iglesiaActivaId : (iglesias[0]?.id ?? null),
        });
      },

      setIglesiaActiva: (iglesiaId) => set({ iglesiaActivaId: iglesiaId }),

      logout: () =>
        set({
          isAuthenticated: false,
          personaId: null,
          nombreCompleto: null,
          iglesias: [],
          iglesiaActivaId: null,
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
      }),
    }
  )
);
