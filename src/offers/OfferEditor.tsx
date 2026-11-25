import { useEffect, useRef, useState } from "react";
import { Modal } from "../components/Modal";
import { optimizeImage } from "../work/images";
import { priceInCents } from "../work/validation";
import { emptyOffer, kindLabel, offerInput } from "./model";
import type { Offer, OfferCatalog, OfferKind, OffersRepository } from "./model";
import { offersError } from "./OffersProvider";
export function OfferEditor({
  initial,
  kind,
  catalog,
  business,
  repository,
  onSaved,
  onClose,
}: {
  initial?: Offer;
  kind: OfferKind;
  catalog: OfferCatalog;
  business: string;
  repository: OffersRepository;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [id] = useState(() => initial?.id ?? crypto.randomUUID()),
    [input, setInput] = useState(() =>
      initial ? offerInput(initial) : emptyOffer(kind),
    );
  const [image, setImage] = useState<Blob | null>(null),
    [imageId, setImageId] = useState(""),
    [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [preparing, setPreparing] = useState(false),
    [retryImage, setRetryImage] = useState(false);
  const saved = useRef<Offer | null>(initial ?? null),
    busy = useRef(false),
    fileInput = useRef<HTMLInputElement>(null),
    generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  useEffect(() => {
    if (!image) {
      setUrl("");
      return;
    }
    const next = URL.createObjectURL(image);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [image]);
  async function choose(file?: File) {
    if (!file) return;
    const current = ++generation.current;
    setPreparing(true);
    setError("");
    try {
      const blob = await optimizeImage(file);
      if (current === generation.current) {
        setImage(blob);
        setImageId(crypto.randomUUID());
      }
    } catch (e) {
      if (current === generation.current) setError(offersError(e));
    } finally {
      if (current === generation.current) setPreparing(false);
    }
  }
  async function save() {
    if (busy.current || preparing) return;
    if (
      input.name.trim().length < 2 ||
      input.name.trim().length > 120 ||
      !input.areaId ||
      input.description.length > 2000
    ) {
      setError(
        "Informe nome (2–120 caracteres), área e descrição de até 2000 caracteres.",
      );
      return;
    }
    if (
      input.pricingType !== "quote" &&
      (priceInCents(input.price) ?? 0) <= 0
    ) {
      setError("Informe um valor maior que zero, ou escolha Sob orçamento.");
      return;
    }
    busy.current = true;
    setPending(true);
    setError("");
    try {
      if (!retryImage) {
        const row = await repository.save(business, id, {
          ...input,
          expectedUpdatedAt: saved.current?.updated_at,
        });
        saved.current = row;
      }
      if (image) {
        try {
          await repository.upload(business, id, imageId, image);
        } catch (e) {
          setRetryImage(true);
          setError(
            "Oferta salva; não foi possível confirmar a foto. A foto anterior não foi apagada. Tente novamente para verificar sem duplicar o arquivo. " +
              offersError(e),
          );
          return;
        }
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(offersError(e));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  const activities = catalog.activities.filter(
    (a) =>
      (a.kind === "both" || a.kind === kind) &&
      catalog.links.some(
        (l) => l.area_id === input.areaId && l.activity_id === a.id,
      ),
  );
  return (
    <Modal
      title={`${initial ? "Editar" : "Adicionar"} ${kindLabel[kind].toLowerCase()}`}
      onClose={onClose}
      locked={pending || preparing}
    >
      <form
        className="auth-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <fieldset
          className="work-fields"
          disabled={pending || preparing || retryImage}
        >
          <label>
            Nome da oferta
            <input
              required
              maxLength={120}
              value={input.name}
              onChange={(e) => setInput({ ...input, name: e.target.value })}
            />
          </label>
          <p className="field-help">
            Escreva seu nome específico. Ele não precisa existir nas sugestões.
          </p>
          <label>
            Área
            <select
              required
              value={input.areaId}
              onChange={(e) =>
                setInput({ ...input, areaId: e.target.value, activityIds: [] })
              }
            >
              <option value="">Selecione</option>
              {catalog.areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <details>
            <summary>
              Atividades relacionadas ({input.activityIds.length})
            </summary>
            <div className="offer-activity-options">
              {activities.map((a) => (
                <label key={a.id}>
                  <input
                    type="checkbox"
                    checked={input.activityIds.includes(a.id)}
                    onChange={(e) =>
                      setInput({
                        ...input,
                        activityIds: e.target.checked
                          ? [...input.activityIds, a.id]
                          : input.activityIds.filter((id) => id !== a.id),
                      })
                    }
                  />
                  {a.name}
                </label>
              ))}
            </div>
          </details>
          <label>
            Descrição
            <textarea
              rows={3}
              maxLength={2000}
              value={input.description}
              onChange={(e) =>
                setInput({ ...input, description: e.target.value })
              }
            />
          </label>
          <label>
            Tipo de preço
            <select
              value={input.pricingType}
              onChange={(e) =>
                setInput({
                  ...input,
                  pricingType: e.target.value as typeof input.pricingType,
                })
              }
            >
              <option value="quote">Sob orçamento</option>
              <option value="fixed">Preço fixo</option>
              <option value="starting-at">A partir de</option>
            </select>
          </label>
          {input.pricingType !== "quote" && (
            <label>
              Preço (R$)
              <input
                required
                inputMode="decimal"
                maxLength={16}
                value={input.price}
                onChange={(e) => setInput({ ...input, price: e.target.value })}
              />
            </label>
          )}
          <label className="work-checkbox">
            <input
              type="checkbox"
              checked={input.active}
              onChange={(e) => setInput({ ...input, active: e.target.checked })}
            />
            Oferta ativa
          </label>
          {kind === "product" && (
            <>
              <label className="work-checkbox">
                <input
                  type="checkbox"
                  checked={input.featured}
                  onChange={(e) =>
                    setInput({ ...input, featured: e.target.checked })
                  }
                />
                Produto em destaque (até cinco)
              </label>
              <p className="field-help">
                Vitrine para contato. Sem carrinho, estoque ou pagamento.
              </p>
            </>
          )}
          <input
            hidden
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              void choose(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className="button button--secondary"
            onClick={() => fileInput.current?.click()}
          >
            {image ? "Escolher outra foto" : "Adicionar foto da oferta"}
          </button>
          {url && (
            <figure className="offer-image-preview">
              <img src={url} alt="Prévia da foto da oferta" />
              <figcaption>
                A foto só será enviada após confirmar o salvamento.
              </figcaption>
            </figure>
          )}
          <p className="field-help">
            Ativar não publica um perfil em rascunho. Somente ofertas ativas de
            um perfil público aparecem para visitantes.
          </p>
        </fieldset>
        {preparing && <p role="status">Preparando foto…</p>}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="work-actions">
          <button
            type="button"
            className="button button--secondary"
            disabled={pending || preparing}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="button button--primary"
            disabled={pending || preparing}
          >
            {pending
              ? "Salvando…"
              : image
                ? "Confirmar e salvar com foto"
                : "Salvar oferta"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
