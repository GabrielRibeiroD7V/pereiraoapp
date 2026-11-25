import{WorkingHoursDisplay}from'../hours/WorkingHours';
import {OwnerPublication} from '../professional/OwnerPublication';
import {PostLink} from '../posts/PostLink';
import {profileViews} from '../posts/postReturn';
import {postVisibility} from '../posts/PostContent';
import {useSectionAnchor} from '../hooks/useSectionAnchor';
import {useReturnRevision} from '../hooks/useReturnRevision';
import {WorkPhotoDetail} from '../work/WorkPhotoDetail';
import {PhotoEditor} from '../work/PhotoEditor';
import { usePostCreation } from '../posts/usePostCreation';
import { PresentationIdentity } from '../presentation/PresentationIdentity';
import { BusinessStatus } from '../components/BusinessStatus';
import { Ellipsis, Flame, Wrench } from 'lucide-react';
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
import { useAuth } from '../auth/AuthProvider';
import type { EditableBusiness, ProfessionalCatalog } from '../professional/types';
import type { PortfolioRow, ServiceRow } from '../lib/database.types';

type ProfilePreviewCache = {
  business: EditableBusiness;
  catalog: ProfessionalCatalog;
  services: ServiceRow[];
  photos: PortfolioRow[];
  posts: ManagedPost[];
  postsHaveNext: boolean;
};
const profilePreviewCaches = new WeakMap<object, Map<string, ProfilePreviewCache>>();
function profileCacheFor(repository: object | null) {
  if(!repository)return null;
  let cache=profilePreviewCaches.get(repository);
  if(!cache){cache=new Map();profilePreviewCaches.set(repository,cache);}
  return cache;
}

