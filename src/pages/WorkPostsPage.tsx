import { useCallback, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { Modal } from "../components/Modal";
import { useAuth } from "../auth/AuthProvider";
import { usePosts } from "../posts/PostsProvider";
import { usePublicQuery } from "../marketplace/usePublicQuery";
import { QueryStatus } from "../marketplace/QueryStatus";
import { Pagination } from "../marketplace/Pagination";
import { PostEditor } from "../posts/PostEditor";
import { postError } from "../posts/validation";
import type { ManagedPost } from "../posts/types";
const labels = {
  draft: "Rascunho",
  published: "Publicado",
  unpublished: "Fora de circulação",
};
export function WorkPostsPage({ embedded = false, onChanged }: { embedded?: boolean; onChanged?: () => void } = {}) {
  const { businessId = "" } = useParams(),
    { session } = useAuth(),
    { managed } = usePosts();
  const [page, setPage] = useState(1),
    [editor, setEditor] = useState<ManagedPost | "new" | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    post: ManagedPost;
    command: "publish" | "unpublish" | "delete";
  } | null>(null);
  const busy = useRef(false);
  const load = useCallback(
    async (signal: AbortSignal) => {
      if (!managed) return null;
      try {
        return await managed.load(businessId, page, signal);
      } catch (e) {
        if (
          e &&
          typeof e === "object" &&
          "code" in e &&
          e.code === "SETUP_REQUIRED"
        )
          return null;
        throw e;
      }
    },
    [managed, businessId, page],
  );
  const state = usePublicQuery(
    JSON.stringify([businessId, session?.user.id, page]),
    load,
  );
  async function act() {
    if (!confirm || !managed || busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      await managed.command(businessId, confirm.post.id, confirm.command);
      setConfirm(null);
      state.retry(); onChanged?.();
    } catch (e) {
      setError(postError(e));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <div className="managed-posts">
      {!embedded && <Link
        className="back-link"
        to={`/conta/profissional/${businessId}/editar?secao=conteudo&conteudo=publicacoes`}
      >
        Voltar a editar perfil
      </Link>}
      {embedded ? <h3>Publicações</h3> : <PageHeader title="Publicações">
        <p>Apresente trabalhos realizados pelo seu negócio.</p>
      </PageHeader>}
      <QueryStatus {...state} />
      {!state.loading && !state.error && !state.data && (
        <p role="status" className="form-notice">
          As publicações estão sendo preparadas. Seu portfólio continua
          disponível.
        </p>
      )}
      {state.data && (
        <>
          <p className="field-help">{state.data.business.name}</p>
          {state.data.business.status !== "published" && (
            <p className="form-notice">
              Você pode preparar rascunhos. A publicação de trabalhos estará
              disponível quando seu perfil estiver publicado.
            </p>
          )}
          <button
            className="button button--primary"
            disabled={pending || state.loading}
            onClick={() => setEditor("new")}
          >
            Nova publicação
          </button>
          {state.data.posts.items.length === 0 && (
            <p className="post-empty">
              Nenhum trabalho publicado ou em rascunho. Escolha fotos do seu
              portfólio para começar.
            </p>
          )}
          <ul className="managed-post-list">
            {state.data.posts.items.map((post) => (
              <li key={post.id}>
                <div>
                  <h2>{post.title}</h2>
                  <p>
                    {labels[post.status]} · {post.images.length}{" "}
                    {post.images.length === 1 ? "fotografia" : "fotografias"}
                  </p>
                </div>
                <div className="managed-post-actions">
                  <button
                    className="text-link"
                    disabled={pending}
                    onClick={() => setEditor(post)}
                  >
                    Editar<span className="visually-hidden"> {post.title}</span>
                  </button>
                  {post.status === "published" ? (
                    <button
                      className="text-link"
                      disabled={pending}
                      onClick={() => setConfirm({ post, command: "unpublish" })}
                    >
                      Retirar de circulação
                    </button>
                  ) : (
                    <button
                      className="button button--secondary"
                      disabled={
                        pending ||
                        state.data!.business.status !== "published" ||
                        post.images.length === 0
                      }
                      onClick={() => setConfirm({ post, command: "publish" })}
                    >
                      Publicar trabalho
                    </button>
                  )}
                  <button
                    className="text-link"
                    disabled={pending}
                    onClick={() => setConfirm({ post, command: "delete" })}
                  >
                    Excluir
                    <span className="visually-hidden"> {post.title}</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <Pagination
            page={page}
            hasNext={state.data.posts.hasNext}
            onChange={setPage}
            label="publicações"
          />
          {editor && (
            <PostEditor
              key={editor === "new" ? "new" : editor.id}
              businessId={businessId}
              initial={editor === "new" ? undefined : editor}
              onClose={() => setEditor(null)}
              onSave={async (id, input) => {
                await managed!.save(businessId, id, input);
                state.retry(); onChanged?.();
              }}
            />
          )}
        </>
      )}
      {confirm && (
        <Modal
          title={
            confirm.command === "delete"
              ? "Excluir publicação?"
              : confirm.command === "publish"
                ? "Publicar trabalho?"
                : "Retirar trabalho de circulação?"
          }
          locked={pending}
          onClose={() => {
            setConfirm(null);
            setError(null);
          }}
        >
          <p>{confirm.post.title}</p>
          <p className="field-help">
            {confirm.command === "delete"
              ? "As fotografias originais do portfólio serão preservadas."
              : confirm.command === "publish"
                ? "O trabalho ficará visível aos visitantes. Isso não altera o status do perfil profissional."
                : "O trabalho deixará de aparecer publicamente."}
          </p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="work-actions">
            <button
              className="button button--secondary"
              disabled={pending}
              onClick={() => setConfirm(null)}
            >
              Cancelar
            </button>
            <button
              className="button button--primary"
              disabled={pending}
              onClick={() => void act()}
            >
              {pending ? "Aguarde…" : "Confirmar"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
