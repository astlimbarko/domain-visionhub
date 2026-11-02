import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button, TextField, IconButton, InputAdornment, Card, Typography, Divider, Box } from '@mui/material';
import { Eye, EyeOff } from 'lucide-react';



import { GoogleIcon } from '@/components/icons/GoogleIcon';
import { iniciarSesion, iniciarSesionConGoogle } from '@/services/auth.service';
import { construirSesionDesdeAuth } from '@/services/sesion.service';
import { useAuthStore } from '@/store/auth.store';
import { GOOGLE_AUTH_HABILITADO, ROUTES } from '@/utils/constants';
import { obtenerVersionApp } from '@/utils/app-version';

const esquema = z.object({ correo: z.string().email(), contrasena: z.string().min(1) });
type FormLogin = z.infer<typeof esquema>;

// Antes el catch de abajo mostraba siempre "credenciales incorrectas" pase lo
// que pase (red caída, límite de intentos, lo que sea) -- imposible saber qué
// pasó de verdad. Se distinguen los casos conocidos y, si no matchea ninguno,
// se muestra el mensaje real de Supabase en vez de adivinar.
function mensajeErrorLogin(error: unknown): string {
  const mensaje = error instanceof Error ? error.message : '';
  if (/invalid login credentials/i.test(mensaje)) return 'Correo o contraseña incorrectos.';
  if (/email not confirmed/i.test(mensaje)) return 'Todavía no confirmaste tu correo.';
  if (/too many requests|rate limit/i.test(mensaje)) return 'Demasiados intentos. Esperá un momento e intentá de nuevo.';
  if (/failed to fetch|networkerror|load failed/i.test(mensaje)) return 'No se pudo conectar con el servidor. Revisá tu conexión a internet.';
  return mensaje || 'No se pudo iniciar sesión.';
}

export function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setSesion = useAuthStore((s) => s.setSesion);
  const [enviando, setEnviando] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormLogin>({ resolver: zodResolver(esquema) });

  async function onSubmit(datos: FormLogin) {
    setEnviando(true);
    try {
      await iniciarSesion(datos.correo, datos.contrasena);
      // Nueva identidad: descartar la caché de la cuenta anterior. Sin esto,
      // dos cuentas de la misma iglesia comparten queryKey (ej. mis-roles) y
      // la segunda ve los roles cacheados de la primera (sidebar/panel del rol
      // equivocado).
      queryClient.clear();
      setSesion(await construirSesionDesdeAuth());
      navigate(ROUTES.DASHBOARD, { replace: true });
    } catch (error) { toast.error(mensajeErrorLogin(error)); }
    finally { setEnviando(false); }
  }

  async function onClickGoogle() {
    try { await iniciarSesionConGoogle(); }
    catch { toast.error('No se pudo iniciar sesión con Google.'); }
  }

  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const { ref: correoRef, ...correoProps } = register('correo');
  const { ref: contrasenaRef, ...contrasenaProps } = register('contrasena');

  return (
    <main className="original-login">
      <Card variant="outlined" className="original-login-card">
        <div className="original-login-brand">
          <img src="/logo.png" alt="Centro de Vida" />
          <Typography component="h1" variant="h5" fontWeight={700}>{t('app.nombre')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Iniciá sesión en tu cuenta</Typography>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="original-login-form">
          <TextField {...correoProps} inputRef={correoRef} id="correo" type="email" label={t('auth.correo')} autoComplete="username" fullWidth error={!!errors.correo} helperText={errors.correo?.message} />
          <TextField {...contrasenaProps} inputRef={contrasenaRef} id="contrasena" type={mostrarContrasena ? 'text' : 'password'} label={t('auth.contrasena')} autoComplete="current-password" fullWidth error={!!errors.contrasena} helperText={errors.contrasena?.message} slotProps={{ input: { endAdornment: <InputAdornment position="end"><IconButton type="button" onClick={() => setMostrarContrasena(v => !v)} aria-label={mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'} edge="end">{mostrarContrasena ? <EyeOff size={20}/> : <Eye size={20}/>}</IconButton></InputAdornment> } }} />
          <Button type="submit" disabled={enviando} variant="contained" fullWidth size="large" sx={{ py: 1.4 }}>{enviando ? t('acciones.cargando') : t('auth.iniciarSesion')}</Button>
          <Button component={Link} to={ROUTES.RECUPERAR_CONTRASENA} size="small">¿Olvidaste tu contraseña?</Button>
        </form>
        <Divider sx={{ my: 2.5 }}><Typography variant="caption" color="text.secondary">o</Typography></Divider>
        <Button type="button" variant="outlined" fullWidth disabled={!GOOGLE_AUTH_HABILITADO} onClick={onClickGoogle} startIcon={<Box sx={{display:'flex','& svg':{width:18,height:18}}}><GoogleIcon /></Box>} sx={{py:1.2}}>Continuar con Google</Button>
        <Typography variant="caption" color="text.secondary" sx={{display:'block',textAlign:'center',mt:2}}>Solo funciona si ya tenés una cuenta invitada al sistema.</Typography>
        <Typography variant="caption" color="text.secondary" sx={{display:'block',textAlign:'center',mt:3,fontSize:10}}>v{obtenerVersionApp()}</Typography>
      </Card>
    </main>
  );
}