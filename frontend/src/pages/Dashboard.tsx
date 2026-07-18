import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';

export function Dashboard() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <ProximamentePlaceholder
        titulo="Próximamente"
        descripcion="Los dashboards por rol (Pastor, Supervisor, Líder de Red, Líder de CdP, Sublíder) se construyen en la próxima etapa."
      />
    </div>
  );
}
