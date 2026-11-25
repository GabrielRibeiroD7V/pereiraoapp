import { useProfessionalRepository } from "../professional/ProfessionalProvider";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { usePublicQuery } from "../marketplace/usePublicQuery";
import { useOffers, offersError } from "./OffersProvider";
export function PostOffer({
  post,
  kind,
  business,
  manage = false,
}: {
  post: string;
  kind: "professional" | "personal";
  business?: string;
  manage?: boolean;
}) {
  const professional = useProfessionalRepository();
  const repository = useOffers(manage),
    [revision, setRevision] = useState(0),
    [selection, setSelection] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const load = useCallback(async () => {
    if (!repository) return { linked: null, items: [] };
    const [linked, items] = await Promise.all([
      repository.postOffer(kind, post),
      manage && business
        ? repository.list(business, true)
        : manage && kind === "personal" && professional
          ? professional
              .listMine()
              .then(async (businesses) =>
                (
                  await Promise.all(
                    businesses.map((b) => repository.list(b.id, true)),
                  )
                ).flat(),
              )
          : Promise.resolve([]),
    ]);
    return { linked, items };
  }, [repository, post, kind, manage, business, professional, revision]);
  const state = usePublicQuery(
    `post-offer:${post}:${manage}:${revision}`,
    load,
  );
  useEffect(() => {
    const o = state.data?.linked;
    setSelection(o ? `${o.source}:${o.id}` : "");
  }, [state.data]);
  if (!repository) return null;
  return (
    <section className="public-profile-section" aria-label="Oferta relacionada">
      {state.data?.linked && (
        <p>
          Oferta relacionada:{" "}
          <Link
            to={
              manage
                ? `/conta/profissional/${state.data.linked.business_id}/perfil/ofertas/${state.data.linked.source}/${state.data.linked.id}`
                : `/ofertas/${state.data.linked.source}/${state.data.linked.id}`
            }
          >
            {state.data.linked.name}
          </Link>
        </p>
      )}
      {manage && state.data && (
        <details>
          <summary>Vincular a uma oferta minha (opcional)</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (pending) return;
              setPending(true);
              setError("");
              void repository
                .linkPost(
                  kind,
                  post,
                  state.data!.items.find(
                    (o) => `${o.source}:${o.id}` === selection,
                  ) ?? null,
                )
                .then(() => setRevision((v) => v + 1))
                .catch((e) => setError(offersError(e)))
                .finally(() => setPending(false));
            }}
          >
            <label>
              Oferta
              <select
                value={selection}
                onChange={(e) => setSelection(e.target.value)}
                disabled={pending}
              >
                <option value="">Sem vínculo</option>
                {state.data.items.map((o) => (
                  <option
                    key={`${o.source}:${o.id}`}
                    value={`${o.source}:${o.id}`}
                  >
                    {o.kind === "service" ? "Serviço" : "Produto"} · {o.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="button button--secondary" disabled={pending}>
              Salvar vínculo
            </button>
          </form>
        </details>
      )}
      {error && <p role="alert">{error}</p>}
      {state.error && manage && (
        <p role="status">Vínculo indisponível. O post foi preservado.</p>
      )}
    </section>
  );
}
