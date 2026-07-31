import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/auth.store';
import { useUsuarios, useInvitarUsuario, useAsignarUsuarioExistente, useBuscarCuentas } from '@/hooks/useAdmin';
import { cerrarSesion } from '@/services/auth.service';
import { ROUTES } from '@/utils/constants';
import type { CuentaBusqueda } from '@/types/admin.types';

/**
 * Panel mínimo del Pastor (15-gestion-administrativa, Panel 4 -- adelanto
 * 2026-07-31): solo la funcionalidad de crear/asignar a su Supervisor de la
 * Visión en Acción (REQ-PA-1). Sin dashboard, sin sidebar, sin estética --
 * pedido explícito del owner para agilizar hoy; la pantalla real (AppShell,
 * navegación, etc.) queda pendiente para una sesión posterior.
 */
export function PastorGestion() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const nombreCompleto = useAuthStore((s) => s.nombreCompleto);
  const correoSesion = useAuthStore((s) => s.correo);
  const iglesias = useAuthStore((s) => s.iglesias);
  const logout = useAuthStore((s) => s.logout);

  const iglesiasPastor = iglesias.filter((i) => i.es_pastor);
  const [iglesiaId, setIglesiaId] = useState(iglesiasPastor[0]?.id ?? '');
  const iglesiaActiva = iglesiasPastor.find((i) => i.id === iglesiaId) ?? iglesiasPastor[0];

  const { data: usuarios = [] } = useUsuarios(iglesiaActiva?.id);
  const invitarUsuario = useInvitarUsuario();
  const asignarExistente = useAsignarUsuarioExistente();

  const [modo, setModo] = useState<'buscar' | 'invitar'>('buscar');
  const [correo, setCorreo] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [elegido, setElegido] = useState<CuentaBusqueda | null>(null);
  const { data: resultados = [] } = useBuscarCuentas(modo === 'buscar' ? busqueda : '');

  if (!isAuthenticated) return <Navigate to={ROUTES.LOGIN} replace />;

  if (iglesiasPastor.length === 0) {
    return (
      <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
        <p>Esta cuenta no es Pastor de ninguna iglesia.</p>
      </div>
    );
  }

  const supervisorActual = usuarios.find((u) => u.rol === 'SUPERVISOR_VISION_ACCION' && u.iglesia_id === iglesiaActiva?.id);

  async function handleAsignar() {
    if (!iglesiaActiva) return;
    try {
      if (modo === 'buscar') {
        if (!elegido) return;
        await asignarExistente.mutateAsync({ usuarioId: elegido.usuario_id, rol: 'SUPERVISOR_VISION_ACCION', iglesiaId: iglesiaActiva.id });
        toast.success('Supervisor asignado');
      } else {
        if (!correo.trim().includes('@')) return;
        const resultado = await invitarUsuario.mutateAsync({ correo: correo.trim().toLowerCase(), rol: 'SUPERVISOR_VISION_ACCION', iglesiaId: iglesiaActiva.id });
        if (resultado.error) {
          toast.warning(resultado.error);
        } else {
          toast.success(`Invitación enviada a ${correo}`);
        }
      }
      setCorreo('');
      setBusqueda('');
      setElegido(null);
    } catch (e) {
      const mensaje = (e as { message?: string })?.message ?? 'No se pudo asignar el Supervisor';
      toast.error(mensaje);
    }
  }

  const procesando = invitarUsuario.isPending || asignarExistente.isPending;
  const idElegido: string | undefined = elegido?.usuario_id;
  const resultadosFiltrados = resultados.filter((u) => u.usuario_id !== idElegido);

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 24, fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Panel del Pastor (básico)</h1>
          <p style={{ fontSize: 12, color: '#888', margin: '2px 0 0' }}>{nombreCompleto ?? correoSesion}</p>
        </div>
        <button
          type="button"
          onClick={async () => { await cerrarSesion(); logout(); }}
          style={{ fontSize: 12, color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Salir
        </button>
      </div>

      {iglesiasPastor.length > 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label>Iglesia</Label>
          <select value={iglesiaId} onChange={(e) => setIglesiaId(e.target.value)} style={{ padding: 8, borderRadius: 6 }}>
            {iglesiasPastor.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
        <p style={{ fontSize: 13, margin: 0 }}>
          <strong>{iglesiaActiva?.nombre}</strong>
        </p>
        <p style={{ fontSize: 13, margin: '4px 0 0' }}>
          Supervisor actual: {supervisorActual ? supervisorActual.correo : 'ninguno todavía'}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Label>Asignar Supervisor de la Visión en Acción</Label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => { setModo('buscar'); setCorreo(''); }}
            style={{ flex: 1, padding: 8, borderRadius: 6, border: modo === 'buscar' ? '2px solid #333' : '1px solid #ccc' }}
          >
            Buscar existente
          </button>
          <button
            type="button"
            onClick={() => { setModo('invitar'); setBusqueda(''); setElegido(null); }}
            style={{ flex: 1, padding: 8, borderRadius: 6, border: modo === 'invitar' ? '2px solid #333' : '1px solid #ccc' }}
          >
            Invitar por correo
          </button>
        </div>

        {modo === 'buscar' ? (
          elegido ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 8, border: '1px solid #ddd', borderRadius: 6 }}>
              <span>{elegido.correo}</span>
              <button type="button" onClick={() => setElegido(null)}>
                Cambiar
              </button>
            </div>
          ) : (
            <>
              <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscá por correo (cuenta ya existente)" />
              {resultadosFiltrados.map((u) => (
                <button
                  key={u.usuario_id}
                  type="button"
                  onClick={() => setElegido(u)}
                  style={{ textAlign: 'left', padding: 8, border: '1px solid #eee', borderRadius: 6 }}
                >
                  {u.correo}
                </button>
              ))}
            </>
          )
        ) : (
          <Input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="supervisor@correo.com" />
        )}

        <Button
          type="button"
          onClick={handleAsignar}
          disabled={procesando || (modo === 'buscar' ? !elegido : !correo.trim().includes('@'))}
        >
          {procesando ? 'Guardando...' : modo === 'buscar' ? 'Asignar' : 'Invitar'}
        </Button>
      </div>
    </div>
  );
}
