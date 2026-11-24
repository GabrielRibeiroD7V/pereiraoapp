import { PhotoCarousel } from "../components/PhotoCarousel";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Modal } from "../components/Modal";
import { usePosts } from "./PostsProvider";
import { ManagedPhoto } from "./ManagedPhoto";
import { optimizeImage } from "../work/images";
import { postError, validatePost } from "./validation";
import type { ManagedPost, PostInput, PostPhoto } from "./types";
type LocalPhoto = PostPhoto & { blob?: Blob; preview?: string };
export function PostEditor({
  businessId,
  businessName,
  initial,
  initialFiles = [],
  initialPhotos = [],
  initialDescription = "",
  onClose,
  onSave,
}: {
  businessId: string;
  businessName?: string;
  initial?: ManagedPost;
  initialFiles?: File[];
  initialPhotos?: PostPhoto[];
  initialDescription?: string;
  onClose: () => void;
  onSave: (id: string, input: PostInput) => Promise<void>;
}) {
  const { managed } = usePosts();
  const [id] = useState(() => initial?.id ?? crypto.randomUUID());
  const [photos, setPhotos] = useState<LocalPhoto[]>(
      initial?.images ?? initialPhotos,
    ),
    [title, setTitle] = useState(initial?.title ?? ""),
    [description, setDescription] = useState(
      initial?.description ?? initialDescription,
    );
  const [step, setStep] = useState<"photos" | "details">(
      initial ? "details" : "photos",
    ),
    [preparing, setPreparing] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [attempted, setAttempted] = useState(false),
    [ready, setReady] = useState<boolean | null>(null);
  const fileInput = useRef<HTMLInputElement>(null),
    replacement = useRef<string | null>(null),
    busy = useRef(false),
    generation = useRef(0),
    urls = useRef<string[]>([]);
  useEffect(() => {
    let live = true;
    void managed
      ?.directPhotosAvailable?.()
      .then((value) => {
        if (live) setReady(value);
      })
      .catch(() => {
        if (live) setReady(false);
      });
    return () => {
      live = false;
      generation.current++;
      urls.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [managed]);
  async function prepare(files: File[], replaceId: string | null = null) {
    if (!files.length) return;
    if (files.length + (replaceId ? photos.length - 1 : photos.length) > 6) {
      setError("Escolha no máximo seis fotos por publicação.");
      return;
    }
    const token = ++generation.current;
    setPreparing(true);
    setError("");
    try {
      const prepared: LocalPhoto[] = [];
      for (const file of files) {
        const blob = await optimizeImage(file);
        if (token !== generation.current) return;
        const photoId = replaceId ?? crypto.randomUUID(),
          url = URL.createObjectURL(blob);
        urls.current.push(url);
        prepared.push({
          id: photoId,
          path: `${businessId}/posts/${photoId}.webp`,
          caption: null,
          kind: "post",
          mediaState: "pending",
          blob,
          preview: url,
        });
      }
      if (token === generation.current)
        setPhotos((old) =>
          replaceId
            ? old.map((p) => (p.id === replaceId ? prepared[0]! : p))
            : [...old, ...prepared],
        );
    } catch (cause) {
      if (token === generation.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível preparar a foto.",
        );
    } finally {
      if (token === generation.current) setPreparing(false);
    }
  }
  useEffect(() => {
    if (initialFiles.length) void prepare(initialFiles);
  }, []);
  function choose(replaceId: string | null = null) {
    replacement.current = replaceId;
    if (fileInput.current) {
      fileInput.current.value = "";
      fileInput.current.click();
    }
  }
  function move(index: number, by: number) {
    setPhotos((old) => {
      const next = [...old],
        target = index + by;
      if (target < 0 || target >= next.length) return old;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current || preparing) return;
    const input: PostInput = { title, description, photos };
    const issue = validatePost(input);
    if (issue) {
      setError(issue);
      return;
    }
    if (!photos.length) {
      setError("Escolha pelo menos uma fotografia.");
      setStep("photos");
      return;
    }
    if (
      photos.some((p) => p.kind === "post") &&
      (!ready || !managed?.uploadPostPhoto)
    ) {
      setError(
        "Envio direto de fotos aguarda a ativação autorizada do armazenamento. Nenhuma imagem foi enviada.",
      );
      return;
    }
    if (photos.some((p) => p.mediaState === "pending" && !p.blob)) {
      setError(
        "Reescolha o arquivo original da foto pendente para recuperar o envio.",
      );
      setStep("photos");
      return;
    }
    busy.current = true;
    setPending(true);
    setAttempted(true);
    setError("");
    try {
      for (const p of photos) {
        if (p.blob) {
          await managed!.uploadPostPhoto!(businessId, id, p.id, p.blob, input);
          p.mediaState = "ready";
        }
      }
      await onSave(id, {
        ...input,
        photos: photos.map(({ blob, preview, ...p }) => p),
      });
      onClose();
    } catch (cause) {
      setError(
        `${postError(cause)} A composição permanece aberta; tente salvar novamente sem escolher as mesmas fotos outra vez.`,
      );
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
      <form className="post-composer" data-step={step} onSubmit={submit}>
        <p className="field-help">
          {step === "photos" ? "1. Fotos" : "2. Descrição e prévia"} · até seis
          imagens. Foto principal e portfólio não serão alterados.
        </p>
        <input
          ref={fileInput}
          type="file"
          hidden
          multiple
          accept="image/jpeg,image/png,image/webp"
          aria-label="Fotos da publicação"
          onChange={(e) => {
            const files = Array.from(e.currentTarget.files ?? []);
            e.currentTarget.value = "";
            void prepare(
              replacement.current ? files.slice(0, 1) : files,
              replacement.current,
            );
          }}
        />
        <div className="post-composer__photo-toolbar">
          {" "}
          <button
            type="button"
            className="button button--secondary post-add-photos"
            disabled={pending || preparing || photos.length >= 6}
            onClick={() => choose()}
          >
            {preparing
              ? "Preparando fotos…"
              : photos.length
                ? "Adicionar outras fotos"
                : "Escolher uma ou até seis fotos"}
          </button>
          <span>{photos.length} de 6 fotos selecionadas</span>
          <p className="field-help">
            No seletor do aparelho, selecione uma ou várias fotos. Você controla
            quais arquivos o site recebe.
          </p>
        </div>
        {step === "photos" ? (
          <>
            <div className="post-composer__photos">
              {photos.map((p, index) => (
                <figure key={p.id}>
                  {p.preview ? (
                    <img src={p.preview} alt={`Prévia da foto ${index + 1}`} />
                  ) : p.mediaState === "pending" ? (
                    <p>Envio pendente: reescolha o arquivo original.</p>
                  ) : (
                    <ManagedPhoto businessId={businessId} photo={p} />
                  )}
                  <figcaption>Foto {index + 1}</figcaption>
                  <div className="post-composer__photo-actions">
                    <button
                      type="button"
                      disabled={pending || preparing || index === 0}
                      aria-label={`Mover imagem ${index + 1} para antes`}
                      onClick={() => move(index, -1)}
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      disabled={
                        pending || preparing || index === photos.length - 1
                      }
                      aria-label={`Mover imagem ${index + 1} para depois`}
                      onClick={() => move(index, 1)}
                    >
                      →
                    </button>
                    <button
                      type="button"
                      disabled={pending || preparing}
                      aria-label={`Remover imagem ${index + 1} da seleção`}
                      onClick={() =>
                        setPhotos((old) =>
                          old.filter((item) => item.id !== p.id),
                        )
                      }
                    >
                      Remover
                    </button>
                    {p.mediaState === "pending" && !p.blob && (
                      <button type="button" onClick={() => choose(p.id)}>
                        Reescolher arquivo
                      </button>
                    )}
                  </div>
                </figure>
              ))}
            </div>
            <p className="field-help">
              JPEG, PNG ou WebP, até 10 MB por arquivo antes da preparação.
              HEIC/HEIF não é suportado.
            </p>
          </>
        ) : (
          <>
            <div className="form-field">
              <label htmlFor="post-description">
                Legenda ou descrição da publicação
              </label>
              <textarea
                id="post-description"
                value={description}
                maxLength={3000}
                rows={3}
                disabled={pending}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="post-title">Título do trabalho</label>
              <input
                id="post-title"
                value={title}
                maxLength={120}
                minLength={2}
                required
                disabled={pending}
                onChange={(e) => setTitle(e.target.value)}
              />
              <p className="field-help">
                Título obrigatório no modelo atual; não é sua bio.
              </p>
            </div>
            <section
              className="post-composer__preview"
              aria-label="Prévia da publicação"
            >
              <h3>Prévia no perfil e em Trabalhos recentes</h3>
              <p>
                <strong>{businessName ?? "Perfil do negócio"}</strong>
              </p>
              <p className="field-help">
                Rascunho privado. Ainda não foi publicado.
              </p>
              <PhotoCarousel
                label="Todas as fotos da prévia"
                items={photos.map((photo, i) => ({
                  id: photo.id,
                  content: photo.preview ? (
                    <img src={photo.preview} alt={`Prévia da foto ${i + 1}`} />
                  ) : photo.mediaState === "pending" ? (
                    <p>Foto pendente de envio</p>
                  ) : (
                    <ManagedPhoto businessId={businessId} photo={photo} />
                  ),
                }))}
              />
              <strong>{title || "Título da publicação"}</strong>
              <p>{description || "Sua legenda aparecerá aqui."}</p>
              <p className="field-help">
                A primeira foto será a capa. Deslize ou use as setas para
                conferir todas antes de salvar.
              </p>
            </section>
          </>
        )}
        {initial?.status === "published" && (
          <p className="form-notice">
            Salvar alterações retira este trabalho de circulação até uma nova
            publicação explícita.
          </p>
        )}
        {ready === false && (
          <p role="status">
            A seleção e a prévia estão disponíveis; o envio direto aguarda a
            migração autorizada.
          </p>
        )}
        {attempted && error && (
          <p className="field-help">
            Se parte do envio já chegou ao servidor, o rascunho técnico é
            preservado. Reabrir a edição recupera as fotos preparadas; arquivos
            pendentes podem exigir nova seleção. Cancelar não apaga registros ou
            arquivos.
          </p>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="work-actions">
          <button
            type="button"
            className="button button--secondary"
            disabled={pending}
            onClick={onClose}
          >
            Cancelar
          </button>
          {step === "photos" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={pending || preparing || !photos.length}
              onClick={() => setStep("details")}
            >
              Continuar
            </button>
          ) : (
            <>
              <button
                type="button"
                className="button button--secondary"
                disabled={pending}
                onClick={() => setStep("photos")}
              >
                Voltar às fotos
              </button>
              <button
                className="button button--primary"
                disabled={pending || preparing}
              >
                {pending ? "Salvando…" : "Confirmar fotos e salvar rascunho"}
              </button>
            </>
          )}
        </div>
      </form>
    </Modal>
  );
}
