import { useSectionAnchor } from "../hooks/useSectionAnchor";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useProfessionalRepository } from "../professional/ProfessionalProvider";
import { usePublicQuery } from "../marketplace/usePublicQuery";
import { QueryStatus } from "../marketplace/QueryStatus";
import { Modal } from "../components/Modal";
import { formatPrice } from "../work/validation";
import { PageHeader } from "../components/PageHeader";
import { useOffers, offersError } from "./OffersProvider";
import { OfferEditor } from "./OfferEditor";
import { kindLabel } from "./model";
import type { Offer, OfferKind } from "./model";
export function OfferPhoto({
  path,
  privateView = false,
}: {
  path: string;
  privateView?: boolean;
}) {
  const repository = useOffers(privateView);
  const load = useCallback(
    () => (repository ? repository.image(path) : Promise.resolve("")),
    [repository, path],
  );
  const state = usePublicQuery(path, load);
  return state.data ? (
    <img
      className="offer-photo"
      src={state.data}
      alt="Foto da oferta"
      referrerPolicy="no-referrer"
    />
  ) : (
    <p className="field-help">
      {state.error ? "Foto indisponível" : "Carregando foto…"}
    </p>
  );
}
export function OffersSection({
  business,
  kind,
  privateView = false,
  featuredOnly = false,
  manage = false,
}: {
  business: string;
  kind: OfferKind;
  privateView?: boolean;
  featuredOnly?: boolean;
  manage?: boolean;
}) {
  const repository = useOffers(privateView);
  const load = useCallback(
    () =>
      repository ? repository.list(business, privateView) : Promise.resolve([]),
    [business, privateView, repository],
  );
  const state = usePublicQuery(`offers:${business}:${privateView}`, load);
  useSectionAnchor(kind === "service" && !!state.data);
  const items =
    state.data?.filter(
      (o) => o.kind === kind && o.active && (!featuredOnly || o.featured),
    ) ?? [];
  return (
    <section
      id={kind === "service" ? "servicos" : "produtos"}
      className="public-profile-section"
      aria-label={kind === "service" ? "Serviços" : "Produtos em destaque"}
    >
      <h2>{kind === "service" ? "Serviços" : "Produtos em destaque"}</h2>
      <QueryStatus {...state} />
      {state.data && !items.length && <p>Nenhuma oferta ativa nesta seção.</p>}
      <ul className="offer-list">
        {items.map((o) => (
          <li key={`${o.source}:${o.id}`}>
            <Link
              to={
                privateView
                  ? `/conta/profissional/${business}/${manage ? "perfil" : "previa"}/ofertas/${o.source}/${o.id}`
                  : `/ofertas/${o.source}/${o.id}`
              }
            >
              <h3>{o.name}</h3>
            </Link>
            {o.image_path && (
              <OfferPhoto path={o.image_path} privateView={privateView} />
            )}
            <p>{o.description}</p>
            <strong>{formatPrice(o.pricing_type, o.price_amount_cents)}</strong>
          </li>
        ))}
      </ul>
      {manage && (
        <Link to={`/conta/profissional/${business}/ofertas`}>
          Gerenciar ofertas
        </Link>
      )}
    </section>
  );
}
export function OffersPage({ embedded = false }: { embedded?: boolean }) {
  const { businessId = "" } = useParams(),
    [query, setQuery] = useSearchParams(),
    repository = useOffers(true),
    professional = useProfessionalRepository();
  const [revision, setRevision] = useState(0),
    [editor, setEditor] = useState<Offer | OfferKind | null>(null),
    [deleting, setDeleting] = useState<Offer | null>(null),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const load = useCallback(async () => {
    if (!repository || !professional)
      throw new Error("Gerenciamento indisponível.");
    await professional.getEditable(businessId);
    const [catalog, items] = await Promise.all([
      repository.catalog(),
      repository.list(businessId, true),
    ]);
    return { catalog, items };
  }, [repository, professional, businessId, revision]);
  const state = usePublicQuery(
    `managed-offers:${businessId}:${revision}`,
    load,
  );
  useEffect(() => {
    if (!state.data) return;
    const action = query.get("acao");
    if (action === "servico" || action === "produto") {
      setEditor(action === "servico" ? "service" : "product");
      setQuery(
        (p) => {
          p.delete("acao");
          return p;
        },
        { replace: true },
      );
    }
  }, [query, state.data, setQuery]);
  async function remove() {
    if (!deleting || !repository || pending) return;
    setPending(true);
    setError("");
    try {
      await repository.remove(businessId, deleting.id);
      setDeleting(null);
      setRevision((v) => v + 1);
    } catch (e) {
      setError(offersError(e));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="work-page">
      {!embedded && (
        <>
          <Link
            className="back-link"
            to={`/conta/profissional/${businessId}/perfil`}
          >
            Voltar ao perfil
          </Link>
          <PageHeader title="Serviços e produtos" />
        </>
      )}
      <QueryStatus {...state} />
      {state.error && <p role="status">{offersError(state.error)}</p>}
      {state.data && repository && (
        <>
          <div className="work-toolbar">
            <button
              className="button button--primary"
              onClick={() => setEditor("service")}
            >
              Adicionar serviço
            </button>
            <button
              className="button button--secondary"
              onClick={() => setEditor("product")}
            >
              Adicionar produto
            </button>
          </div>
          <p className="field-help">
            Ofertas ativas só aparecem publicamente com o perfil no ar. Até
            cinco produtos em destaque; demais produtos ativos continuam
            acessíveis pela busca.
          </p>
          {(["service", "product"] as const).map((kind) => (
            <section key={kind}>
              <h2>{kind === "service" ? "Serviços e preços" : "Produtos"}</h2>
              <ul className="offer-list">
                {state
                  .data!.items.filter((o) => o.kind === kind)
                  .map((o) => (
                    <li key={`${o.source}:${o.id}`}>
                      <h3>{o.name}</h3>
                      <p>
                        {o.active ? "Ativo" : "Oculto"}
                        {o.featured ? " · Em destaque" : ""}
                      </p>
                      <p>{o.description}</p>
                      <strong>
                        {formatPrice(o.pricing_type, o.price_amount_cents)}
                      </strong>
                      {o.image_path && (
                        <OfferPhoto path={o.image_path} privateView />
                      )}
                      <div className="work-actions">
                        {o.source === "legacy" ? (
                          <Link
                            className="button button--secondary"
                            to={`/conta/profissional/${businessId}/servicos`}
                          >
                            Editar serviço existente
                          </Link>
                        ) : (
                          <>
                            <button
                              className="button button--secondary"
                              onClick={() => setEditor(o)}
                            >
                              Editar / ocultar
                            </button>
                            <button
                              className="text-link"
                              onClick={() => setDeleting(o)}
                            >
                              Excluir oferta
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
              </ul>
              {!state.data!.items.some((o) => o.kind === kind) && (
                <p>Nenhuma oferta cadastrada.</p>
              )}
            </section>
          ))}
          {editor && (
            <OfferEditor
              key={typeof editor === "string" ? editor : editor.id}
              initial={typeof editor === "string" ? undefined : editor}
              kind={typeof editor === "string" ? editor : editor.kind}
              catalog={state.data.catalog}
              business={businessId}
              repository={repository}
              onSaved={() => setRevision((v) => v + 1)}
              onClose={() => setEditor(null)}
            />
          )}
          {deleting && (
            <Modal
              title="Excluir oferta?"
              locked={pending}
              onClose={() => setDeleting(null)}
            >
              <p>
                A oferta “{deleting.name}” sairá do perfil e da busca.
                Fotografias e auditoria serão preservadas; publicações não serão
                apagadas.
              </p>
              {error && <p role="alert">{error}</p>}
              <div className="work-actions">
                <button
                  className="button button--secondary"
                  disabled={pending}
                  onClick={() => setDeleting(null)}
                >
                  Cancelar
                </button>
                <button
                  className="button button--danger"
                  disabled={pending}
                  onClick={() => void remove()}
                >
                  Confirmar exclusão
                </button>
              </div>
            </Modal>
          )}
        </>
      )}
    </div>
  );
}
export function OfferPage({
  privateView = false,
  readOnly = false,
}: {
  privateView?: boolean;
  readOnly?: boolean;
}) {
  const { offerId = "", source = "", businessId = "" } = useParams(),
    repository = useOffers(privateView),
    professional = useProfessionalRepository(),
    { session } = useAuth();
  const load = useCallback(async () => {
    if (!repository) return null;
    if (!privateView) return repository.get(offerId, source);
    if (!professional) return null;
    await professional.getEditable(businessId);
    return (
      (await repository.list(businessId, true)).find(
        (o) => o.id === offerId && o.source === source,
      ) ?? null
    );
  }, [offerId, source, repository, privateView, professional, businessId]);
  const state = usePublicQuery(`offer:${source}:${offerId}`, load);
  const offer = state.data;
  const [ownership, setOwnership] = useState<{
    uid: string;
    business: string;
  } | null>(null);
  useEffect(() => {
    let live = true;
    if (!offer || !session || !professional) return;
    void professional
      .listMine()
      .then((rows) => {
        if (live && rows.some((b) => b.id === offer.business_id))
          setOwnership({ uid: session.user.id, business: offer.business_id });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [offer?.business_id, session?.user.id, professional]);
  const mine = !!(
    session &&
    offer &&
    ownership?.uid === session.user.id &&
    ownership.business === offer.business_id
  );
  return (
    <div className="public-profile offer-detail">
      <Link
        className="back-link"
        to={
          privateView
            ? `/conta/profissional/${businessId}/${readOnly ? "previa" : "perfil"}`
            : "/buscar"
        }
      >
        Voltar
      </Link>
      <QueryStatus {...state} />
      {offer ? (
        <article>
          <p className="offer-kind">{kindLabel[offer.kind]}</p>
          <PageHeader title={offer.name} />
          <Link
            to={
              privateView
                ? `/conta/profissional/${businessId}/${readOnly ? "previa" : "perfil"}`
                : `/prestadores/${offer.slug}`
            }
          >
            {offer.author}
          </Link>
          {offer.image_path && (
            <OfferPhoto path={offer.image_path} privateView={privateView} />
          )}
          <p className="post-full-description">
            {offer.description || "Descrição não informada."}
          </p>
          <strong>
            {formatPrice(offer.pricing_type, offer.price_amount_cents)}
          </strong>
          {offer.kind === "product" && (
            <p>
              Produto em vitrine. Combine os detalhes diretamente com o
              responsável.
            </p>
          )}
          <div className="work-actions">
            {!readOnly && (mine || privateView) ? (
              <Link
                className="button button--secondary"
                to={`/conta/profissional/${offer.business_id}/ofertas`}
              >
                Gerenciar oferta
              </Link>
            ) : (
              !privateView &&
              !readOnly && (
                <Link
                  className="button button--primary"
                  to={`/mensagens/iniciar/${offer.business_id}`}
                >
                  Conversar / Solicitar orçamento
                </Link>
              )
            )}
          </div>
        </article>
      ) : (
        !state.loading && !state.error && <p>Oferta indisponível ou privada.</p>
      )}
    </div>
  );
}
