import {FeedIdentity,ProfessionalFeedContact,useFeedProfiles} from './FeedIdentity';
import {PhotoCarousel} from "../components/PhotoCarousel";
import { useAuth } from "../auth/AuthProvider";
import { PublishedWorks } from "../posts/PublishedWorks";
import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useReturnRevision } from "../hooks/useReturnRevision";
import { PostLink } from "../posts/PostLink";
import { PostContent } from "../posts/PostContent";
import { PostDates } from "../posts/PostDates";
import { SocialImage } from "./SocialImage";
import { useSocial } from "./SocialProvider";
import { postPath } from "./model";
import type { SocialCursor, SocialPost } from "./model";
// Só número de páginas por entrada do histórico; sem dados privados ou URLs assinadas.
export const publicFeedPageCounts=new Map<string,number>();
const publicFeedCache=new Map<string,{items:SocialPost[];hasNext:boolean}>();
export function SocialFeed({authorId,coversOnly=false}:{authorId?:string;coversOnly?:boolean}){
 const repository=useSocial(),resume=useReturnRevision();
 const viewKey=`social:${authorId??'all'}`,restored=publicFeedCache.get(viewKey);
 const [attempt,setAttempt]=useState(0),request=useRef(0),busy=useRef(false);
 const [state,setState]=useState<{key:string;items:SocialPost[];hasNext:boolean;loading:boolean;error:boolean}>(()=>({key:viewKey,items:restored?.items??[],hasNext:restored?.hasNext??false,loading:!restored,error:false}));
 useEffect(()=>{
  const revision=++request.current;busy.current=true;
  setState(old=>old.key===viewKey?{...old,loading:old.items.length===0,error:false}:{key:viewKey,items:restored?.items??[],hasNext:restored?.hasNext??false,loading:!restored,error:false});
  if(!repository){busy.current=false;setState({key:viewKey,items:[],hasNext:false,loading:false,error:false});return;}
  void(async()=>{
   const desired=publicFeedPageCounts.get(viewKey)??1;let cursor:SocialCursor|null=null,items:SocialPost[]=[],hasNext=false;
   for(let i=0;i<desired;i++){
    const page=await repository.feed(cursor,authorId);if(request.current!==revision)return;
    items.push(...page.items.filter(p=>!items.some(v=>v.kind===p.kind&&v.id===p.id)));hasNext=page.hasNext;
    const last=page.items.at(-1);if(!hasNext||!last?.publishedAt)break;
    cursor={time:last.publishedAt,id:last.id,kind:last.kind};
   }
   if(request.current===revision){publicFeedCache.set(viewKey,{items,hasNext});if(publicFeedCache.size>20)publicFeedCache.delete(publicFeedCache.keys().next().value!);setState({key:viewKey,items,hasNext,loading:false,error:false});}
  })().catch(()=>{if(request.current===revision)setState(old=>({...old,error:true,loading:false}));}).finally(()=>{if(request.current===revision)busy.current=false;});
  return()=>{request.current++;};
 },[repository,viewKey,authorId,resume,attempt]);
 const current=state.key===viewKey?state:{key:viewKey,items:[],hasNext:false,loading:true,error:false},items=current.items,last=items.at(-1);
 const identities=useFeedProfiles(items);
 async function more(){
  if(!repository||busy.current||!last?.publishedAt)return;
  const revision=++request.current;busy.current=true;setState(old=>({...old,loading:true,error:false}));
  try{const page=await repository.feed({time:last.publishedAt,id:last.id,kind:last.kind},authorId);if(request.current!==revision)return;
   setState(old=>{const next={...old,items:[...old.items,...page.items.filter(p=>!old.items.some(v=>v.kind===p.kind&&v.id===p.id))],hasNext:page.hasNext,loading:false,error:false};publicFeedCache.set(viewKey,{items:next.items,hasNext:next.hasNext});return next;});
   publicFeedPageCounts.set(viewKey,(publicFeedPageCounts.get(viewKey)??1)+1);if(publicFeedPageCounts.size>40)publicFeedPageCounts.delete(publicFeedPageCounts.keys().next().value!);
  }catch{if(request.current===revision)setState(old=>({...old,error:true,loading:false}));}finally{if(request.current===revision)busy.current=false;}
 }
 if(!repository&&!authorId)return <PublishedWorks showUnavailable/>;
 return <section className="published-works-section" aria-label={coversOnly?'Publicações do perfil':'Feed público'}>
  <h2>{authorId?'Publicações do perfil':'Publicações recentes'}</h2>
  {current.loading&&!items.length&&<p role="status">Carregando publicações…</p>}
  {!current.loading&&!current.error&&!items.length&&<p>Ainda não há publicações públicas.</p>}
  {current.error&&<p role="alert">Publicações indisponíveis agora. <button className="text-link" onClick={()=>setAttempt(n=>n+1)}>Tentar novamente</button></p>}
  <div className={coversOnly?'profile-post-grid':'social-feed'}>{items.map(post=>coversOnly?<article key={`${post.kind}:${post.id}`}><PostLink className="profile-post-tile" to={postPath(post)} aria-label={`Abrir publicação ${post.title||post.author}`}>
   {post.images[0]&&<SocialImage image={post.images[0]} alt={post.title||'Capa da publicação'}/>}<span className="profile-post-tile__kind">{post.images.length>1?`${post.images.length} fotos`:'Publicação'}</span><strong>{post.title||'Publicação pessoal'}</strong>
  </PostLink></article>:<article className="published-work" key={`${post.kind}:${post.id}`}>
   <FeedIdentity post={post} provider={post.profileUrl?identities.profiles[post.profileUrl]:undefined}/>
   <PhotoCarousel label={`Fotos de ${post.title||post.author}`} items={post.images.map((image,i)=>({id:image.id,content:<SocialImage image={image} alt={`${post.title||'Fotografia da publicação'} — foto ${i+1}`}/>}))}/>
   <h3><PostLink to={postPath(post)}>{post.title||'Publicação pessoal'}</PostLink></h3><p>{post.description}</p><PostDates publishedAt={post.publishedAt} absolute/>{identities.canContact(post)&&<><PostContact post={post}/><ProfessionalFeedContact post={post} provider={post.profileUrl?identities.profiles[post.profileUrl]:undefined}/></>}
  </article>)}</div>
  {current.hasNext&&last?.publishedAt&&<button className="button button--secondary" disabled={current.loading} onClick={()=>void more()}>Mais publicações</button>}
 </section>;
}
export function SocialPostBody({
  post,
  management,
  actions,
}: {
  post: SocialPost;
  management?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <PostContent
      headingLevel="h1"
      title={post.title || "Publicação pessoal"}
      description={post.description}
      author={post.author}
      meta="Publicação pessoal"
      visibility={
        post.status === "published"
          ? "Publicado"
          : post.status === "draft"
            ? "Rascunho — só você vê"
            : "Fora do ar — privado"
      }
      createdAt={post.createdAt}
      publishedAt={post.publishedAt}
      images={post.images.map((image) => ({
        id: image.id,
        content: (
          <SocialImage
            image={image}
            alt={post.title || "Fotografia da publicação"}
          />
        ),
      }))}
      management={management}
      actions={actions}
    />
  );
}

export function PostContact({ post }: { post: SocialPost }) {
  const { session } = useAuth();
  if (
    post.kind !== "personal" ||
    post.status !== "published" ||
    session?.user.id === post.authorId
  )
    return null;
  return (
    <Link
      className="post-action"
      to={
        post.kind === "personal"
          ? `/mensagens/pessoa/${post.authorId}`
          : `/mensagens/projeto/${post.id}`
      }
    >
      Conversar
    </Link>
  );
}
