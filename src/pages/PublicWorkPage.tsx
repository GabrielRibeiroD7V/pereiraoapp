import {ReportContent} from '../components/ReportContent';
import {PostBackLink} from '../posts/PostBackLink';
import {PostManagementMenu} from '../posts/PostManagementMenu';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { useAuth } from '../auth/AuthProvider';
import { useProfessionalRepository } from '../professional/ProfessionalProvider';
import { useMarketplace } from '../marketplace/MarketplaceProvider';
import { ContactLinks } from '../marketplace/ContactLinks';
import { usePosts } from '../posts/PostsProvider';
import { PostContent } from '../posts/PostContent';
import { usePublicQuery } from '../marketplace/usePublicQuery';
import { QueryStatus } from '../marketplace/QueryStatus';
import { PublicImage } from '../marketplace/PublicImage';
import type { PostPhoto } from '../posts/types';
export function PublicWorkPage() {
  const { postId = '' } = useParams(), { publicPosts } = usePosts();
  const { session, loading: authLoading } = useAuth();
  const professional = useProfessionalRepository(), marketplace = useMarketplace();
  const [enlarged, setEnlarged] = useState<PostPhoto | null>(null);
  const [management, setManagement] = useState<{user:string; business:string; allowed:boolean}|null>(null);
  const load = useCallback((signal:AbortSignal) => publicPosts ? publicPosts.get(postId,signal) : Promise.resolve(null), [publicPosts,postId]);
  const state = usePublicQuery(postId,load), post = state.data;
  const loadProvider = useCallback((signal:AbortSignal)=> post && post.business.profilePublic!==false && marketplace ? marketplace.getProvider(post.business.slug,signal) : Promise.resolve(null),[marketplace,post?.business.slug]);
  const provider = usePublicQuery(post?.businessId ?? '',loadProvider);
  useEffect(()=>{
    let live=true;
    if(!session || !post || !professional) return;
    void professional.listMine().then(rows=>{if(live)setManagement({user:session.user.id,business:post.businessId,allowed:rows.some(row=>row.id===post.businessId)});}).catch(()=>{ /* Não assumir visitante caso não seja possível conferir o vínculo. */ });
    return ()=>{live=false;};
  },[professional,session?.user.id,post?.businessId]);
  const mine=!!(session && post && management?.user===session.user.id && management.business===post.businessId && management.allowed);
  const visitor=!authLoading && (!session || (management?.user===session.user.id && management.business===post?.businessId && !management.allowed));
  const profilePath=post ? `/prestadores/${post.business.slug}` : '';
  return <div className="public-profile public-post-page">
    <PostBackLink fallback="/"/>
    <QueryStatus {...state}/>
    {post ? <>
      <PostContent avatar={post.business.avatarPath ? <PublicImage businessId={post.businessId} path={post.business.avatarPath} alt="" avatar/> : undefined} management={mine && <PostManagementMenu><Link to={`/conta/profissional/${post.businessId}/publicacoes`}>Gerenciar publicações</Link></PostManagementMenu>} headingLevel="h1" title={post.title} description={post.description} author={post.business.name} meta={`${post.business.category} · ${post.business.city}`} createdAt={post.createdAt} publishedAt={post.publishedAt}
        images={post.images.map(photo=>({id:photo.id,content:<button type="button" className="public-gallery-open" aria-label={`Ampliar ${photo.caption ?? 'fotografia do trabalho'}`} onClick={()=>setEnlarged(photo)}><PublicImage businessId={post.businessId} path={photo.path} alt={photo.caption ?? post.title}/></button>}))}
        actions={<>
          {(mine||post.business.profilePublic!==false)&&<Link className="post-action" to={mine?`/conta/profissional/${post.businessId}/perfil`:profilePath} aria-label={`Ver perfil de ${post.business.name}`}>Ver perfil</Link>}
          {(mine||post.business.profilePublic!==false)&&<Link className="post-action" to={`${mine?`/conta/profissional/${post.businessId}/perfil`:profilePath}#servicos`}>Conferir serviços</Link>}
          {visitor && <Link className="post-action" to={post.business.profilePublic===false?`/mensagens/projeto/${post.id}`:`/mensagens/iniciar/${post.businessId}`}>Conversar</Link>}
          {visitor && post.business.profilePublic!==false && provider.data?.id===post.businessId && <ContactLinks name={post.business.name} whatsapp={provider.data.whatsapp} compact/>}
          {provider.error&&visitor&&<p role="status">Contato por WhatsApp indisponível no momento. Você pode abrir o perfil ou conversar pelo PEREIRÃO.</p>}
        </>}/>
      <ReportContent kind="post" id={post.id}/>{enlarged && <Modal title="Fotografia do trabalho" onClose={()=>setEnlarged(null)}><div className="public-enlarged"><PublicImage businessId={post.businessId} path={enlarged.path} alt={enlarged.caption ?? post.title}/></div><p><strong>{post.business.name}</strong></p><p className="post-full-description">{post.description || 'Esta publicação não tem legenda.'}</p></Modal>}
    </> : !state.loading&&!state.error&&<><PageHeader title="Trabalho indisponível"/><p>Esta publicação não está disponível publicamente.</p></>}
  </div>;
}
