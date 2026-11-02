import { Link } from 'react-router-dom';
import { CalendarDays, Clock3, MapPin, Users, ClipboardCheck, Network, HeartHandshake, ReceiptText, ChevronRight } from 'lucide-react';
import { useCargoVigenteCdp, useCdpPerfil, useDomicilioCdp } from '@/hooks/useCasasDePaz';
import { useFotoPerfilPath, useUrlFotoPerfil } from '@/hooks/usePersonaFoto';
import { iniciales } from '@/components/shared/AvatarIniciales';
import { getContrastRatio } from '@mui/material/styles';
import { ROUTES } from '@/utils/constants';
import { useAuthStore } from '@/store/auth.store';
export function LeaderIdentity({ cdpId, color, red }: { cdpId: string; color: string | null; red: string | null }) {
 const {data: lideres, isLoading, isError} = useCargoVigenteCdp(cdpId, 'LIDER_CDP');
 const lider = lideres?.[0];
 const {data: perfil} = useCdpPerfil(cdpId);
 const {data: domicilio} = useDomicilioCdp(cdpId);
 const {data: path} = useFotoPerfilPath(lider?.persona_id);
 const {data: foto} = useUrlFotoPerfil(path);
 const personaId = useAuthStore(s=>s.personaId);
 const background = color && /^#[0-9a-f]{6}$/i.test(color) ? color : '#19456b';
 const foreground = getContrastRatio(background, '#ffffff') >= 4.6 ? '#ffffff' : '#000000';
 const tone=(target:number,amount:number)=>'#'+[1,3,5].map(i=>Math.round(parseInt(background.slice(i,i+2),16)*(1-amount)+target*amount).toString(16).padStart(2,'0')).join('');
 const candidates=foreground==='#ffffff'?[tone(0,.28),background,tone(255,.12)]:[tone(0,.1),background,tone(255,.2)];
 const tones=candidates.map(candidate=>getContrastRatio(candidate,foreground)>=4.6?candidate:background);
 const gradient='linear-gradient(115deg,'+tones[0]+' 0%,'+tones[1]+' 55%,'+tones[2]+' 100%)';
 const dias=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
 const redName=perfil?.red_nombre || red;
 const nombre=lider?.nombre_completo || (isLoading ? 'Cargando líder…' : isError ? 'No se pudo cargar el líder' : 'Líder sin asignar');
 return <><section className="leader-identity" style={{backgroundColor:background,backgroundImage:gradient,color:foreground}} aria-label="Tu Casa de Paz">
  <svg className="leader-wave leader-wave-top" viewBox="0 0 1200 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0H1200V8C960 60 760 60 570 32S200 -5 0 48Z"/></svg>
 <div className="leader-red"><Network size={22}/><span>{redName ? (/^red\b/i.test(redName) ? redName : 'Red '+redName) : 'Casa de Paz'}</span></div>
 <div className="leader-person"><Link className="leader-avatar" to={lider?.persona_id === personaId ? ROUTES.CUENTA : ROUTES.CASAS_DE_PAZ} aria-label={`Ver perfil de ${nombre}`}>
 {foto && <img src={foto} alt="" onError={e=>{e.currentTarget.style.display='none';}}/>}<span>{lider?.nombre_completo ? iniciales(lider.nombre_completo) : <Users/>}</span></Link>
 <div><div className="leader-caption">Líder de Casa de Paz</div><h1>{nombre}</h1><p className="leader-zone"><MapPin size={16}/>{domicilio?.zona || 'Zona sin registrar'}</p></div></div>
 <div className="leader-meeting"><span><CalendarDays size={17}/>{perfil?.dia_reunion != null ? dias[perfil.dia_reunion] : 'Día sin definir'}</span><span><Clock3 size={17}/>{perfil?.hora_reunion?.slice(0,5) || 'Horario sin definir'}</span></div>
 <svg className="leader-wave leader-wave-bottom" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true"><path className="leader-wave-ribbon" fill={tones[2]} transform="translate(0 -9)" d="M0 60C260 105 470 90 640 56S1020 5 1200 28V120H0Z"/><path d="M0 60C260 105 470 90 640 56S1020 5 1200 28V120H0Z"/></svg>
 </section><section className="leader-access-panel" aria-labelledby="leader-access-title"><h2 id="leader-access-title">Accesos rápidos</h2><nav className="leader-shortcuts leader-main-actions" aria-label="Accesos de Casa de Paz">
 {[
  {label:'Reporte de casa de paz',path:ROUTES.REPORTES,Icon:ClipboardCheck},
  {label:'Asistencia',path:ROUTES.HISTORIAL_ASISTENCIA,Icon:Users},
  {label:'Evangelismo',path:ROUTES.EVANGELISMO,Icon:HeartHandshake},
 ].map(({label,path,Icon})=><Link key={path} to={path} state={{casaDePazId:cdpId}}><span className="shortcut-icon"><Icon size={28}/></span><strong>{label}</strong><span className="shortcut-arrow" aria-hidden="true"><ChevronRight size={17}/></span></Link>)}
 <button type="button" disabled aria-label="Boletas, próximamente"><span className="shortcut-icon"><ReceiptText size={28}/></span><strong>Boletas</strong><small>Próximamente</small></button>
 </nav></section></>;
}