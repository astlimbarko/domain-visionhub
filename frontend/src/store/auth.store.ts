import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { IglesiaAccesible } from '../types/auth.types';
import type { ContextoActivo } from '../types/contexto-activo.types';
import type { ActualizacionMembresiaPendiente, MembresiaIncompleta } from '../types/membresia-extendida.types';
import type { RolUI } from '../utils/permisos';

interface AuthState {
  isAuthenticated: boolean;
  personaId: string | null;
  nombreCompleto: string | null;
  correo: string | null;
  iglesias: IglesiaAccesible[];
  iglesiaActivaId: string | null;
  esSuperAdmin: boolean;
  membresiaPendiente: MembresiaIncompleta | null;
  /** KAN-252 Parte B: persona con membresía ya completada a la que le falta
   * teléfono y/o ministerio (datos que no existían cuando completó su
   * ficha). Independiente de membresiaPendiente -- no bloquea el panel. */
  actualizacionMembresiaPendiente: ActualizacionMembresiaPendiente | null;
  /** KAN-278: cuenta con una contraseña temporal puesta por un admin -- no
   * se persiste a propósito (a diferencia de membresiaPendiente), se
   * re-chequea en cada carga de PrivateLayout igual que
   * actualizacionMembresiaPendiente, así una recarga de página no lo "pierde". */
  debeCambiarContrasena: boolean;
  /** Compatibilidad temporal; la fuente canónica nueva es contextoActivo. */
  rolActivo: RolUI | null;
  contextoActivo: ContextoActivo | null;
  setSesion: (data: {
    personaId: string | null;
    nombreCompleto: string | null;
    correo: string | null;
    iglesias: IglesiaAccesible[];
    esSuperAdmin: boolean;
    membresiaPendiente?: MembresiaIncompleta | null;
    debeCambiarContrasena?: boolean;
  }) => void;
  setIglesiaActiva: (iglesiaId: string) => void;
  setRolActivo: (rol: RolUI | null) => void;
  setContextoActivo: (contexto: ContextoActivo | null) => void;
  renombrarIglesiaLocal: (iglesiaId: string, nombre: string) => void;
  completarMembresiaLocal: (personaId: string, nombreCompleto: string) => void;
  /** KAN-126: "Saltar por ahora" (solo caso general, id===null) -- limpia el
   * gate SOLO local/en memoria, sin tocar el backend. El próximo login vuelve
   * a pedirlo (setSesion repuebla membresiaPendiente desde fn_mi_membresia_incompleta
   * de nuevo) hasta que la persona realmente complete su ficha. */
  saltarMembresiaLocal: () => void;
  /** KAN-179 (seguimiento): re-chequeo al cambiar de rol activo -- a
   * diferencia de setSesion, esto no toca ningún otro campo de la sesión. */
  setMembresiaPendiente: (m: MembresiaIncompleta | null) => void;
  setActualizacionMembresiaPendiente: (a: ActualizacionMembresiaPendiente | null) => void;
  /** "Ahora no" del modal de Parte B -- limpia solo local/en memoria, igual
   * que saltarMembresiaLocal. Reaparece en el próximo login si sigue faltando. */
  saltarActualizacionMembresiaLocal: () => void;
  setDebeCambiarContrasena: (v: boolean) => void;
  /** "Ahora no" del modal de contraseña temporal -- limpia solo local/en
   * memoria; reaparece en la próxima carga de PrivateLayout si el flag real
   * (app_metadata) sigue prendido. */
  saltarCambioContrasenaLocal: () => void;
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
      actualizacionMembresiaPendiente: null,
      debeCambiarContrasena: false,
      rolActivo: null,
      contextoActivo: null,

      setSesion: ({ personaId, nombreCompleto, correo, iglesias, esSuperAdmin, membresiaPendiente = null, debeCambiarContrasena = false }) => {
        const estadoActual = get();
        const iglesiaActualSigueValida = iglesias.some((i) => i.id === estadoActual.iglesiaActivaId);
        const iglesiaActivaId = iglesiaActualSigueValida
          ? estadoActual.iglesiaActivaId
          : elegirIglesiaPorDefecto(iglesias);
        // KAN-152: `setSesion` solo se llama tras un login real (Login,
        // AuthCallback, CompletarCuenta) -- nunca al resumir una sesion ya
        // abierta (eso lo maneja el propio store persistido, sin volver a
        // llamar setSesion). Antes, si la persona coincidia, se reusaba el
        // `contextoActivo` de la sesion anterior siempre que siguiera siendo
        // valido -- un usuario con roles en mas de una iglesia (ej. Super
        // Admin + Supervisor en otra iglesia) volvia a entrar SIEMPRE con el
        // mismo rol de la ultima vez, sin poder elegir otro contexto en un
        // login nuevo. Se limpia siempre en cada login real; si solo hay un
        // contexto posible, `useContextoActivo` lo autoselecciona igual (sin
        // cambio de comportamiento en ese caso); si hay mas de uno, ahora se
        // fuerza pasar por el selector de rol en cada login.
        set({
          isAuthenticated: true,
          personaId,
          nombreCompleto,
          correo,
          iglesias,
          esSuperAdmin,
          membresiaPendiente,
          debeCambiarContrasena,
          iglesiaActivaId,
          contextoActivo: null,
          rolActivo: null,
        });
      },

      setIglesiaActiva: (iglesiaId) => set({ iglesiaActivaId: iglesiaId, rolActivo: null, contextoActivo: null }),

      setRolActivo: (rol) => set({ rolActivo: rol, contextoActivo: null }),

      setContextoActivo: (contexto) => set({
        contextoActivo: contexto,
        rolActivo: contexto?.rolUI ?? null,
      }),

      renombrarIglesiaLocal: (iglesiaId, nombre) =>
        set({
          iglesias: get().iglesias.map((i) => (i.id === iglesiaId ? { ...i, nombre } : i)),
        }),

      completarMembresiaLocal: (personaId, nombreCompleto) =>
        set({ personaId, nombreCompleto, membresiaPendiente: null }),

      saltarMembresiaLocal: () => set({ membresiaPendiente: null }),

      setMembresiaPendiente: (m) => set({ membresiaPendiente: m }),

      setActualizacionMembresiaPendiente: (a) => set({ actualizacionMembresiaPendiente: a }),

      saltarActualizacionMembresiaLocal: () => set({ actualizacionMembresiaPendiente: null }),

      setDebeCambiarContrasena: (v) => set({ debeCambiarContrasena: v }),

      saltarCambioContrasenaLocal: () => set({ debeCambiarContrasena: false }),

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
          actualizacionMembresiaPendiente: null,
          debeCambiarContrasena: false,
          rolActivo: null,
          contextoActivo: null,
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
        contextoActivo: state.contextoActivo,
      }),
    }
  )
);
