import {PostOffer} from '../offers/PostOffer';
import {useCallback,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {useProfessionalRepository} from '../professional/ProfessionalProvider';
import {usePosts} from '../posts/PostsProvider';
import {usePublicQuery} from '../marketplace/usePublicQuery';
import {QueryStatus} from '../marketplace/QueryStatus';
import {PostContent,postVisibility} from '../posts/PostContent';
import {PostBackLink} from '../posts/PostBackLink';
import {PostManagementMenu} from '../posts/PostManagementMenu';
import {ManagedPhoto} from '../posts/ManagedPhoto';
import {ManagedBusinessAvatar} from '../work/ManagedBusinessAvatar';
import {effectiveAvatarPath} from '../lib/mediaPath';
import {PostEditor} from '../posts/PostEditor';
export function ManagedPostPage({readOnly=false}:{readOnly?:boolean}){
 const {businessId='',postId=''}=useParams(),professional=useProfessionalRepository(),{managed}=usePosts();
 const [editing,setEditing]=useState(false);
 const load=useCallback(async(signal:AbortSignal)=>{
  if(!professional||!managed)return null;
  const [business,post]=await Promise.all([professional.getEditable(businessId),managed.get(businessId,postId,signal)]);
  return post&&post.business_id===businessId?{business,post}:null;
 },[professional,managed,businessId,postId]);
 const state=usePublicQuery(`${businessId}:${postId}`,load),data=state.data;
 const profile=`/conta/profissional/${businessId}/${readOnly?'previa':'perfil'}`;
 return <div className="public-profile public-post-page"><PostBackLink fallback={profile}/><QueryStatus {...state}/>
  {data?<><PostContent headingLevel="h1" title={data.post.title} description={data.post.description} author={data.business.input.name} visibility={postVisibility(data.post.status)} createdAt={data.post.created_at} publishedAt={data.post.published_at}
    avatar={<ManagedBusinessAvatar path={effectiveAvatarPath(data.business.business)}/>}
    management={!readOnly&&<PostManagementMenu><button type="button" onClick={()=>setEditing(true)}>Editar publicação</button><Link to={`/conta/profissional/${businessId}/publicacoes`}>Gerenciar publicações</Link></PostManagementMenu>}
    images={data.post.images.filter(photo=>photo.mediaState!=='pending').map(photo=>({id:photo.id,content:<ManagedPhoto businessId={businessId} photo={photo}/>}))}
    actions={<><Link className="post-action" to={profile}>Ver perfil</Link><Link className="post-action" to={`${profile}#servicos`}>Conferir serviços</Link></>}/>
    <PostOffer post={postId} kind="professional" business={businessId} manage={!readOnly}/>{!readOnly&&editing&&<PostEditor businessId={businessId} businessName={data.business.input.name} initial={data.post} onClose={()=>setEditing(false)} onSave={async(id,input)=>{await managed!.save(businessId,id,input);state.retry();}}/>}
  </>:!state.loading&&!state.error&&<p>Publicação indisponível para esta conta.</p>}
 </div>;
}
