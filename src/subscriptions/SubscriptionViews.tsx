import {InitialFreeNotice} from './InitialFreeNotice';
import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useSubscriptions } from "./SubscriptionProvider";
import { useBilling } from "../billing/BillingProvider";
import { usePublicQuery } from "../marketplace/usePublicQuery";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../marketplace/Pagination";
import { useAdmin } from "../admin/AdminProvider";
import { subscriptionError, subscriptionLabels } from "./types";
import type { BusinessSubscription, AdminSubscriptions } from "./types";
export function subscriptionDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "Ainda não definido";
}
function StatusCopy({ item }: { item: BusinessSubscription }) {
  return (
    <div className="subscription-copy">
      <strong>{subscriptionLabels[item.state]}</strong>
      {item.state === "initial_free" && <p>Perfil básico, serviços, publicações e conversas gratuitos. Os 90 dias não estão correndo; assinatura futura somente por escolha expressa.</p>}
      {item.state === "exempt" && <p>Este negócio não precisa contratar uma assinatura.</p>}
      {item.trialEndsAt &&
        (item.state === "trial_active" || item.state === "trial_ended") && (
          <p>
            {item.state === "trial_ended"
              ? "Gratuidade encerrada em "
              : "Período gratuito até "}
            {subscriptionDate(item.trialEndsAt)}
          </p>
        )}
      {item.state === "awaiting_activation" && (
        <p>
          Os 90 dias começam na primeira ativação administrativa válida deste
          negócio.
        </p>
      )}
      {item.state === "trial_ended" && (
        <p>
          A contratação será disponibilizada em uma próxima etapa. Nenhuma
          cobrança será iniciada automaticamente.
        </p>
      )}
      {item.state === "pending_payment" && (
        <p>
          Situação informativa. O pagamento pelo aplicativo ainda não está
          disponível.
        </p>
      )}
      {item.state === "active" && item.billingPeriodEnd && (
        <p>
          Período de faturamento até {subscriptionDate(item.billingPeriodEnd)}
        </p>
      )}
    </div>
  );
}
export function BusinessSubscriptionLine({
  businessId,
}: {
  businessId: string;
}) {
  const billing = useBilling();
  const repo = useSubscriptions(),
    load = useCallback(
      async (signal: AbortSignal) => {
        try {
          if (!repo) throw { code: "SETUP_REQUIRED" };
          return { page: await repo.list(businessId, 1, signal) };
        } catch (e) {
          return { error: subscriptionError(e) };
        }
      },
      [repo, businessId],
    );
  const state = usePublicQuery(businessId, load);
  return (
    <section
      className="business-subscription-line"
      aria-label="Gratuidade deste negócio"
    >
      {state.loading ? (
        <p role="status">Consultando gratuidade…</p>
      ) : state.data?.error ? (
        <p role="status" className="field-help">
          {state.data.error}
        </p>
      ) : state.data?.page?.items[0] ? (
        <StatusCopy item={state.data.page.items[0]} />
      ) : (
        <p className="field-help">Situação indisponível.</p>
      )}
      <Link className="text-link" to="/conta/assinaturas">
        Consultar meus negócios
      </Link>
      {billing?.available && state.data?.page?.items[0] && state.data.page.items[0].state !== 'exempt' && (
        <Link
          className="text-link"
          to={`/conta/profissional/${businessId}/assinatura`}
        >
          Simular assinatura no Sandbox
        </Link>
      )}
    </section>
  );
}
export function SubscriptionsPage() {
  const repo = useSubscriptions(),
    [page, setPage] = useState(1);
  const load = useCallback(
    async (signal: AbortSignal) => {
      try {
        if (!repo) throw { code: "SETUP_REQUIRED" };
        return { page: await repo.list(undefined, page, signal) };
      } catch (e) {
        return { error: subscriptionError(e) };
      }
    },
    [repo, page],
  );
  const state = usePublicQuery(String(page), load);
  return (
    <div className="account-page">
      <Link className="back-link" to="/conta">
        Minha conta
      </Link>
      <InitialFreeNotice /><PageHeader title="Gratuidade e assinatura">
        <p>Uma situação por negócio, independente da sua conta pessoal.</p>
      </PageHeader>
      {state.loading ? (
        <p role="status">Consultando negócios…</p>
      ) : state.data?.error || state.error ? (
        <div className="form-notice" role="status">
          {state.data?.error ?? "Situação indisponível."}
          <button className="text-link" onClick={state.retry}>
            Tentar novamente
          </button>
        </div>
      ) : (
        state.data?.page && (
          <>
            <ul className="subscription-list">
              {state.data.page.items.map((item) => (
                <li key={item.businessId}>
                  <h2>{item.businessName}</h2>
                  <StatusCopy item={item} />
                </li>
              ))}
            </ul>
            {state.data.page.items.length === 0 && (
              <p>Nenhum negócio disponível para esta conta.</p>
            )}
            <Pagination
              page={page}
              hasNext={state.data.page.hasNext}
              onChange={setPage}
              label="situações de assinatura"
            />
          </>
        )
      )}
      <p className="field-help subscription-phase">
        Esta etapa não ativa cobrança nem bloqueio por vencimento. O estado
        administrativo do perfil é independente da gratuidade.
      </p>
    </div>
  );
}
export function AdminSubscriptionsPanel({
  revision = 0,
}: {
  revision?: number;
}) {
  const repo = useAdmin(),
    [page, setPage] = useState(1),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("");
  const load = useCallback(
    async (signal: AbortSignal) => {
      try {
        if (!repo) throw { code: "SETUP_REQUIRED" };
        return {
          data: await repo.query<AdminSubscriptions>(
            "subscriptions",
            { page, q: query, status },
            signal,
          ),
        };
      } catch (e) {
        return { error: subscriptionError(e) };
      }
    },
    [repo, page, query, status, revision],
  );
  const state = usePublicQuery(
    JSON.stringify([page, query, status, revision]),
    load,
  );
  return (
    <section aria-label="Situações de gratuidade">
      <form
        className="admin-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search.trim());
          setPage(1);
        }}
      >
        <label>
          Pesquisar negócio
          <input
            maxLength={80}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          Situação da assinatura
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todas</option>
            {Object.entries(subscriptionLabels).map(([key, label]) => (
              <option value={key} key={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="button button--primary">Pesquisar</button>
      </form>
      {state.loading ? (
        <p role="status">Consultando gratuidades…</p>
      ) : state.error || state.data?.error ? (
        <p className="form-notice" role="status">
          {state.data?.error ?? "Situação indisponível."}
          <button className="text-link" onClick={state.retry}>
            Tentar novamente
          </button>
        </p>
      ) : (
        state.data?.data && (
          <>
            <div className="admin-metrics">
              {[
                ["Gratuidade ativa", state.data.data.summary.trialActive],
                ["Gratuidade encerrada", state.data.data.summary.trialEnded],
                ["Assinaturas ativas", state.data.data.summary.active],
                ["Pagamento pendente", state.data.data.summary.pendingPayment],
                ["Assinaturas canceladas", state.data.data.summary.cancelled],
                ["Receita confirmada", "Indisponível"],
              ].map(([label, value]) => (
                <article key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </article>
              ))}
            </div>
            <p className="field-help">
              A conciliação financeira ainda não foi implementada. Não há
              receita confirmada apresentada como estimativa.
            </p>
            <div
              className="admin-table-scroll"
              role="region"
              aria-label="Gratuidade por negócio"
              tabIndex={0}
            >
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Negócio</th>
                    <th>Situação</th>
                    <th>Início</th>
                    <th>Término previsto</th>
                    <th>Ativações do mesmo proprietário</th>
                  </tr>
                </thead>
                <tbody>
                  {state.data.data.items.map((item) => (
                    <tr key={item.businessId}>
                      <td>{item.businessName}</td>
                      <td>{subscriptionLabels[item.state]}</td>
                      <td>{subscriptionDate(item.trialStartedAt)}</td>
                      <td>{subscriptionDate(item.trialEndsAt)}</td>
                      <td>{item.sameOwnerActivations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {state.data.data.items.length === 0 && (
              <p>Nenhum negócio neste filtro.</p>
            )}
            <Pagination
              page={page}
              hasNext={state.data.data.hasNext}
              onChange={setPage}
              label="gratuidades"
            />
          </>
        )
      )}
      <p className="form-notice">
        Cobrança e bloqueio por vencimento desativados. Extensões excepcionais
        exigem habilitação e decisão administrativa auditada.
      </p>
    </section>
  );
}
