import { Eye, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { useSoloLectura } from '@/hooks/useSoloLectura';
import { useContextoActivo } from '@/hooks/useContextoActivo';
import { rutaEstructuraOrganizacional } from '@/utils/constants';
import { AMBAR } from '@/components/dashboard/DashboardUI';

/**
 * KAN-339: banner fijo "Modo lectura" -- se muestra en TODAS las pantallas
 * mientras el Super Admin esté navegando un Departamento vía "Visualizar"
 * (contexto sintético soloLectura). Un solo componente reusado (pedido del
 * diseño técnico §12.4, "un solo componente chico reusado en ambos
 * departamentos, no duplicado") -- se monta una vez en PrivateLayout, no por
 * página.
 */
export function BannerModoLectura() {
  const soloLectura = useSoloLectura();
  const { contextoActivo } = useContextoActivo();
  const setContextoActivo = useAuthStore((s) => s.setContextoActivo);
  const navigate = useNavigate();

  if (!soloLectura || !contextoActivo || contextoActivo.rolUI !== 'LIDER_DEPARTAMENTO') return null;

  function volver() {
    const iglesiaId = contextoActivo && 'iglesiaId' in contextoActivo ? contextoActivo.iglesiaId : null;
    setContextoActivo(null);
    navigate(iglesiaId ? rutaEstructuraOrganizacional(iglesiaId) : '/administracion', { replace: true });
  }

  return (
    <div
      className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm shadow-sm"
      style={{ borderColor: `color-mix(in oklab, ${AMBAR} 35%, transparent)`, background: `color-mix(in oklab, ${AMBAR} 10%, white)` }}
    >
      <span className="flex items-center gap-2 font-semibold" style={{ color: '#8a5a00' }}>
        <Eye className="h-4 w-4" />
        Modo lectura -- estás viendo este departamento como Super Admin, sin poder editar nada.
      </span>
      <button
        type="button"
        onClick={volver}
        className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver al Constructor
      </button>
    </div>
  );
}
