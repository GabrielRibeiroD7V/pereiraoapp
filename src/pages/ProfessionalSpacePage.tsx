import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, FileText, Image, MapPin, MessageSquare, PencilLine, Plus, UserRound, Wrench } from 'lucide-react';
import {BusinessSubscriptionLine}from'../subscriptions/SubscriptionViews';
import { PageHeader } from '../components/PageHeader';
import { LinkButton } from '../components/LinkButton';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { MenuRow } from '../components/MenuRow';
import { BusinessStatus } from '../components/BusinessStatus';
import { useAuth } from '../auth/AuthProvider';
import { useProfessionalRepository } from '../professional/ProfessionalProvider';
import { professionalError } from '../professional/validation';
import type { BusinessRow } from '../lib/database.types';
import type { ProfessionalCatalog } from '../professional/types';

export function ProfessionalSpacePage() {
  const repository = useProfessionalRepository();
  const { session } = useAuth();
  const location = useLocation();
  const [businesses, setBusinesses] = useState<readonly BusinessRow[]>([]);
  const [catalog, setCatalog] = useState<ProfessionalCatalog | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setLoading(true); setBusinesses([]); setCatalog(null); setError(null);
    if (!repository) { setLoading(false); return; }
    void Promise.all([repository.listMine(), repository.getCatalog()]).then(([rows, values]) => {
      if (live) { setBusinesses(rows); setCatalog(values); }
    }).catch((cause: unknown) => { if (live) setError(professionalError(cause)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [repository, session?.user.id]);
  const business = businesses.find((item) => item.id === (selectedId || location.state?.businessId)) ?? businesses[0];
  const category = catalog?.categories.find((item) => item.id === business?.category_id)?.name;
  const city = catalog?.cities.find((item) => item.id === business?.city_id);
  return <div className="professional-page">
    <Link className="back-link" to="/conta"><ArrowLeft size={17} aria-hidden="true" />Minha conta</Link>
    <PageHeader title="Espaço profissional" />
    {location.state?.saved && <p role="status" className="form-notice">Dados salvos. Seu perfil não foi publicado automaticamente.</p>}
    {loading && <p role="status">Carregando seus perfis…</p>}
    {!repository && <p role="status">O espaço profissional ainda está sendo preparado.</p>}
    {error && <p role="alert" className="form-error">{error}</p>}
    {!loading && !error && repository && businesses.length === 0 && <section className="professional-empty">
      <ProfileAvatar business /><h2>Seu trabalho merece ser encontrado</h2><p>Crie seu perfil de autônomo ou empresa. Você começa com um rascunho, sem publicação automática.</p>
      <LinkButton to="/conta/profissional/cadastro">Cadastrar meu negócio</LinkButton>
    </section>}
    {!loading && !error && business && <>
      {businesses.length > 1 && <div className="business-selector form-field"><label htmlFor="managed-business">Negócio que você quer gerenciar</label>
        <select id="managed-business" value={business.id} onChange={(event) => setSelectedId(event.target.value)}>{businesses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      </div>}
      <section className="business-identity" aria-label="Identificação do negócio">
        <div className="business-identity__heading"><ProfileAvatar business /><div><p className="business-type">{business.type === 'empresa' ? 'Empresa' : 'Profissional autônomo'}</p><h2>{business.name}</h2></div></div>
        <div className="business-meta"><span>{category || 'Categoria não informada'}</span><span><MapPin size={15} aria-hidden="true" />{city ? `${city.name}/${city.state_code}` : business.city_id}</span></div>
        <div className="business-identity__status"><BusinessStatus status={business.status} /><p>{business.status === 'published' ? 'Visível no marketplace.' : 'Seu perfil não está visível no marketplace.'}</p></div>
        {business.description && <p className="business-identity__description">{business.description}</p>}
        <LinkButton variant="secondary" to={`/conta/profissional/${business.id}/editar`}><PencilLine size={17} aria-hidden="true" />Editar perfil</LinkButton>
        <LinkButton variant="secondary" to={`/conta/profissional/${business.id}/previa`}>Ver prévia do perfil</LinkButton>
      </section>
      <section className="business-management" aria-labelledby="management-title"><h2 id="management-title">Seu negócio</h2>
        <BusinessSubscriptionLine businessId={business.id}/>
        <MenuRow icon={UserRound} title="Meu perfil" description="Apresentação, localização e contatos" to={`/conta/profissional/${business.id}/editar`} />
        <MenuRow icon={Wrench} title="Meus serviços" description="Seu catálogo de serviços" to={`/conta/profissional/${business.id}/servicos`} />
        <MenuRow icon={Image} title="Meus trabalhos" description="Fotografias dos seus trabalhos" to={`/conta/profissional/${business.id}/trabalhos`} />
        <MenuRow icon={FileText} title="Publicações" description="Apresente trabalhos realizados" to={`/conta/profissional/${business.id}/publicacoes`}/>
        <MenuRow icon={MessageSquare} title="Mensagens" description="Conversas com seus clientes" to="/mensagens" />
      </section>
      <p className="field-help professional-footnote">Serviços e fotografias seguem o estado de publicação do seu perfil. A prévia é visível somente para quem gerencia o negócio.</p>
      <Link className="text-link add-business" to="/conta/profissional/cadastro"><Plus size={17} aria-hidden="true" />Cadastrar outro negócio</Link>
    </>}
  </div>;
}
