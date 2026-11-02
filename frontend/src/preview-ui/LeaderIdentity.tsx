import { Link } from 'react-router-dom';
import { CalendarDays, Clock3, MapPin, Users, ClipboardList, HeartHandshake, ReceiptText } from 'lucide-react';
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
 const foreground = getContrastRatio(background, '#ffffff') >= 4.5 ? '#ffffff' : '#000000';
 const dias=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
 const nombre=lider?.nombre_completo || (isLoading ? 'Cargando líder…' : isError ? 'No se pudo cargar el líder' : 'Líder sin asignar');
 return <><section className="leader-identity" style={{background,color:foreground}} aria-label="Tu Casa de Paz">
 <div className="leader-red">Casa de Paz{(perfil?.red_nombre || red) && <span> · {perfil?.red_nombre || red}</span>}</div>
 <div className="leader-person"><Link className="leader-avatar" to={lider?.persona_id === personaId ? ROUTES.CUENTA : ROUTES.CASAS_DE_PAZ} aria-label={`Ver perfil de ${nombre}`}>
 {foto && <img src={foto} alt="" onError={e=>{e.currentTarget.style.display='none';}}/>}<span>{lider?.nombre_completo ? iniciales(lider.nombre_completo) : <Users/>}</span></Link>
 <div><div className="leader-caption">Líder de Casa de Paz</div><h1>{nombre}</h1><p className="leader-zone"><MapPin size={16}/>{domicilio?.zona || 'Zona sin registrar'}</p></div></div>
 <div className="leader-meeting"><span><CalendarDays size={17}/>{perfil?.dia_reunion != null ? dias[perfil.dia_reunion] : 'Día sin definir'}</span><span><Clock3 size={17}/>{perfil?.hora_reunion?.slice(0,5) || 'Horario sin definir'}</span></div>
 </section><nav className="leader-shortcuts leader-main-actions" aria-label="Accesos de Casa de Paz">
 {[
  {label:'Reporte de casa de paz',path:ROUTES.REPORTES,Icon:ClipboardList},
  {label:'Asistencia',path:ROUTES.HISTORIAL_ASISTENCIA,Icon:Users},
  {label:'Evangelismo',path:ROUTES.EVANGELISMO,Icon:HeartHandshake},
 ].map(({label,path,Icon},index)=><Link key={path} to={path} state={{casaDePazId:cdpId}}><span className="shortcut-icon" style={index===0 ? {background,color:foreground} : undefined}><Icon size={28}/></span><strong>{label}</strong></Link>)}
 <button type="button" disabled aria-label="Boletas, próximamente"><span className="shortcut-icon"><ReceiptText size={28}/></span><strong>Boletas</strong><small>Próximamente</small></button>
 </nav></>;
}