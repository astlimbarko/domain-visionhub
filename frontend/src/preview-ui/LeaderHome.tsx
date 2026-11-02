import { useDashboardLiderCdp } from '@/hooks/useDashboard';
import { LeaderIdentity } from './LeaderIdentity';
export function LeaderHome({cdpId}:{cdpId:string}) {
 const {data,isLoading,isError,refetch}=useDashboardLiderCdp(cdpId);
 if(isError)return <div role="alert">No se pudo cargar tu Casa de Paz. <button type="button" onClick={()=>refetch()}>Reintentar</button></div>;
 if(isLoading || !data || data.casa_de_paz.id!==cdpId)return <p role="status">Cargando tu Casa de Paz…</p>;
 return <div className="leader-home"><LeaderIdentity cdpId={cdpId} color={data.casa_de_paz.red_color} red={data.casa_de_paz.red}/></div>;
}