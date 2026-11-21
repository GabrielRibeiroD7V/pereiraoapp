import { useCallback, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Modal } from "../components/Modal";
import { usePublicQuery } from "../marketplace/usePublicQuery";
import { Pagination } from "../marketplace/Pagination";
import { QueryStatus } from "../marketplace/QueryStatus";
import { usePosts } from "./PostsProvider";
import { ManagedPhoto } from "./ManagedPhoto";
import { postError, validatePost } from "./validation";
import type { ManagedPost, PostInput, PostPhoto } from "./types";
export function PostEditor({
  businessId,
  initial,
  onClose,
  onSave,
}: {
  businessId: string;
  initial?: ManagedPost;
  onClose: () => void;
  onSave: (id: string, input: PostInput) => Promise<void>;
}) {
  const { managed } = usePosts();
  const [id] = useState(() => initial?.id ?? crypto.randomUUID());
  const [input, setInput] = useState<PostInput>({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    photos: initial?.images ?? [],
  });
  const [page, setPage] = useState(1),
    [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const load = useCallback(
    (signal: AbortSignal) => managed!.photos(businessId, page, signal),
    [managed, businessId, page],
  );
  const choices = usePublicQuery(`${businessId}:${page}`, load);
  function toggle(photo: PostPhoto) {
    setError(null);
    setInput((old) => ({
      ...old,
      photos: old.photos.some((p) => p.id === photo.id)
        ? old.photos.filter((p) => p.id !== photo.id)
        : old.photos.length < 6
          ? [...old.photos, photo]
          : old.photos,
    }));
  }
  function move(index: number, direction: number) {
    setInput((old) => {
      const values = [...old.photos],
        target = index + direction;
      if (target < 0 || target >= values.length) return old;
      [values[index], values[target]] = [values[target]!, values[index]!];
      return { ...old, photos: values };
    });
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    const issue = validatePost(input);
    if (issue) {
      setError(issue);
      return;
    }
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      await onSave(id, input);
      onClose();
    } catch (e) {
      setError(postError(e));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <Modal
      title={initial ? "Editar publicação" : "Nova publicação"}
      onClose={onClose}
      locked={pending}
    >
      <form className="auth-form" onSubmit={submit}>
        <fieldset className="work-fields" disabled={pending}>
          <div className="form-field">
            <label htmlFor="post-title">Título do trabalho</label>
            <input
              id="post-title"
              value={input.title}
              maxLength={120}
              minLength={2}
              required
              onChange={(e) => setInput({ ...input, title: e.target.value })}
            />
          </div>
          <div className="form-field">
            <label htmlFor="post-description">Descrição do trabalho</label>
            <textarea
              id="post-description"
              value={input.description}
              maxLength={3000}
              rows={3}
              onChange={(e) =>
                setInput({ ...input, description: e.target.value })
              }
            />
          </div>
          <p className="field-help">
            Selecione até seis fotografias disponíveis do seu portfólio. Salvar
            não publica o trabalho.
          </p>
          {initial?.status === "published" && (
            <p className="form-notice">
              Ao salvar alterações, este trabalho sairá de circulação até você
              publicá-lo novamente.
            </p>
          )}
          <QueryStatus {...choices} />
          {choices.data && (
            <>
              <fieldset className="post-photo-choices">
                <legend>Fotografias do seu portfólio</legend>
                {choices.data.items.length === 0 ? (
                  <p className="field-help">
                    Adicione fotografias em Meus trabalhos para selecioná-las
                    aqui.
                  </p>
                ) : (
                  <div>
                    {choices.data.items.map((photo) => (
                      <label key={photo.id}>
                        <span className="post-choice-image">
                          <ManagedPhoto businessId={businessId} photo={photo} />
                        </span>
                        <input
                          type="checkbox"
                          aria-label={`Selecionar ${photo.caption ?? photo.id}`}
                          checked={input.photos.some((p) => p.id === photo.id)}
                          disabled={
                            !input.photos.some((p) => p.id === photo.id) &&
                            input.photos.length >= 6
                          }
                          onChange={() => toggle(photo)}
                        />
                        <span>
                          {photo.caption ?? "Fotografia do portfólio"}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>
              <Pagination
                page={page}
                hasNext={choices.data.hasNext}
                onChange={setPage}
                label="fotos do portfólio"
              />
            </>
          )}
          {input.photos.length > 0 && (
            <div>
              <h3 className="post-order-title">Ordem das imagens</h3>
              <ol className="post-image-order">
                {input.photos.map((photo, index) => (
                  <li key={photo.id}>
                    <span>{photo.caption ?? `Fotografia ${index + 1}`}</span>
                    <div>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Mover imagem ${index + 1} para antes`}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Mover imagem ${index + 1} para depois`}
                        disabled={index === input.photos.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Remover imagem ${index + 1} da seleção`}
                        onClick={() => toggle(photo)}
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </fieldset>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="work-actions">
          <button
            className="button button--secondary"
            type="button"
            disabled={pending}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button className="button button--primary" disabled={pending}>
            {pending ? "Salvando…" : "Salvar rascunho"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
