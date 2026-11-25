import {publicPostPageCounts} from './postReturn';
import {PostLink} from './PostLink';
import {PostDates} from './PostDates';
import {useReturnRevision} from '../hooks/useReturnRevision';
import {PhotoCarousel} from '../components/PhotoCarousel';
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { UserRound } from "lucide-react";
import { usePosts } from "./PostsProvider";
import { PublicImage } from "../marketplace/PublicImage";
import type { PublishedWork, WorkCursor } from "./types";
export function WorkCard({ post, coversOnly = false }: { post: PublishedWork; coversOnly?: boolean }) {
  if(coversOnly) return <article className="profile-post-public-tile"><PostLink className="profile-post-tile" to={`/trabalhos/${post.id}`} aria-label={`Abrir trabalho ${post.title}`}>
    {post.images[0] && <PublicImage businessId={post.businessId} path={post.images[0].path} alt={post.images[0].caption ?? post.title}/>}
    <span className="profile-post-tile__kind">Publicação{post.images.length>1?` · ${post.images.length} fotos`:''}</span><strong>{post.title}</strong>
  </PostLink></article>;
  return (
    <article className="published-work">
      <header>
        <span className="post-provider-avatar">
          {post.business.avatarPath ? (
            <PublicImage
              businessId={post.businessId}
              path={post.business.avatarPath}
              alt=""
              avatar
            />
          ) : (
            <UserRound size={18} aria-hidden="true" />
          )}
        </span>
        <div>
          {post.business.profilePublic===false?<strong>{post.business.name}</strong>:<Link to={`/prestadores/${post.business.slug}`}>{post.business.name}</Link>}
          <p>
            {post.business.category} · {post.business.city}
          </p>
        </div>
      </header>
      <PhotoCarousel label={`Fotos de ${post.title}`} items={post.images.map((photo,index)=>({id:photo.id,content:<PublicImage businessId={post.businessId} path={photo.path} alt={`${photo.caption ?? post.title} — foto ${index+1}`}/>}))}/>
      <h3>
        <PostLink to={`/trabalhos/${post.id}`}>{post.title}</PostLink>
      </h3>
      {post.description && (
        <p className="published-work-summary">{post.description}</p>
      )}
      {post.business.profilePublic!==false&&<div className="post-card-actions"><Link to={`/prestadores/${post.business.slug}`}>Ver perfil</Link><Link to={`/prestadores/${post.business.slug}#servicos`}>Conferir serviços</Link></div>}
      <PostDates publishedAt={post.publishedAt}/>
    </article>
  );
}
export function PublishedWorks({ businessId, coversOnly = false, showUnavailable = false }: { businessId?: string; coversOnly?: boolean; showUnavailable?: boolean }) {
  const resume = useReturnRevision();
  const location=useLocation(),viewKey=`${location.key}:works:${businessId??'all'}`;
  const { publicPosts } = usePosts();
  const request = useRef<AbortController | null>(null),
    busy = useRef(false);
  const [state, setState] = useState<{
    items: PublishedWork[];
    next: WorkCursor | null;
    available: boolean;
    loading: boolean;
    error: boolean;
  }>({ items: [], next: null, available: false, loading: true, error: false });
  const load = useCallback(
    async (cursor: WorkCursor | null = null) => {
      if (busy.current) return;
      busy.current = true;
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      setState((old) => ({
        ...old,
        loading: true,
        error: false,

      }));
      try {
        let page = publicPosts ? await publicPosts.list(cursor,businessId,controller.signal) : null;
        if(page&&!cursor){
          const desired=publicPostPageCounts.get(viewKey)??1;
          for(let n=1;n<desired&&page?.next;n++){
            const extra=await publicPosts!.list(page.next,businessId,controller.signal);if(controller.signal.aborted)return;if(!extra){page=null;break;}
            page={items:[...page.items,...extra.items.filter(p=>!page!.items.some(v=>v.id===p.id))],next:extra.next};
          }
        }
        if(page&&cursor&&!controller.signal.aborted){publicPostPageCounts.set(viewKey,(publicPostPageCounts.get(viewKey)??1)+1);if(publicPostPageCounts.size>40)publicPostPageCounts.delete(publicPostPageCounts.keys().next().value!);}
        if (!controller.signal.aborted)
          setState((old) => ({
            items: page
              ? cursor
                ? [
                    ...old.items,
                    ...page.items.filter(
                      (p) => !old.items.some((oldPost) => oldPost.id === p.id),
                    ),
                  ]
                : page.items
              : [],
            next: page?.next ?? null,
            available: page !== null,
            loading: false,
            error: false,
          }));
      } catch {
        if (!controller.signal.aborted)
          setState((old) => ({ ...old, loading: false, error: true }));
      } finally {
        if (request.current === controller) busy.current = false;
      }
    },
    [publicPosts, businessId, viewKey],
  );
  useEffect(() => {
    void load();
    return () => {
      request.current?.abort();
      busy.current = false;
    };
  }, [load,resume]);
  if (!publicPosts || (!state.available && !state.error && !state.loading))
    return showUnavailable ? <section className="published-works-section" aria-label="Trabalhos recentes"><h2>Trabalhos recentes</h2><p className="field-help">Trabalhos indisponíveis neste momento.</p></section> : null;
  return (
    <section
      className="published-works-section"
      aria-label={businessId ? "Trabalhos publicados" : "Trabalhos recentes"}
    >
      <h2>{businessId ? "Trabalhos publicados" : "Trabalhos recentes"}</h2>
      {state.loading && (
        <p role="status" className="field-help">
          Carregando trabalhos…
        </p>
      )}
      {state.available && state.items.length === 0 && !state.loading && (
        <p className="field-help">Novos trabalhos em breve.</p>
      )}
      <div className={coversOnly ? "profile-post-grid" : "published-works-grid"}>
        {state.items.map((post) => (
          <WorkCard key={post.id} post={post} coversOnly={coversOnly}/>
        ))}
      </div>
      {state.error ? (
        <div role="alert" className="form-error">
          Não foi possível carregar os trabalhos.
          <button className="text-link" onClick={() => void load(state.next)}>
            Tentar novamente
          </button>
        </div>
      ) : (
        state.next && (
          <button
            className="button button--secondary post-load-more"
            disabled={state.loading}
            onClick={() => void load(state.next)}
          >
            Carregar mais trabalhos
          </button>
        )
      )}
    </section>
  );
}
