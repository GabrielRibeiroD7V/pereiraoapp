import {PhotoCarousel} from '../components/PhotoCarousel';
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { UserRound } from "lucide-react";
import { usePosts } from "./PostsProvider";
import { PublicImage } from "../marketplace/PublicImage";
import type { PublishedWork, WorkCursor } from "./types";
export function WorkCard({ post }: { post: PublishedWork }) {
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
          <Link to={`/prestadores/${post.business.slug}`}>
            {post.business.name}
          </Link>
          <p>
            {post.business.category} · {post.business.city}
          </p>
        </div>
      </header>
      <PhotoCarousel label={`Fotos de ${post.title}`} items={post.images.map((photo,index)=>({id:photo.id,content:<Link className="published-work-cover" to={`/trabalhos/${post.id}`} aria-label={index===0?`Abrir trabalho ${post.title}`:`Abrir trabalho ${post.title} — foto ${index+1}`}><PublicImage businessId={post.businessId} path={photo.path} alt={photo.caption ?? post.title}/></Link>}))}/>
      <h3>
        <Link to={`/trabalhos/${post.id}`}>{post.title}</Link>
      </h3>
      {post.description && (
        <p className="published-work-summary">{post.description}</p>
      )}
      <time dateTime={post.publishedAt}>
        {new Date(post.publishedAt).toLocaleDateString("pt-BR")}
      </time>
    </article>
  );
}
export function PublishedWorks({ businessId }: { businessId?: string }) {
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
        ...(!cursor ? { items: [], available: false } : {}),
      }));
      try {
        const page = publicPosts
          ? await publicPosts.list(cursor, businessId, controller.signal)
          : null;
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
    [publicPosts, businessId],
  );
  useEffect(() => {
    void load();
    return () => {
      request.current?.abort();
      busy.current = false;
    };
  }, [load]);
  if (!publicPosts || (!state.available && !state.error && !state.loading))
    return null;
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
      <div className="published-works-grid">
        {state.items.map((post) => (
          <WorkCard key={post.id} post={post} />
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
