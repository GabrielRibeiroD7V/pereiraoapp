import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { LinkButton } from '../components/LinkButton';
import { useAuth } from '../auth/AuthProvider';
import { useProfessionalRepository } from '../professional/ProfessionalProvider';
import { professionalError } from '../professional/validation';
import type { BusinessRow } from '../lib/database.types';

const statuses: Record<BusinessRow['status'], string> = { draft: 'Rascunho', published: 'Publicado', unpublished: 'Não publicado' };
export function ProfessionalSpacePage() {
  const repository = useProfessionalRepository();
  const { session } = useAuth();
  const location = useLocation();
  const [businesses, setBusinesses] = useState<readonly BusinessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setLoading(true); setBusinesses([]); setError(null);
    if (!repository) { setLoading(false); return; }
    void repository.listMine().then((rows) => { if (live) setBusinesses(rows); })
      .catch((cause: unknown) => { if (live) setError(professionalError(cause)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [repository, session?.user.id]);
  return <>
    <PageHeader title="Espaço profissional"><p>Gerencie os perfis profissionais da sua conta.</p></PageHeader>
    {location.state?.saved && <p role="status" className="form-notice">Dados salvos. O cadastro não publica seu perfil automaticamente.</p>}
    {loading && <p role="status">Carregando seus perfis…</p>}
    {!repository && <p role="status">O espaço profissional ainda está sendo preparado.</p>}
    {error && <p role="alert" className="form-error">{error}</p>}
    {!loading && !error && repository && businesses.length === 0 && <p className="form-notice">Você ainda não tem um perfil profissional. Cadastre seu primeiro rascunho.</p>}
    <ul className="professional-list">
      {businesses.map((business) => <li key={business.id}>
        <div><h2>{business.name}</h2><p>{business.type === 'empresa' ? 'Empresa' : 'Profissional autônomo'} · <strong>{statuses[business.status]}</strong></p>
          {business.status === 'draft' && <p className="field-help">Não está visível no marketplace.</p>}
        </div>
        <LinkButton variant="secondary" to={`/conta/profissional/${business.id}/editar`}>Editar dados</LinkButton>
      </li>)}
    </ul>
    {repository && <LinkButton to="/conta/profissional/cadastro">Anunciar meus serviços</LinkButton>}
    <p className="supporting-copy">O gerenciamento de serviços e portfólio será disponibilizado em uma próxima etapa.</p>
  </>;
}