export function ProfilePreviewPage({ businessIdOverride, embedded = false, readOnly = false }: { businessIdOverride?: string; embedded?: boolean; readOnly?: boolean } = {}) {
  const { businessId: routeBusinessId = '' } = useParams();
  const businessId = businessIdOverride ?? routeBusinessId;
  const location = useLocation();
  const viewKey=`${location.key}:${businessId}:${readOnly}`;
  const previousView=profileViews.get(viewKey);
  const resume=useReturnRevision(), lastBusiness=useRef(businessId);
  const [postRefresh,setPostRefresh]=useState(0);
  const [contentSection,setContentSection]=useState(location.hash==='#servicos'?'servicos':location.hash==='#horarios'?'sobre':previousView?.tab==='feed'?'trabalhos':previousView?.tab ?? 'trabalhos');
  useEffect(()=>{if(location.hash==='#servicos')setContentSection('servicos');else if(location.hash==='#horarios')setContentSection('sobre');},[location.hash]);
  const [adding, setAdding] = useState(false);
  const [postPage, setPostPage] = useState(previousView?.page ?? 1);
  const professional = useProfessionalRepository();
  const {session}=useAuth();
  const previewCache=profileCacheFor(professional);
  const cachedPreview = previewCache?.get(`${session?.user.id??'anonymous'}:${businessId}:${previousView?.page ?? 1}`);
  const [postsHaveNext, setPostsHaveNext] = useState(cachedPreview?.postsHaveNext ?? false);
  const [postsError, setPostsError] = useState(false);
  useEffect(()=>{profileViews.set(viewKey,{tab:contentSection,page:postPage});if(profileViews.size>40)profileViews.delete(profileViews.keys().next().value!);},[viewKey,contentSection,postPage]);
  const presentation = usePresentation(businessId);
  const work = useWorkRepository();
  const { managed: postsRepository } = usePosts();
  const [posts, setPosts] = useState<ManagedPost[]>(cachedPreview?.posts ?? []);
  const [business, setBusiness] = useState<EditableBusiness | null>(cachedPreview?.business ?? null);
  const [catalog, setCatalog] = useState<ProfessionalCatalog | null>(cachedPreview?.catalog ?? null);
  const [services, setServices] = useState<ServiceRow[]>(cachedPreview?.services ?? []);
  const [photos, setPhotos] = useState<PortfolioRow[]>(cachedPreview?.photos ?? []);
  const [enlarged, setEnlarged] = useState<{id:string;url:string} | null>(null);
  const [editingPhoto,setEditingPhoto]=useState<PortfolioRow|null>(null);
  const [loading, setLoading] = useState(!cachedPreview);
  const [error, setError] = useState('');
  const [contentError, setContentError] = useState(false);
  useSectionAnchor(!loading && !!business);
  const creator=usePostCreation(businessId,()=>setAdding(false),()=>{setPostPage(1);setPostRefresh(n=>n+1);},business?.input.name);
  useEffect(() => {
    let live = true;
    const cacheKey=`${session?.user.id??'anonymous'}:${businessId}:${postPage}`,cached=previewCache?.get(cacheKey);
    setLoading(!cached); setError(''); setContentError(false); setPostsError(false);
    if(cached){setBusiness(cached.business);setCatalog(cached.catalog);setPosts(cached.posts);setPostsHaveNext(cached.postsHaveNext);setPhotos(cached.photos);setServices(cached.services);}
    if(lastBusiness.current!==businessId){lastBusiness.current=businessId;setEnlarged(null);if(!cached){setBusiness(null);setCatalog(null);setPosts([]);setPhotos([]);setServices([]);}setPostPage(1);}
    if (!professional) { setLoading(false); return; }
    void (async()=>{
      let nextBusiness=cached?.business,nextCatalog=cached?.catalog;
      let nextServices=cached?.services??[],nextPhotos=cached?.photos??[],nextPosts=cached?.posts??[],nextPostsHaveNext=cached?.postsHaveNext??false;
      const businessTask=professional.getEditable(businessId).then(result=>{
        nextBusiness=result;
        if(live){setBusiness(result);setLoading(false);}
      });
      const catalogTask=professional.getCatalog().then(options=>{
        nextCatalog=options;
        if(live)setCatalog(options);
      }).catch(()=>{if(live)setContentError(true);});
      const workTask=work?work.list(businessId).then(content=>{
        nextServices=content.services;nextPhotos=content.photos.filter(photo=>photo.media_state==='ready');
        if(live){setServices(nextServices);setPhotos(nextPhotos);}
      }).catch(()=>{if(live)setContentError(true);}):Promise.resolve().then(()=>{if(live)setContentError(true);});
      const postsTask=postsRepository?postsRepository.load(businessId,postPage).then(page=>{
        nextPosts=page.posts.items;nextPostsHaveNext=page.posts.hasNext;
        if(live){setPosts(nextPosts);setPostsHaveNext(nextPostsHaveNext);}
      }).catch(()=>{if(live)setPostsError(true);}):Promise.resolve();
      await Promise.all([businessTask,catalogTask,workTask,postsTask]);
      if(!live||!nextBusiness||!nextCatalog)return;
      previewCache?.set(cacheKey,{business:nextBusiness,catalog:nextCatalog,services:nextServices,photos:nextPhotos,posts:nextPosts,postsHaveNext:nextPostsHaveNext});
      if(previewCache&&previewCache.size>30)previewCache.delete(previewCache.keys().next().value!);
    })().catch((cause: unknown) => { if (live) setError(professionalError(cause)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [professional, work, postsRepository, businessId, readOnly,postRefresh,resume,postPage,session?.user.id,previewCache]);
  const selectedPhoto=photos.find(p=>p.id===enlarged?.id);
  const activeServices=services.filter(service=>service.active);
  const info = business?.input;
  const category = catalog?.categories.find(item => item.id === info?.categoryId);
  const city = catalog?.cities.find(item => item.id === info?.cityId);
  const postPath=(post:ManagedPost)=>`/conta/profissional/${businessId}/${readOnly?'previa/':''}publicacoes/${post.id}`;
  const postPaging = <>{postsError && <p role="alert">Não foi possível carregar as publicações. <button type="button" className="text-link" onClick={()=>setPostRefresh(n=>n+1)}>Tentar novamente</button></p>}
    {(postPage>1||postsHaveNext)&&<div className="work-actions"><button type="button" className="button button--secondary" disabled={loading||postPage===1} onClick={()=>setPostPage(n=>n-1)}>Publicações anteriores</button><span>Página {postPage}</span><button type="button" className="button button--secondary" disabled={loading||!postsHaveNext} onClick={()=>setPostPage(n=>n+1)}>Mais publicações</button></div>}</>;
  return <div className="public-profile profile-preview">
    {!embedded && <Link className="back-link" state={{ businessId }} to={readOnly ? `/conta/profissional/${businessId}/perfil` : "/conta"}>{readOnly ? 'Voltar ao perfil' : 'Voltar à Conta'}</Link>}
    {location.state?.saved && <p role="status" className="form-notice">Perfil salvo. Seu status de publicação não mudou.</p>}
    {loading && <p role="status">Carregando prévia…</p>}
    {!professional && <p role="status">Prévia indisponível neste momento.</p>}
    {error && <p role="alert" className="form-error">{error}</p>}
    {business && info && <>
      <header className="social-profile-header social-preview-header">
        {!readOnly && !embedded && <details className="owner-settings profile-options"><summary aria-label="Opções da conta"><Ellipsis aria-hidden="true" /></summary><nav aria-label="Opções privadas"><Link to="/conta/dados">Dados da conta</Link><Link to="/conta/seguranca">Segurança e acesso</Link><Link to="/conta">Trocar perfil ou sair</Link></nav></details>}
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
      <div className="form-notice social-preview-notice" role="status">{business.business.status === 'published' ? 'Perfil publicado. Você está vendo sua própria versão.' : 'Rascunho privado. Só você pode ver este perfil. Seus posts publicados são públicos independentemente; rascunhos de posts continuam só seus.'}</div>
      {contentError && <p className="field-help" role="status">Serviços e fotografias indisponíveis nesta prévia. Seus dados de perfil continuam visíveis.</p>}
      {presentation.error && <p role="status">Informações adicionais indisponíveis no momento.</p>}
      <SectionTabs label="Conteúdo do perfil" selectedId={contentSection} onSelect={setContentSection} sections={[{ id: 'trabalhos', label: 'Trabalhos', icon: <Flame size={16} aria-hidden="true" />, content: <section className="public-profile-section" aria-label="Trabalhos"><h2>Trabalhos</h2><p className="field-help">Publicações e fotos do seu portfólio reunidas no mesmo lugar.</p>
        {!readOnly&&<Link className="text-link" to={`/conta/profissional/${businessId}/publicacoes`}>Gerenciar todas as publicações</Link>}
        <h3>Publicações</h3>
        {posts.length ? <ul className="profile-post-grid">{posts.map(post => <li key={post.id}>
          <PostLink className="profile-post-tile" aria-label={`Abrir publicação ${post.title}`} to={postPath(post)}>
            {post.images.find(image=>image.mediaState!=='pending') ? <ManagedPhoto businessId={businessId} photo={post.images.find(image=>image.mediaState!=='pending')!}/> : <span className="profile-post-tile__empty">Fotos ainda não disponíveis</span>}
            <span className="profile-post-tile__kind">Publicação{post.images.filter(image=>image.mediaState!=='pending').length>1 ? ` · ${post.images.filter(image=>image.mediaState!=='pending').length} fotos` : ''}</span>
            <strong>{post.title}</strong><small>{postVisibility(post.status)}</small>
          </PostLink>
        </li>)}</ul> : !postsError && <p className="field-help">Nenhuma publicação salva. Fotos de trabalho continuam no portfólio abaixo.</p>}
        {postPaging}
        <h3>Fotos de trabalhos</h3>
        {photos.length && work ? <ul className="portfolio-grid social-preview-grid">{photos.map(photo => <li key={photo.id}><PortfolioPhoto item={photo} repository={work} onOpen={url=>setEnlarged({id:photo.id,url})} />{photo.caption && <div className="portfolio-copy"><p>{photo.caption}</p></div>}</li>)}</ul> : <p className="field-help">Nenhuma fotografia cadastrada. Adicione fotografias de trabalhos pela área de edição.</p>}</section> }, {id:'servicos',label:'Serviços',icon:<Wrench size={16} aria-hidden="true" />,content:<section id="servicos" className="public-profile-section" aria-label="Serviços e preços"><div className="work-toolbar"><h2>Serviços e preços</h2>{!readOnly && <Link className="button button--secondary" to={`/conta/profissional/${businessId}/servicos?acao=novo`}>Adicionar serviço</Link>}</div><p className="field-help">Valores dos serviços oferecidos pelo profissional.</p>{activeServices.length ? <ul className="public-services">{activeServices.map(service => <li key={service.id}><div><h3>{service.name}</h3>{service.description && <p>{service.description}</p>}</div><strong className="service-price">{formatPrice(service.pricing_type, service.price_amount_cents)}</strong></li>)}</ul> : <p className="field-help">Nenhum serviço cadastrado.</p>}{!readOnly && <Link className="text-link" to={`/conta/profissional/${businessId}/servicos`}>Gerenciar serviços</Link>}</section> }, { id: 'sobre', label: 'Sobre', content: <section className="public-profile-section" aria-label="Contato e cidades atendidas"><h2>Contato e cidades atendidas</h2>{!readOnly&&<details className="profile-publication-settings"><summary>Gerenciar publicação do perfil</summary><OwnerPublication business={business.business} repository={professional} onChanged={()=>setPostRefresh(n=>n+1)}/></details>}{contentSection==='sobre'&&<WorkingHoursDisplay businessId={businessId}/>}<PresentationSections data={presentation.data} company={info.type === 'empresa'} /><p>{info.whatsapp ? `WhatsApp: ${info.whatsapp}` : 'WhatsApp ainda não informado.'}</p>{info.instagram && <p>Instagram: @{info.instagram}</p>}<p>{catalog?.cities.filter(item => info.areaCityIds.includes(item.id)).map(item => `${item.name}/${item.state_code}`).join(', ') || 'Nenhuma cidade informada.'}</p></section> }]} />
      {!readOnly && adding && <Modal title="Adicionar ao perfil" onClose={()=>setAdding(false)}><nav className="profile-add-menu" aria-label="Adicionar ao perfil"><Link onClick={()=>setAdding(false)} to={`/conta/profissional/${businessId}/servicos?acao=novo`}>Adicionar serviço</Link><Link onClick={()=>setAdding(false)} to={`/conta/profissional/${businessId}/trabalhos?acao=novo`}>Adicionar foto de trabalho</Link><button type="button" onClick={creator.choose}>Adicionar publicação</button>{creator.input}</nav></Modal>}
      {!readOnly && creator.editor}
      {enlarged && selectedPhoto && <WorkPhotoDetail image={<img className="preview-enlarged" src={enlarged.url} alt={selectedPhoto.caption || 'Foto de trabalho'} referrerPolicy="no-referrer" />} onCreatePost={!readOnly&&postsRepository?()=>{setEnlarged(null);creator.startWithPhoto({id:selectedPhoto.id,path:selectedPhoto.storage_path,caption:selectedPhoto.caption,kind:'portfolio'});}:undefined} caption={selectedPhoto.caption} serviceAssociated={!!selectedPhoto.service_id} service={services.find(s=>s.id===selectedPhoto.service_id)?.name} onClose={()=>setEnlarged(null)} onEdit={!readOnly?()=>{setEditingPhoto(selectedPhoto);setEnlarged(null);}:undefined} />}
      {!readOnly && editingPhoto && work && <PhotoEditor initial={editingPhoto} services={services} onClose={()=>setEditingPhoto(null)} onSave={async(id,_file,caption,serviceId)=>{await work.savePhotoDetails(businessId,id,caption,serviceId);setPostRefresh(n=>n+1);}} />}
    </>}
  </div>;
}
