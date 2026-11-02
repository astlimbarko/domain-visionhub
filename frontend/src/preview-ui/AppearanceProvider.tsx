import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, IconButton, Paper, Snackbar, ThemeProvider, createTheme } from '@mui/material';
import { Moon, Sun } from 'lucide-react';

const AppearanceContext = createContext<{mode:'light'|'dark';toggle:()=>void} | null>(null);
export function AppearanceToggle() {
 const appearance=useContext(AppearanceContext);
 if(!appearance)return null;
 return <IconButton className="appearance-inline-toggle" aria-label={appearance.mode==='light'?'Activar tema oscuro':'Activar tema claro'} onClick={appearance.toggle}>{appearance.mode==='light'?<Moon size={20}/>:<Sun size={20}/>}</IconButton>;
}
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<'light' | 'dark'>(() => localStorage.getItem('visionhub-ui-real-mode') === 'dark' ? 'dark' : 'light');
  const [blocked, setBlocked] = useState(false);
  const theme = useMemo(() => createTheme({
    palette: { mode, primary: { main: mode === 'dark' ? '#90b8ff' : '#2459c4' }, background: { default: mode === 'dark' ? '#131b29' : '#f1f4f8', paper: mode === 'dark' ? '#1d2839' : '#ffffff' }, text: { primary: mode === 'dark' ? '#e9eef6' : '#1c2b41', secondary: mode === 'dark' ? '#acbace' : '#5a687c' } },
    shape: { borderRadius: 10 }, typography: { fontFamily: 'Geist Variable, Roboto, sans-serif', button: { textTransform: 'none', fontWeight: 600 } },
    components: { MuiButton: { defaultProps: { disableElevation: true } }, MuiOutlinedInput: { styleOverrides: { root: { backgroundColor: mode === 'dark' ? '#182335' : '#ffffff', '& fieldset': { borderColor: mode === 'dark' ? '#687d99' : '#899ab1' } } } } }
  }), [mode]);
  useEffect(() => { document.documentElement.classList.toggle('dark', mode === 'dark'); document.documentElement.dataset.bsTheme = mode; document.body.dataset.uiPreview = 'official'; localStorage.setItem('visionhub-ui-real-mode', mode); }, [mode]);
  useEffect(() => { const onBlocked = () => setBlocked(true); window.addEventListener('preview-write-blocked', onBlocked); return () => window.removeEventListener('preview-write-blocked', onBlocked); }, []);
  return <AppearanceContext.Provider value={{mode,toggle:()=>setMode(mode === 'light' ? 'dark' : 'light')}}><ThemeProvider theme={theme}>{children}<Paper data-theme-toggle variant="outlined" sx={{ position: 'fixed', top: 12, right: 14, zIndex: 1400, p: .5, display: 'flex', alignItems: 'center', gap: .5 }}><IconButton aria-label={mode === 'light' ? 'Activar tema oscuro' : 'Activar tema claro'} onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}>{mode === 'light' ? <Moon size={19}/> : <Sun size={19}/>}</IconButton></Paper><Snackbar open={blocked} autoHideDuration={6500} onClose={() => setBlocked(false)}><Alert severity="info" onClose={() => setBlocked(false)}>Acción bloqueada: esta vista solo permite consultar. No se enviaron cambios.</Alert></Snackbar></ThemeProvider></AppearanceContext.Provider>;
}