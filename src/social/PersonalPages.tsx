import { useCallback, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { usePersonalProfile } from "../auth/usePersonalProfile";
import { usePublicQuery } from "../marketplace/usePublicQuery";
import { QueryStatus } from "../marketplace/QueryStatus";
import { Pagination } from "../marketplace/Pagination";
import { PostBackLink } from "../posts/PostBackLink";
import { PostLink } from "../posts/PostLink";
import { PostManagementMenu } from "../posts/PostManagementMenu";
import { ReportContent } from "../components/ReportContent";
import { Modal } from "../components/Modal";
import { PersonalComposer, PersonalPublisher } from "./PersonalComposer";
import { useSocial } from "./SocialProvider";
import { SocialImage } from "./SocialImage";
import { SocialFeed, SocialPostBody } from "./SocialFeed";
import { postError } from "../posts/validation";
export function PersonalPublishingEntry() {
  const navigate = useNavigate();
  return (
    <section
      className="personal-publishing-entry"
      aria-label="Publicações da sua conta"
    >
      <h2>Suas publicações</h2>
      <p>Publique fotos e projetos sem precisar cadastrar um negócio.</p>
      <PersonalPublisher onSaved={(id) => navigate(`/publicacoes/${id}`)} />
      <Link className="text-link" to="/conta/publicacoes">
        Meu perfil pessoal e publicações
      </Link>
    </section>
  );
}
export function PersonalPostsPage() {
  const repository = useSocial(),
    navigate = useNavigate(),
    { profile } = usePersonalProfile(),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0);
  const load = useCallback(
    () => (repository ? repository.mine(page) : Promise.resolve(null)),
    [repository, page],
  );
  const state = usePublicQuery(`personal:${page}:${revision}`, load);
  return (
    <div>
      <Link className="back-link" to="/conta">
        Voltar à Conta
      </Link>
      <h1>Meu perfil pessoal</h1>
      <h2>{profile.displayName}</h2>
      <PersonalPublisher
        onSaved={(id) => {
          setRevision((n) => n + 1);
          navigate(`/publicacoes/${id}`);
        }}
      />
      <p>
        Seu perfil pessoal não exige serviços. Rascunhos são privados; publicar
        é sua decisão.
      </p>
      <QueryStatus {...state} />
      {!repository && (
        <p role="status">Publicações indisponíveis no momento.</p>
      )}
      <ul className="profile-post-grid">
        {state.data?.items.map((post) => (
          <li key={post.id}>
            <PostLink
              className="profile-post-tile"
              to={`/publicacoes/${post.id}`}
            >
              {post.images[0] && (
                <SocialImage
                  image={post.images[0]}
                  alt={post.title || "Publicação pessoal"}
                />
              )}
              <strong>{post.title || "Publicação pessoal"}</strong>
              <span>
                {post.deleting
                  ? "Exclusão pendente"
                  : post.status === "published"
                    ? "Publicado"
                    : post.status === "draft"
                      ? "Rascunho — só você vê"
                      : "Fora do ar"}
              </span>
            </PostLink>
          </li>
        ))}
      </ul>
      {state.data && !state.data.items.length && (
        <p>Nenhuma publicação pessoal salva.</p>
      )}
      {state.data && (
        <Pagination
          page={page}
          hasNext={state.data.hasNext}
          onChange={setPage}
          label="publicações pessoais"
        />
      )}
    </div>
  );
}
export function PersonalProfilePage() {
  const { authorId } = useParams();
  return (
    <div>
      <PostBackLink fallback="/" />
      <h1>Publicações do perfil</h1>
      <SocialFeed authorId={authorId} />
    </div>
  );
}
export function PersonalPostPage() {
  const { postId = "" } = useParams(),
    [params] = useSearchParams(),
    repository = useSocial(),
    { session } = useAuth(),
    navigate = useNavigate();
  const [revision, setRevision] = useState(0),
    [editing, setEditing] = useState(false),
    [action, setAction] = useState<"publish" | "unpublish" | "delete" | null>(
      null,
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = useCallback(
    () => (repository ? repository.get(postId) : Promise.resolve(null)),
    [repository, postId],
  );
  const state = usePublicQuery(
      `personal-post:${postId}:${revision}:${session?.user.id ?? "visitor"}`,
      load,
    ),
    post = state.data,
    mine =
      !!post &&
      session?.user.id === post.authorId &&
      params.get("visao") !== "visitante";
  return (
    <div className="public-post-page">
      <PostBackLink fallback="/conta/publicacoes" />
      <QueryStatus {...state} />
      {!state.loading && !state.error && !post && (
        <p>Publicação indisponível. Rascunhos são privados.</p>
      )}
      {post && (
        <>
          <SocialPostBody
            post={post}
            management={
              mine && (
                <PostManagementMenu>
                  {!post.deleting && (
                    <button
                      className="text-link"
                      onClick={() => setEditing(true)}
                    >
                      Editar publicação
                    </button>
                  )}
                  {!post.deleting && (
                    <button
                      className="text-link"
                      onClick={() => {
                        setError("");
                        setAction(
                          post.status === "published" ? "unpublish" : "publish",
                        );
                      }}
                    >
                      {post.status === "published"
                        ? "Retirar do ar"
                        : "Publicar"}
                    </button>
                  )}
                  <button
                    className="text-link"
                    onClick={() => {
                      setError("");
                      setAction("delete");
                    }}
                  >
                    {post.deleting ? "Concluir exclusão" : "Excluir publicação"}
                  </button>
                </PostManagementMenu>
              )
            }
            actions={
              <>
                {mine ? (
                  <Link to={`/publicacoes/${post.id}?visao=visitante`}>
                    Ver como visitante
                  </Link>
                ) : (
                  post.profileUrl && (
                    <Link to={post.profileUrl}>Ver perfil</Link>
                  )
                )}
              </>
            }
          />
          {post.status !== "published" && (
            <p className="form-notice">
              Este conteúdo não está no feed público. A prévia autenticada não
              torna o rascunho público.
            </p>
          )}
          {post.status === "published" && (
            <ReportContent kind="personal_post" id={post.id} />
          )}{" "}
          {editing && mine && (
            <PersonalComposer
              initial={post}
              onClose={() => setEditing(false)}
              onSaved={() => {
                setEditing(false);
                setRevision((n) => n + 1);
              }}
            />
          )}
          {action && mine && (
            <Modal
              title={
                action === "delete"
                  ? "Excluir publicação?"
                  : action === "publish"
                    ? "Publicar agora?"
                    : "Retirar do ar?"
              }
              locked={busy}
              onClose={() => setAction(null)}
            >
              <p>
                {action === "publish"
                  ? "As fotos, o título, a legenda e seu nome de autor ficarão públicos imediatamente no perfil e no feed. Não há aprovação prévia."
                  : action === "delete"
                    ? "A publicação sairá do ar e suas imagens pessoais serão removidas pelo Storage. Se houver falha, a exclusão ficará pendente para você concluir."
                    : "A publicação deixará de aparecer no perfil público e no feed."}
              </p>
              {error && <p role="alert">{error}</p>}
              <div className="work-actions">
                <button
                  className="button button--secondary"
                  disabled={busy}
                  onClick={() => setAction(null)}
                >
                  Cancelar
                </button>
                <button
                  className="button button--primary"
                  disabled={busy}
                  onClick={() => {
                    if (!repository || busy) return;
                    setBusy(true);
                    void repository
                      .command(post.id, action)
                      .then(() => {
                        setAction(null);
                        if (action === "delete") navigate("/conta/publicacoes");
                        else setRevision((n) => n + 1);
                      })
                      .catch((e) => {
                        setError(postError(e));
                        setRevision((n) => n + 1);
                      })
                      .finally(() => setBusy(false));
                  }}
                >
                  Confirmar
                </button>
              </div>
            </Modal>
          )}
        </>
      )}
    </div>
  );
}
