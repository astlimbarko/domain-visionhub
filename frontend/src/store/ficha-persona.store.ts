import { create } from 'zustand';

interface FichaPersonaState {
  personaId: string | undefined;
  abrir: (personaId: string) => void;
  cerrar: () => void;
}

/**
 * Estado global para el sheet de "Vínculos de perfil": cualquier nombre de
 * persona en el sistema debe abrir su ficha detallada (FichaPersonaSheet),
 * sin que cada página tenga que cargar su propia instancia del sheet. El
 * sheet se monta una sola vez en App.tsx.
 */
export const useFichaPersonaStore = create<FichaPersonaState>((set) => ({
  personaId: undefined,
  abrir: (personaId) => set({ personaId }),
  cerrar: () => set({ personaId: undefined }),
}));
