import {useCallback} from 'react';
import {UserRound} from 'lucide-react';
import {useAuth} from '../auth/AuthProvider';
import {useProfessionalRepository} from '../professional/ProfessionalProvider';
import {useMarketplace} from '../marketplace/MarketplaceProvider';
import {usePublicQuery} from '../marketplace/usePublicQuery';
import {PublicImage} from '../marketplace/PublicImage';
import {whatsappLink} from '../marketplace/validation';
import {PostLink} from '../posts/PostLink';
import {Link} from 'react-router-dom';
import type{PublicProvider}from'../marketplace/types';
import type{SocialPost}from'./model';

// Consulta somente a projeção pública: nunca busca o negócio privado de um post.
// Autores repetidos compartilham a consulta nesta lista; nada é salvo no Storage/cache.
export function useFeedProfiles(posts:SocialPost[]){
 const repository=useMarketplace(),professional=useProfessionalRepository(),{session}=useAuth();
 const paths=JSON.stringify([...new Set(posts.filter(p=>p.kind==='professional'&&p.profileUrl?.startsWith('/prestadores/')).map(p=>p.profileUrl!))].sort());
 const load=useCallback(async(signal:AbortSignal)=>{
  const result:Record<string,PublicProvider>={};if(!repository)return result;
  const urls=JSON.parse(paths) as string[];
  for(let n=0;n<urls.length;n+=4){
   await Promise.all(urls.slice(n,n+4).map(async path=>{
    const slug=/^\/prestadores\/([^/?#]+)$/.exec(path)?.[1];if(!slug)return;
    try{const provider=await repository.getProvider(decodeURIComponent(slug),signal);if(provider)result[path]=provider;}catch{/* Perfil indisponível: não inventar foto ou contato. */}
   }));if(signal.aborted)break;
  }
  return result;
 },[repository,paths]);
 const profiles=usePublicQuery(paths,load,true);
 const mineLoad=useCallback(async()=>session&&professional?(await professional.listMine()).map(b=>b.id):[],[session?.user.id,professional]);
 const mine=usePublicQuery(session?.user.id??'anonymous',mineLoad);
 return{profiles:profiles.data??{},canContact:(post:SocialPost)=>!session||(post.kind==='personal'?post.authorId!==session.user.id:!!professional&&!!mine.data&&!mine.error&&!mine.data.includes(post.businessId??''))};
}
export function FeedIdentity({post,provider}:{post:SocialPost;provider?:PublicProvider}){
 const identity=<><span className="post-provider-avatar">{provider?.avatarPath?<PublicImage businessId={provider.id} path={provider.avatarPath} alt="" avatar/>:<UserRound size={20} aria-hidden="true"/>}</span><span><strong>{post.author}</strong><small>{post.kind==='personal'?'Publicação pessoal':'Trabalho profissional'}</small></span></>;
 return <header className="feed-author">{post.profileUrl?<PostLink to={post.profileUrl} aria-label={post.author}>{identity}</PostLink>:<div>{identity}</div>}</header>;
}
export function ProfessionalFeedContact({post,provider}:{post:SocialPost;provider?:PublicProvider}){
 if(post.kind!=='professional'||post.status!=='published')return null;
 const conversation=`/mensagens/projeto/${post.id}`,phone=provider?whatsappLink(provider.whatsapp,post.author):null;
 return <div className="feed-contact-actions">
  {phone?<a href={phone} target="_blank" rel="noopener noreferrer">Entrar em contato <span className="visually-hidden">pelo WhatsApp (abre em nova guia)</span></a>:<Link to={conversation}>Entrar em contato</Link>}
  {provider&&<Link to={conversation} aria-label={`Solicitar orçamento a ${post.author}`} title="Abrir conversa para explicar o serviço e pedir um orçamento">Solicitar orçamento</Link>}
 </div>;
}
