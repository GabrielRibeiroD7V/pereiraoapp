import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { Modal } from "../components/Modal";
import { usePosts } from "../posts/PostsProvider";
import { usePublicQuery } from "../marketplace/usePublicQuery";
import { QueryStatus } from "../marketplace/QueryStatus";
import { PublicImage } from "../marketplace/PublicImage";
import type { PostPhoto } from "../posts/types";
export function PublicWorkPage() {
  const { postId = "" } = useParams(),
    { publicPosts } = usePosts();
  const [enlarged, setEnlarged] = useState<PostPhoto | null>(null);
  const load = useCallback(
    (signal: AbortSignal) =>
      publicPosts ? publicPosts.get(postId, signal) : Promise.resolve(null),
    [publicPosts, postId],
  );
  const state = usePublicQuery(postId, load);
  const post = state.data;
  return (
    <div className="public-profile">
      <Link className="back-link" to="/">
        Voltar ao início
      </Link>
      <QueryStatus {...state} />
      {post ? (
        <>
          <PageHeader title={post.title} />
          <Link className="text-link" to={`/prestadores/${post.business.slug}`}>
            Ver perfil de {post.business.name}
          </Link>
          <p className="field-help">
            {post.business.category} · {post.business.city}
          </p>
          <p className="public-about post-full-description">
            {post.description}
          </p>
          <ul className="public-gallery">
            {post.images.map((photo) => (
              <li key={photo.id}>
                <button
                  className="public-gallery-open"
                  aria-label={`Ampliar ${photo.caption ?? "fotografia do trabalho"}`}
                  onClick={() => setEnlarged(photo)}
                >
                  <PublicImage
                    businessId={post.businessId}
                    path={photo.path}
                    alt={photo.caption ?? post.title}
                  />
                </button>
                {photo.caption && <p>{photo.caption}</p>}
              </li>
            ))}
          </ul>
          {enlarged && (
            <Modal
              title="Fotografia do trabalho"
              onClose={() => setEnlarged(null)}
            >
              <div className="public-enlarged">
                <PublicImage
                  businessId={post.businessId}
                  path={enlarged.path}
                  alt={enlarged.caption ?? post.title}
                />
              </div>
            </Modal>
          )}
        </>
      ) : (
        !state.loading &&
        !state.error && (
          <>
            <PageHeader title="Trabalho indisponível" />
            <p>Esta publicação não está disponível publicamente.</p>
          </>
        )
      )}
    </div>
  );
}
