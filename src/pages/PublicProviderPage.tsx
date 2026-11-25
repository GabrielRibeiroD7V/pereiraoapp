import {OffersSection} from '../offers/OfferViews';
import {useOffers} from '../offers/OffersProvider';
import {PostBackLink,validPostOrigin} from '../posts/PostBackLink';
import {profileViews} from '../posts/postReturn';
import {ReportContent} from '../components/ReportContent';
import {useSectionAnchor} from '../hooks/useSectionAnchor';
import { PresentationIdentity } from '../presentation/PresentationIdentity';
import { usePresentation } from '../presentation/PresentationProvider';
import { PresentationSections } from '../presentation/PresentationSections';
import { useCallback, useState, useEffect } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { Flame, MessageCircle, UserRound, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMarketplace } from '../marketplace/MarketplaceProvider';
import { usePublicQuery } from '../marketplace/usePublicQuery';
import { PublicImage } from '../marketplace/PublicImage';
import { ContactLinks } from '../marketplace/ContactLinks';
import { QueryStatus } from '../marketplace/QueryStatus';
import { Pagination } from '../marketplace/Pagination';
import { SectionTabs } from '../components/SectionTabs';
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
  useSectionAnchor(title === 'Serviços e preços' && !!state.data);
  return <section id={title==='Serviços e preços'?'servicos':undefined} className="public-profile-section" aria-label={title}><h2>{title}</h2><QueryStatus {...state} />{state.data && <>{state.data.items.length ? render(state.data.items) : <p className="field-help">{empty}</p>}<Pagination page={page} hasNext={state.data.hasNext} onChange={setPage} label={title} /></>}</section>;
}
function ProfileContent({ provider }: { provider: PublicProvider }) {
  const offers=useOffers();
  const repository = useMarketplace()!;
  const location=useLocation(),viewKey=`${location.key}:public:${provider.id}`;
  const [tab,setTab]=useState(location.hash==='#servicos'?'servicos':profileViews.get(viewKey)?.tab??'trabalhos');
  useEffect(()=>{profileViews.set(viewKey,{tab,page:1});},[viewKey,tab]);
  useEffect(()=>{if(location.hash==='#servicos')setTab('servicos');},[location.hash]);
  const presentation = usePresentation(provider.id, true);
  const services = useCallback((page: number, signal: AbortSignal) => repository.getServices(provider.id, page, signal), [repository, provider.id]);
  const photos = useCallback((page: number, signal: AbortSignal) => repository.getPhotos(provider.id, page, signal), [repository, provider.id]);
  const areas = useCallback((page: number, signal: AbortSignal) => repository.getAreas(provider.id, page, signal), [repository, provider.id]);
  return <>
    <header className="social-profile-header">
      <div className="public-profile-heading"><span className="provider-item__avatar">{provider.avatarPath ? <PublicImage businessId={provider.id} path={provider.avatarPath} alt="" avatar /> : <UserRound aria-hidden="true" />}</span><div><PageHeader title={provider.name} /><p>{provider.type === 'empresa' ? 'Empresa' : 'Profissional autônomo'}</p><p>{provider.city.name}{provider.city.state && `/${provider.city.state}`}</p></div></div>
      <PresentationIdentity data={presentation.data} company={provider.type === 'empresa'} />
      {presentation.data.headline && <p className="professional-headline">{presentation.data.headline}</p>}
      <SpecialtyBadges primary={provider.categoryId ? { id: provider.categoryId, name: provider.specialty } : null} additional={provider.additionalSpecialties ?? []} />
      {provider.description && <p className="public-about social-profile-bio">{provider.description}</p>}
      <div className="social-profile-actions"><Link className="button button--secondary" to={`/mensagens/iniciar/${provider.id}`}><MessageCircle size={18} aria-hidden="true" />Mensagem pelo PEREIRÃO</Link><ContactLinks compact name={provider.name} whatsapp={provider.whatsapp} instagram={provider.instagram} /></div>
    </header>
    {presentation.error && <p role="status">Informações adicionais indisponíveis no momento.</p>}
    <SectionTabs label="Conteúdo do perfil" selectedId={tab} onSelect={setTab} sections={[
      { id: 'trabalhos', label: 'Trabalhos', icon: <Flame size={16} aria-hidden="true" />, content: <>
    <ReportContent kind="business" id={provider.id}/><PublishedWorks key={provider.id} businessId={provider.id} coversOnly/>
    <PagedSection<PublicPhoto> title="Fotos de trabalhos" load={photos} empty="O prestador ainda não adicionou fotografias públicas." render={(items) => <ul className="public-gallery">{items.map((item) => <li key={item.id}><Link className="public-gallery-open" to={`/prestadores/${provider.slug}/fotos/${item.id}`} aria-label={`Abrir fotografia ${item.caption ?? 'do trabalho'}`}><PublicImage businessId={provider.id} path={item.storagePath} alt={item.caption ?? 'Trabalho do prestador'} /></Link>{item.caption && <p>{item.caption}</p>}</li>)}</ul>} />
      </> },
      {id:'servicos',label:'Serviços',icon:<Wrench size={16} aria-hidden="true" />,content:offers?<OffersSection business={provider.id} kind="service"/>:<PagedSection<PublicService> title="Serviços e preços" load={services} empty="Nenhum serviço disponível no momento." render={(items) => <ul className="public-services">{items.map((item) => <li key={item.id}><div><h3>{item.name}</h3>{item.description && <p>{item.description}</p>}</div><strong className="service-price">{formatPrice(item.pricing_type, item.price_amount_cents)}</strong></li>)}</ul>} />},
      ...(offers?[{id:'produtos',label:'Produtos',content:<OffersSection business={provider.id} kind="product" featuredOnly/>}]:[]),
      { id: 'sobre', label: 'Sobre', content: <>
    <PresentationSections data={presentation.data} company={provider.type === 'empresa'} />
    <PagedSection<City> title="Área de atendimento" load={areas} empty="Consulte o prestador sobre as localidades atendidas." render={(items) => <ul className="public-areas">{items.map((item) => <li key={item.id}>{item.name}/{item.state}</li>)}</ul>} />
      </> },
    ]} />
  </>;
}
export function PublicProviderPage() {
  const entry=useLocation();
  const { slug = '' } = useParams(), repository = useMarketplace();
  const load = useCallback((signal: AbortSignal) => repository ? repository.getProvider(slug, signal) : Promise.resolve(null), [repository, slug]);
  const state = usePublicQuery(`provider:${slug}`, load, true, 30_000);
  return <div className="public-profile">{validPostOrigin(entry.state?.postOrigin)?<PostBackLink fallback="/buscar"/>:<Link className="back-link" to="/buscar">Voltar à busca</Link>}
    {!repository ? <><PageHeader title="Perfil indisponível" /><p>Tente novamente em breve.</p></> : <><QueryStatus {...state} />{state.data ? <ProfileContent key={state.data.id} provider={state.data} /> : !state.loading && !state.error && <><PageHeader title="Perfil não encontrado" /><p>Este perfil não está disponível publicamente.</p></>}</>}
  </div>;
}
