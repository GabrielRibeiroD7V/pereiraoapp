import { useEffect, useRef, useState } from "react";
import { Modal } from "../components/Modal";
import { PostContent } from "../posts/PostContent";
import { optimizeImage } from "../work/images";
import { useSocial } from "./SocialProvider";
import { SocialImage } from "./SocialImage";
import type { SocialImage as Image, SocialPost } from "./model";
import { postError } from "../posts/validation";
type DraftImage = Image & { blob?: Blob; preview?: string };
export function PersonalComposer({
  initial,
  files = [],
  onClose,
  onSaved,
}: {
  initial?: SocialPost;
  files?: File[];
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const repository = useSocial(),
    [id] = useState(() => initial?.id ?? crypto.randomUUID()),
    [title, setTitle] = useState(initial?.title ?? ""),
    [description, setDescription] = useState(initial?.description ?? ""),
    [photos, setPhotos] = useState<DraftImage[]>(initial?.images ?? []),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [preparing, setPreparing] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    urls = useRef<string[]>([]),
    started = useRef(false),
    active = useRef(true),
    locked = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      for (const url of urls.current) URL.revokeObjectURL(url);
    };
  }, []);
  async function add(selected: File[]) {
    if (locked.current || !selected.length) return;
    if (selected.length + photos.length > 6) {
      setError("Escolha de uma a seis fotos.");
      return;
    }
    locked.current = true;
    setPreparing(true);
    setError("");
    try {
      const prepared: DraftImage[] = [];
      for (const file of selected) {
        const blob = await optimizeImage(file);
        const preview = URL.createObjectURL(blob);
        urls.current.push(preview);
        prepared.push({
          id: crypto.randomUUID(),
          path: "",
          bucket: "personal-posts",
          blob,
          preview,
        });
      }
      if (active.current) setPhotos((old) => [...old, ...prepared]);
    } catch (e) {
      if (active.current)
        setError(
          e instanceof Error
            ? e.message
            : "Não foi possível preparar as fotos.",
        );
    } finally {
      locked.current = false;
      if (active.current) setPreparing(false);
    }
  }
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      void add(files);
    }
  }, []);
  async function save(publish: boolean) {
    if (!repository || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      await repository.save(id, { title, description, images: photos });
      if (publish) await repository.command(id, "publish");
      onSaved(id);
    } catch (e) {
      setError(
        postError(e) +
          " Se o envio foi interrompido, tente novamente: o mesmo rascunho e as mesmas fotos serão recuperados.",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      title={initial ? "Editar publicação pessoal" : "Nova publicação pessoal"}
      locked={busy || preparing}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save(false);
        }}
        data-pwa-dirty="true"
      >
        <p>
          Fotos da sua conta pessoal. Não é necessário ter negócio ou serviço.
          Até seis imagens JPEG, PNG ou WebP; 10 MB por original, 5 MB após
          preparação. HEIC não é suportado.
        </p>
        <input
          ref={input}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="visually-hidden"
          aria-label="Escolher fotos da publicação pessoal"
          onChange={(e) => {
            const chosen = Array.from(e.target.files ?? []);
            e.target.value = "";
            void add(chosen);
          }}
        />
        <button
          type="button"
          className="button button--secondary"
          disabled={busy || preparing || photos.length >= 6}
          onClick={() => input.current?.click()}
        >
          Adicionar fotos ({photos.length}/6)
        </button>
        {preparing && <p role="status">Preparando fotos no aparelho…</p>}
        <ol className="personal-image-selection">
          {photos.map((photo, i) => (
            <li key={photo.id}>
              {photo.preview ? (
                <img src={photo.preview} alt={`Foto ${i + 1}`} />
              ) : (
                <SocialImage image={photo} alt={`Foto ${i + 1}`} />
              )}
              <div>
                <button
                  type="button"
                  disabled={busy || preparing || i === 0}
                  onClick={() =>
                    setPhotos((old) => {
                      const result = [...old];
                      [result[i - 1], result[i]] = [result[i]!, result[i - 1]!];
                      return result;
                    })
                  }
                >
                  Mover foto {i + 1} para antes
                </button>
                <button
                  type="button"
                  disabled={busy || preparing}
                  onClick={() =>
                    setPhotos((old) => old.filter((p) => p.id !== photo.id))
                  }
                >
                  Remover foto {i + 1}
                </button>
              </div>
            </li>
          ))}
        </ol>
        <label className="form-field">
          Título (opcional)
          <input
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className="form-field">
          Legenda
          <textarea
            maxLength={3000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={busy}
          />
        </label>
        <section aria-label="Prévia da publicação pessoal">
          <PostContent
            title={title || "Publicação pessoal"}
            description={description}
            author="Seu perfil pessoal"
            visibility="Prévia — ainda não enviada"
            images={photos.map((p) => ({
              id: p.id,
              content: p.preview ? (
                <img src={p.preview} alt="Foto selecionada" />
              ) : (
                <SocialImage image={p} />
              ),
            }))}
          />
        </section>
        <p>
          Publicar torna sua identificação de autor e estas fotos públicas
          imediatamente. Salvar rascunho mantém tudo privado. Alterar um post
          publicado o retira do ar até você publicá-lo novamente.
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="work-actions">
          <button
            type="button"
            className="button button--secondary"
            disabled={busy || preparing}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="button button--secondary"
            disabled={busy || preparing || !photos.length || !repository}
            type="submit"
          >
            Salvar rascunho
          </button>
          <button
            className="button button--primary"
            type="button"
            disabled={busy || preparing || !photos.length || !repository}
            onClick={() => void save(true)}
          >
            {busy ? "Salvando…" : "Publicar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function PersonalPublisher({
  onSaved,
}: {
  onSaved: (id: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null),
    [files, setFiles] = useState<File[] | null>(null);
  return (
    <>
      <button
        className="button button--secondary"
        type="button"
        onClick={() => input.current?.click()}
      >
        Adicionar publicação
      </button>
      <input
        ref={input}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="visually-hidden"
        aria-label="Fotos para nova publicação pessoal"
        onChange={(e) => {
          const chosen = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (chosen.length) setFiles(chosen);
        }}
      />
      {files && (
        <PersonalComposer
          files={files}
          onClose={() => setFiles(null)}
          onSaved={(id) => {
            setFiles(null);
            onSaved(id);
          }}
        />
      )}
    </>
  );
}
