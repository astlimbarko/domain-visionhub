import { create } from 'zustand';

interface FichaPersonaState {
  personaId: string | undefined;
  /** KAN-497 paso 9: true cuando la ficha se abre desde una fila que el
   * propio viewer ya tiene permiso de ver en su pestaña "Datos"/"Registro"
   * (Altar/Bautismo/RSIL/Membresía) -- el backend de esas listas ya filtra
   * para que un colaborador solo vea lo que él mismo registró (Afirmación
   * ve todo). Si la fila es visible ahí, es "suya" para editar -- habilita
   * el botón "Editar" aunque no sea operativo/líder de Red/la propia
   * persona (los únicos casos que ya contemplaba FichaPersonaSheet). */
  permitirEdicionExtra: boolean;
  abrir: (personaId: string, opts?: { permitirEdicionExtra?: boolean }) => void;
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
  permitirEdicionExtra: false,
  abrir: (personaId, opts) => set({ personaId, permitirEdicionExtra: opts?.permitirEdicionExtra ?? false }),
  cerrar: () => set({ personaId: undefined, permitirEdicionExtra: false }),
}));
