import { effectiveAvatarPath } from '../lib/mediaPath';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ProfilePhotoPicker } from '../work/ProfilePhotoPicker';
import { ManagedBusinessAvatar } from '../work/ManagedBusinessAvatar';
import { SectionTabs } from '../components/SectionTabs';
import { Modal } from '../components/Modal';
import { SpecialtyBadges } from '../specialties/SpecialtyBadges';
import { useProfessionalRepository } from '../professional/ProfessionalProvider';
import { professionalError } from '../professional/validation';
import { useWorkRepository } from '../work/WorkProvider';
import { PortfolioPhoto } from '../work/PortfolioPhoto';
import { formatPrice } from '../work/validation';
import { usePosts } from '../posts/PostsProvider';
import type { ManagedPost } from '../posts/types';
import { ManagedPhoto } from '../posts/ManagedPhoto';
import type { EditableBusiness, ProfessionalCatalog } from '../professional/types';
import type { PortfolioRow, ServiceRow } from '../lib/database.types';

export function ProfilePreviewPage({ businessIdOverride, embedded = false, readOnly = false }: { businessIdOverride?: string; embedded?: boolean; readOnly?: boolean } = {}) {
  const { businessId: routeBusinessId = '' } = useParams();
  const businessId = businessIdOverride ?? routeBusinessId;
  const professional = useProfessionalRepository();
  const work = useWorkRepository();
  const { managed: postsRepository } = usePosts();
  const [posts, setPosts] = useState<ManagedPost[]>([]);
  const [business, setBusiness] = useState<EditableBusiness | null>(null);
  const [catalog, setCatalog] = useState<ProfessionalCatalog | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [photos, setPhotos] = useState<PortfolioRow[]>([]);
  const [enlarged, setEnlarged] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [contentError, setContentError] = useState(false);
  useEffect(() => {
    let live = true;
    setLoading(true); setError(''); setBusiness(null); setCatalog(null); setContentError(false); setPosts([]);
    if (!professional) { setLoading(false); return; }
    void Promise.all([professional.getEditable(businessId), professional.getCatalog()]).then(async ([result, options]) => {
      if (!live) return;
      setBusiness(result); setCatalog(options);
      if (work) {
        try {
          const content = await work.list(businessId);
          if (live) { setServices(content.services.filter(service => service.active)); setPhotos(content.photos.filter(photo => photo.media_state === 'ready')); }
        } catch { if (live) setContentError(true); }
      } else if (live) setContentError(true);
      if (postsRepository) {
        try {
          const page = await postsRepository.load(businessId, 1);
          if (live) setPosts(page.posts.items);
        } catch { /* O restante do perfil continua disponível. */ }
      }
    }).catch((cause: unknown) => { if (live) setError(professionalError(cause)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [professional, work, postsRepository, businessId]);
  const info = business?.input;
  const category = catalog?.categories.find(item => item.id === info?.categoryId);
  const city = catalog?.cities.find(item => item.id === info?.cityId);
  return <div className="public-profile profile-preview">
    {!embedded && <Link className="back-link" to={`/conta/profissional/${businessId}/editar?secao=previa`}>Voltar a editar perfil</Link>}
    {loading && <p role="status">Carregando prévia…</p>}
    {!professional && <p role="status">Prévia indisponível neste momento.</p>}
    {error && <p role="alert" className="form-error">{error}</p>}
    {business && info && <>
      <header className="social-profile-header social-preview-header">
        <div className="social-preview-identity"><div className="profile-photo-controls">{work && !readOnly ? <ProfilePhotoPicker key={businessId} businessId={businessId} path={effectiveAvatarPath(business.business)} repository={work} onSaved={path => setBusiness(current => current?.business.id === businessId ? { ...current, business: { ...current.business, profile_avatar_path: path } } : current)} /> : <ManagedBusinessAvatar path={effectiveAvatarPath(business.business)} />}</div><div className="social-preview-identity__details">
          {embedded ? <h2>{info.name}</h2> : <h1>{info.name}</h1>}<p>{info.type === 'empresa' ? 'Empresa' : 'Profissional autônomo'} · {city ? `${city.name}/${city.state_code}` : 'Cidade não informada'}</p>
          <dl className="social-preview-stats" role="group" aria-label="Resumo do perfil"><div><dt>Projetos</dt><dd>{posts.length}</dd></div><div><dt>Fotos</dt><dd>{contentError ? '—' : photos.length}</dd></div><div><dt>Serviços</dt><dd>{contentError ? '—' : services.length}</dd></div></dl>
        </div></div>
      <SpecialtyBadges primary={category ?? null} additional={catalog?.categories.filter(item => info.additionalCategoryIds.includes(item.id)) ?? []} />
      <p className="public-about social-profile-bio">{info.description || 'Adicione uma descrição para apresentar seu trabalho.'}</p>
      {!readOnly && <div className="social-profile-actions"><Link className="button button--secondary" to={`/conta/profissional/${businessId}/editar`}>Editar perfil</Link></div>}</header>
      <div className="form-notice social-preview-notice" role="status">{business.business.status === 'published' ? 'Perfil publicado. Você está vendo sua própria versão.' : 'Rascunho privado. Só você pode ver este perfil até a aprovação e publicação.'}</div>
      {contentError && <p className="field-help" role="status">Serviços e fotografias indisponíveis nesta prévia. Seus dados de perfil continuam visíveis.</p>}
      <SectionTabs label="Conteúdo do perfil" sections={[{ id: 'trabalhos', label: 'Projetos', content: <section className="public-profile-section" aria-label="Projetos e portfólio"><h2>Projetos e trabalhos</h2>
        {posts.length > 0 && <ul className="owner-posts">{posts.map(post => <li key={post.id}>
          <Link to={`/conta/profissional/${businessId}/publicacoes`} aria-label={`Gerenciar projeto ${post.title}`}>
            {post.images[0] ? <ManagedPhoto businessId={businessId} photo={post.images[0]} /> : <span className="owner-posts__empty">Sem foto</span>}
            <strong>{post.title}</strong><small>{post.status === 'published' ? 'Publicado' : 'Rascunho'}</small>
          </Link></li>)}</ul>}
        {photos.length && work ? <ul className="portfolio-grid social-preview-grid">{photos.map(photo => <li key={photo.id}><PortfolioPhoto item={photo} repository={work} onOpen={setEnlarged} />{photo.caption && <div className="portfolio-copy"><p>{photo.caption}</p></div>}</li>)}</ul> : <p className="field-help">Nenhuma fotografia cadastrada. Adicione fotografias de trabalhos pela área de edição.</p>}</section> }, { id: 'servicos', label: 'Serviços', content: <section className="public-profile-section" aria-label="Serviços"><h2>Serviços</h2>
        {services.length ? <ul className="public-services">{services.map(service => <li key={service.id}><div><h3>{service.name}</h3>{service.description && <p>{service.description}</p>}</div><strong>{formatPrice(service.pricing_type, service.price_amount_cents)}</strong></li>)}</ul> : <p className="field-help">Nenhum serviço cadastrado.</p>}</section>
      }, { id: 'sobre', label: 'Sobre', content: <section className="public-profile-section" aria-label="Contato e cidades atendidas"><h2>Contato e cidades atendidas</h2><p>{info.whatsapp ? `WhatsApp: ${info.whatsapp}` : 'WhatsApp ainda não informado.'}</p>{info.instagram && <p>Instagram: @{info.instagram}</p>}<p>{catalog?.cities.filter(item => info.areaCityIds.includes(item.id)).map(item => `${item.name}/${item.state_code}`).join(', ') || 'Nenhuma cidade informada.'}</p></section> }]} />
      {enlarged && <Modal title="Fotografia do trabalho" onClose={() => setEnlarged(null)}><img className="preview-enlarged" src={enlarged} alt="Fotografia do trabalho" referrerPolicy="no-referrer" /></Modal>}
    </>}
  </div>;
}
