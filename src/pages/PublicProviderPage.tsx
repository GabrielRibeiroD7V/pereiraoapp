import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MessageCircle, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMarketplace } from '../marketplace/MarketplaceProvider';
import { usePublicQuery } from '../marketplace/usePublicQuery';
import { PublicImage } from '../marketplace/PublicImage';
import { ContactLinks } from '../marketplace/ContactLinks';
import { QueryStatus } from '../marketplace/QueryStatus';
import { Pagination } from '../marketplace/Pagination';
import { SectionTabs } from '../components/SectionTabs';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { formatPrice } from '../work/validation';
import type { PublicPage, PublicPhoto, PublicProvider, PublicService } from '../marketplace/types';
import type { City } from '../types/domain';
import { SpecialtyBadges } from '../specialties/SpecialtyBadges';
import {PublishedWorks} from '../posts/PublishedWorks';

function PagedSection<T>({ title, load, render, empty }: { title: string; load: (page: number, signal: AbortSignal) => Promise<PublicPage<T>>; render: (items: T[]) => ReactNode; empty: string }) {
  const [page, setPage] = useState(1);
  const fetchPage = useCallback((signal: AbortSignal) => load(page, signal), [load, page]);
  const state = usePublicQuery(`${title}:${page}`, fetchPage);
  return <section className="public-profile-section" aria-label={title}><h2>{title}</h2><QueryStatus {...state} />{state.data && <>{state.data.items.length ? render(state.data.items) : <p className="field-help">{empty}</p>}<Pagination page={page} hasNext={state.data.hasNext} onChange={setPage} label={title} /></>}</section>;
}
function ProfileContent({ provider }: { provider: PublicProvider }) {
  const repository = useMarketplace()!;
  const [photo, setPhoto] = useState<PublicPhoto | null>(null);
  const services = useCallback((page: number, signal: AbortSignal) => repository.getServices(provider.id, page, signal), [repository, provider.id]);
  const photos = useCallback((page: number, signal: AbortSignal) => repository.getPhotos(provider.id, page, signal), [repository, provider.id]);
  const areas = useCallback((page: number, signal: AbortSignal) => repository.getAreas(provider.id, page, signal), [repository, provider.id]);
  return <>
    <header className="social-profile-header">
      <div className="public-profile-heading"><span className="provider-item__avatar">{provider.avatarPath ? <PublicImage businessId={provider.id} path={provider.avatarPath} alt="" avatar /> : <UserRound aria-hidden="true" />}</span><div><PageHeader title={provider.name} /><p>{provider.type === 'empresa' ? 'Empresa' : 'Profissional autônomo'}</p><p>{provider.city.name}{provider.city.state && `/${provider.city.state}`}</p></div></div>
      <SpecialtyBadges primary={provider.categoryId ? { id: provider.categoryId, name: provider.specialty } : null} additional={provider.additionalSpecialties ?? []} />
      {provider.description && <p className="public-about social-profile-bio">{provider.description}</p>}
      <div className="social-profile-actions"><Link className="button button--secondary" to={`/mensagens/iniciar/${provider.id}`}><MessageCircle size={18} aria-hidden="true" />Mensagem pelo PEREIRÃO</Link><ContactLinks name={provider.name} whatsapp={provider.whatsapp} instagram={provider.instagram} /></div>
    </header>
    <SectionTabs label="Conteúdo do perfil" sections={[
      { id: 'trabalhos', label: 'Trabalhos', content: <>
    <PublishedWorks key={provider.id} businessId={provider.id}/>
    <PagedSection<PublicPhoto> title="Portfólio" load={photos} empty="O prestador ainda não adicionou fotografias públicas." render={(items) => <ul className="public-gallery">{items.map((item) => <li key={item.id}><button className="public-gallery-open" onClick={() => setPhoto(item)} aria-label={`Ampliar fotografia ${item.caption ?? 'do trabalho'}`}><PublicImage businessId={provider.id} path={item.storagePath} alt={item.caption ?? 'Trabalho do prestador'} /></button>{item.caption && <p>{item.caption}</p>}</li>)}</ul>} />
      </> },
      { id: 'servicos', label: 'Serviços', content: <>
    <PagedSection<PublicService> title="Serviços" load={services} empty="Nenhum serviço disponível no momento." render={(items) => <ul className="public-services">{items.map((item) => <li key={item.id}><div><h3>{item.name}</h3>{item.description && <p>{item.description}</p>}</div><strong>{formatPrice(item.pricing_type, item.price_amount_cents)}</strong></li>)}</ul>} />
      </> },
      { id: 'sobre', label: 'Sobre', content: <>
    <PagedSection<City> title="Área de atendimento" load={areas} empty="Consulte o prestador sobre as localidades atendidas." render={(items) => <ul className="public-areas">{items.map((item) => <li key={item.id}>{item.name}/{item.state}</li>)}</ul>} />
      </> },
    ]} />
    {photo && <Modal title="Fotografia do trabalho" onClose={() => setPhoto(null)}><div className="public-enlarged"><PublicImage businessId={provider.id} path={photo.storagePath} alt={photo.caption ?? 'Trabalho do prestador'} /></div>{photo.caption && <p>{photo.caption}</p>}</Modal>}
  </>;
}
export function PublicProviderPage() {
  const { slug = '' } = useParams(), repository = useMarketplace();
  const load = useCallback((signal: AbortSignal) => repository ? repository.getProvider(slug, signal) : Promise.resolve(null), [repository, slug]);
  const state = usePublicQuery(slug, load);
  return <div className="public-profile"><Link className="back-link" to="/buscar">Voltar à busca</Link>
    {!repository ? <><PageHeader title="Perfil indisponível" /><p>Tente novamente em breve.</p></> : <><QueryStatus {...state} />{state.data ? <ProfileContent key={state.data.id} provider={state.data} /> : !state.loading && !state.error && <><PageHeader title="Perfil não encontrado" /><p>Este perfil não está disponível publicamente.</p></>}</>}
  </div>;
}
