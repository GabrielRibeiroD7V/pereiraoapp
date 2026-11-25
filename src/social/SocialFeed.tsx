import { PublishedWorks } from "../posts/PublishedWorks";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useReturnRevision } from "../hooks/useReturnRevision";
import { PostLink } from "../posts/PostLink";
import { PostContent } from "../posts/PostContent";
import { PostDates } from "../posts/PostDates";
import { SocialImage } from "./SocialImage";
import { useSocial } from "./SocialProvider";
import { postPath } from "./model";
import type { SocialCursor, SocialPost } from "./model";
export function SocialFeed({ authorId }: { authorId?: string }) {
  const repository = useSocial(),
    resume = useReturnRevision();
  const [cursor, setCursor] = useState<SocialCursor | null>(null),
    [items, setItems] = useState<SocialPost[]>([]),
    [hasNext, setHasNext] = useState(false),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setCursor(null);
  }, [authorId, resume, attempt]);
  useEffect(() => {
    let live = true;
    setBusy(true);
    setError(false);
    if (!cursor) setItems([]);
    if (!repository) {
      setBusy(false);
      return;
    }
    void repository
      .feed(cursor, authorId)
      .then((page) => {
        if (live) {
          setItems((old) =>
            cursor
              ? [
                  ...old,
                  ...page.items.filter(
                    (p) => !old.some((v) => v.kind === p.kind && v.id === p.id),
                  ),
                ]
              : page.items,
          );
          setHasNext(page.hasNext);
        }
      })
      .catch(() => {
        if (live) setError(true);
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [repository, cursor, authorId, resume, attempt]);
  const last = items.at(-1);
  if (!repository && !authorId) return <PublishedWorks showUnavailable />;
  return (
    <section className="published-works-section" aria-label="Feed público">
      <h2>{authorId ? "Publicações do perfil" : "Publicações recentes"}</h2>
      <p className="field-help">
        Fotos e projetos de pessoas, profissionais e empresas. Só conteúdo
        publicado aparece aqui.
      </p>
      {busy && <p role="status">Carregando publicações…</p>}
      {!busy && !error && !items.length && (
        <p>Ainda não há publicações públicas.</p>
      )}
      {error && (
        <p role="alert">
          Publicações indisponíveis agora.{" "}
          <button
            className="text-link"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Tentar novamente
          </button>
        </p>
      )}
      <div className="social-feed">
        {items.map((post) => (
          <article className="published-work" key={`${post.kind}:${post.id}`}>
            <header>
              <div>
                {post.profileUrl ? (
                  <Link to={post.profileUrl}>{post.author}</Link>
                ) : (
                  <strong>{post.author}</strong>
                )}
                <p>
                  {post.kind === "personal"
                    ? "Publicação pessoal"
                    : "Trabalho profissional"}
                </p>
              </div>
            </header>
            <PostLink
              to={postPath(post)}
              aria-label={`Abrir publicação ${post.title || post.author}`}
            >
              <div className="social-feed-cover">
                {post.images[0] && (
                  <SocialImage
                    image={post.images[0]}
                    alt={post.title || "Capa da publicação"}
                  />
                )}
              </div>
              <h3>{post.title || "Publicação pessoal"}</h3>
            </PostLink>
            <p>{post.description}</p>
            <PostDates
              createdAt={post.createdAt}
              publishedAt={post.publishedAt}
            />
            <PostLink to={postPath(post)}>
              Abrir publicação
              {post.images.length > 1 ? ` · ${post.images.length} fotos` : ""}
            </PostLink>
          </article>
        ))}
      </div>
      {hasNext && last?.publishedAt && (
        <button
          className="button button--secondary"
          disabled={busy}
          onClick={() =>
            setCursor({ time: last.publishedAt!, id: last.id, kind: last.kind })
          }
        >
          Mais publicações
        </button>
      )}
    </section>
  );
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
