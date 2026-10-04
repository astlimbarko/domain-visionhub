import { create } from 'zustand';

interface EventoActivoStore {
  eventoId: string | null;
  titulo: string | null;
  setEventoActivo: (eventoId: string | null, titulo?: string | null) => void;
  limpiar: () => void;
}

export const useEventoAfirmacionActivo = create<EventoActivoStore>((set) => ({
  eventoId: null,
  titulo: null,
  setEventoActivo: (eventoId, titulo = null) => set({ eventoId, titulo }),
  limpiar: () => set({ eventoId: null, titulo: null }),
}));
