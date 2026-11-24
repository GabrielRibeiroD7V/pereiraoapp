import {useReturnRevision} from '../hooks/useReturnRevision';
import {WorkPhotoDetail} from '../work/WorkPhotoDetail';
import {PhotoEditor} from '../work/PhotoEditor';
import { usePostCreation } from '../posts/usePostCreation';
import { PresentationIdentity } from '../presentation/PresentationIdentity';
import { BusinessStatus } from '../components/BusinessStatus';
import { Ellipsis } from 'lucide-react';
import { ContactLinks } from '../marketplace/ContactLinks';
import { usePresentation } from '../presentation/PresentationProvider';
import { PresentationSections } from '../presentation/PresentationSections';
import { effectiveAvatarPath } from '../lib/mediaPath';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
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
  const location = useLocation();
  const resume=useReturnRevision(), lastBusiness=useRef('');
  const [postRefresh,setPostRefresh]=useState(0);
  const [adding, setAdding] = useState(false);
  const [project, setProject] = useState<ManagedPost | null>(null);
  const professional = useProfessionalRepository();
  const presentation = usePresentation(businessId);
  const work = useWorkRepository();
  const { managed: postsRepository } = usePosts();
  const [posts, setPosts] = useState<ManagedPost[]>([]);
  const [business, setBusiness] = useState<EditableBusiness | null>(null);
  const [catalog, setCatalog] = useState<ProfessionalCatalog | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [photos, setPhotos] = useState<PortfolioRow[]>([]);
  const [enlarged, setEnlarged] = useState<{id:string;url:string} | null>(null);
  const [editingPhoto,setEditingPhoto]=useState<PortfolioRow|null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [contentError, setContentError] = useState(false);
  const creator=usePostCreation(businessId,()=>setAdding(false),()=>setPostRefresh(n=>n+1),business?.input.name);
  useEffect(() => {
    let live = true;
    setLoading(true); setError(''); setContentError(false);
    if(lastBusiness.current!==businessId){lastBusiness.current=businessId;setBusiness(null);setCatalog(null);setPosts([]);setPhotos([]);setServices([]);setEnlarged(null);}
    if (!professional) { setLoading(false); return; }
    void Promise.all([professional.getEditable(businessId), professional.getCatalog()]).then(async ([result, options]) => {
      if (!live) return;
      setBusiness(result); setCatalog(options);
      if (work) {
        try {
          const content = await work.list(businessId);
          if (live) { setServices(content.services); setPhotos(content.photos.filter(photo => photo.media_state === 'ready')); }
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
  }, [professional, work, postsRepository, businessId, readOnly,postRefresh,resume]);
  const selectedPhoto=photos.find(p=>p.id===enlarged?.id);
  const activeServices=services.filter(service=>service.active);
  const info = business?.input;
  const category = catalog?.categories.find(item => item.id === info?.categoryId);
  const city = catalog?.cities.find(item => item.id === info?.cityId);
  return <div className="public-profile profile-preview">
    {!embedded && <Link className="back-link" state={{ businessId }} to={readOnly ? `/conta/profissional/${businessId}/perfil` : "/conta"}>{readOnly ? 'Voltar ao perfil' : 'Voltar à Conta'}</Link>}
    {location.state?.saved && <p role="status" className="form-notice">Perfil salvo. Seu status de publicação não mudou.</p>}
    {loading && <p role="status">Carregando prévia…</p>}
    {!professional && <p role="status">Prévia indisponível neste momento.</p>}
    {error && <p role="alert" className="form-error">{error}</p>}
    {business && info && <>
      <header className="social-profile-header social-preview-header">
        {!readOnly && !embedded && <details className="owner-settings profile-options"><summary aria-label="Opções da conta"><Ellipsis aria-hidden="true" /></summary><nav aria-label="Opções privadas"><Link to="/conta/dados">Dados da conta</Link><Link to="/conta/seguranca">Segurança e acesso</Link><Link to="/conta/assinaturas">Gratuidade e assinatura</Link><Link to="/conta">Trocar perfil ou sair</Link></nav></details>}
        <div className="social-preview-identity"><div className="profile-photo-controls">{work && !readOnly ? <ProfilePhotoPicker actionLabel="Alterar foto" key={businessId} businessId={businessId} path={effectiveAvatarPath(business.business)} repository={work} onSaved={path => setBusiness(current => current?.business.id === businessId ? { ...current, business: { ...current.business, profile_avatar_path: path } } : current)} /> : <ManagedBusinessAvatar path={effectiveAvatarPath(business.business)} />}</div><div className="social-preview-identity__details">
          {embedded ? <h2>{info.name}</h2> : <h1>{info.name}</h1>}<p>{info.type === 'empresa' ? 'Empresa' : 'Profissional autônomo'} · {city ? `${city.name}/${city.state_code}` : 'Cidade não informada'}</p>

        </div></div>
      {!readOnly && <div className="social-profile-actions owner-profile-actions">
        <Link className="button button--primary" to={`/conta/profissional/${businessId}/editar`}>Editar perfil</Link>
        <button type="button" className="button button--secondary" aria-haspopup="dialog" onClick={()=>setAdding(true)}>Adicionar</button>
        <Link className="button button--secondary" to={`/conta/profissional/${businessId}/previa`}>Ver como cliente</Link>
        <ContactLinks compact name={info.name} whatsapp={info.whatsapp || null} instagram={info.instagram || null} />
      </div>}
      <PresentationIdentity data={presentation.data} company={info.type === 'empresa'} />
      {presentation.data.headline && <p className="professional-headline">{presentation.data.headline}</p>}
      <BusinessStatus status={business.business.status} />
      <p className="field-help">Atende: {catalog?.cities.filter(item => info.areaCityIds.includes(item.id)).map(item => `${item.name}/${item.state_code}`).join(', ') || 'Locais não informados'}</p>
      <SpecialtyBadges primary={category ?? null} additional={catalog?.categories.filter(item => info.additionalCategoryIds.includes(item.id)) ?? []} />
      <p className="public-about social-profile-bio">{info.description || 'Adicione uma descrição para apresentar seu trabalho.'}</p>
      {readOnly && <div className="social-profile-actions"><button type="button" className="button button--secondary" disabled>Mensagem pelo PEREIRÃO</button><ContactLinks compact name={info.name} whatsapp={info.whatsapp || null} instagram={info.instagram || null} /></div>}
      {readOnly && <p className="field-help">Prévia: mensagens ficam disponíveis aos visitantes após publicação. Nenhuma conversa é iniciada aqui.</p>}
</header>
      <div className="form-notice social-preview-notice" role="status">{business.business.status === 'published' ? 'Perfil publicado. Você está vendo sua própria versão.' : 'Rascunho privado. Só você pode ver este perfil até a aprovação e publicação.'}</div>
      {contentError && <p className="field-help" role="status">Serviços e fotografias indisponíveis nesta prévia. Seus dados de perfil continuam visíveis.</p>}
      {presentation.error && <p role="status">Informações adicionais indisponíveis no momento.</p>}
      <PresentationSections data={presentation.data} company={info.type === 'empresa'} />
      <section className="public-profile-section" aria-label="Serviços e preços"><div className="work-toolbar"><h2>Serviços e preços</h2>{!readOnly && <Link className="button button--secondary" to={`/conta/profissional/${businessId}/servicos?acao=novo`}>Adicionar serviço</Link>}</div><p className="field-help">Valores dos serviços do profissional; não são a assinatura do PEREIRÃO.</p>{activeServices.length ? <ul className="public-services">{activeServices.map(service => <li key={service.id}><div><h3>{service.name}</h3>{service.description && <p>{service.description}</p>}</div><strong>{formatPrice(service.pricing_type, service.price_amount_cents)}</strong></li>)}</ul> : <p className="field-help">Nenhum serviço cadastrado.</p>}{!readOnly && <Link className="text-link" to={`/conta/profissional/${businessId}/servicos`}>Gerenciar serviços</Link>}</section>
      <SectionTabs label="Conteúdo do perfil" sections={[{ id: 'trabalhos', label: 'Projetos', content: <section className="public-profile-section" aria-label="Projetos e portfólio"><h2>Projetos e trabalhos</h2><p className="field-help">Foto de trabalho é uma imagem do portfólio. Publicação reúne fotos, título e legenda; salvar rascunho não publica.</p>
        {!readOnly&&<Link className="text-link" to={`/conta/profissional/${businessId}/publicacoes`}>Gerenciar todas as publicações</Link>}
        {posts.length > 0 && <ul className="owner-posts">{posts.map(post => <li key={post.id}>
          <div className="owner-posts__project">
            {post.images[0] ? <button type="button" className="owner-post-cover" aria-label={`Abrir publicação ${post.title}`} onClick={()=>setProject(post)}><ManagedPhoto businessId={businessId} photo={post.images[0]} /></button> : <span className="owner-posts__empty">Sem foto</span>}
            <button type="button" className="text-link" onClick={()=>setProject(post)}>{post.title}</button>{post.description && <p>{post.description}</p>}<small>{post.status === 'published' ? 'Publicado' : 'Rascunho privado'}</small>
          {!readOnly && <Link to={`/conta/profissional/${businessId}/editar?secao=conteudo&conteudo=publicacoes`} aria-label={`Gerenciar projeto ${post.title}`}>Editar projeto</Link>}
          </div></li>)}</ul>}
        {photos.length && work ? <ul className="portfolio-grid social-preview-grid">{photos.map(photo => <li key={photo.id}><PortfolioPhoto item={photo} repository={work} onOpen={url=>setEnlarged({id:photo.id,url})} />{photo.caption && <div className="portfolio-copy"><p>{photo.caption}</p></div>}</li>)}</ul> : <p className="field-help">Nenhuma fotografia cadastrada. Adicione fotografias de trabalhos pela área de edição.</p>}</section> }, { id: 'sobre', label: 'Sobre', content: <section className="public-profile-section" aria-label="Contato e cidades atendidas"><h2>Contato e cidades atendidas</h2><p>{info.whatsapp ? `WhatsApp: ${info.whatsapp}` : 'WhatsApp ainda não informado.'}</p>{info.instagram && <p>Instagram: @{info.instagram}</p>}<p>{catalog?.cities.filter(item => info.areaCityIds.includes(item.id)).map(item => `${item.name}/${item.state_code}`).join(', ') || 'Nenhuma cidade informada.'}</p></section> }]} />
      {adding && <Modal title="Adicionar ao perfil" onClose={()=>setAdding(false)}><nav className="profile-add-menu" aria-label="Adicionar ao perfil"><Link onClick={()=>setAdding(false)} to={`/conta/profissional/${businessId}/servicos?acao=novo`}>Adicionar serviço</Link><Link onClick={()=>setAdding(false)} to={`/conta/profissional/${businessId}/trabalhos?acao=novo`}>Adicionar foto de trabalho</Link><button type="button" onClick={creator.choose}>Adicionar publicação</button>{creator.input}</nav></Modal>}
      {creator.editor}
      {project && <Modal title={project.title} onClose={()=>setProject(null)}><p><strong>{info.name}</strong></p><p>{project.status === 'published' ? 'Publicado' : 'Rascunho privado'}</p><p className="post-full-description">{project.description || 'Esta publicação não tem legenda.'}</p><ol className="post-detail-photos">{project.images.map((image,index)=><li key={image.id}><ManagedPhoto businessId={businessId} photo={image} /><span>Foto {index+1} de {project.images.length}</span></li>)}</ol>{!readOnly&&<Link to={`/conta/profissional/${businessId}/editar?secao=conteudo&conteudo=publicacoes`}>Editar publicação</Link>}</Modal>}
      {enlarged && selectedPhoto && <WorkPhotoDetail image={<img className="preview-enlarged" src={enlarged.url} alt={selectedPhoto.caption || 'Foto de trabalho'} referrerPolicy="no-referrer" />} caption={selectedPhoto.caption} serviceAssociated={!!selectedPhoto.service_id} service={services.find(s=>s.id===selectedPhoto.service_id)?.name} onClose={()=>setEnlarged(null)} onEdit={!readOnly?()=>{setEditingPhoto(selectedPhoto);setEnlarged(null);}:undefined} />}
      {editingPhoto && work && <PhotoEditor initial={editingPhoto} services={services} onClose={()=>setEditingPhoto(null)} onSave={async(id,_file,caption,serviceId)=>{await work.savePhotoDetails(businessId,id,caption,serviceId);setPostRefresh(n=>n+1);}} />}
    </>}
  </div>;
}
