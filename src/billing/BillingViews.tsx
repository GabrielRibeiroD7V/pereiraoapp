import { useCallback, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useBilling } from "./BillingProvider";
import { billingError, testStates } from "./types";
import { usePublicQuery } from "../marketplace/usePublicQuery";
import { PageHeader } from "../components/PageHeader";
import { Modal } from "../components/Modal";
const money = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    n / 100,
  );
function safeCheckout(value: string | null) {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.origin === "https://sandbox.asaas.com" &&
      !u.username &&
      !u.password &&
      !u.hash
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function SandboxBillingPage() {
  const { businessId = "" } = useParams(),
    repo = useBilling(),
    [revision, setRevision] = useState(0),
    [method, setMethod] = useState<"PIX" | "CREDIT_CARD">("PIX"),
    [accepted, setAccepted] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [cancelId, setCancelId] = useState<string | null>(null);
  const busy = useRef(false),
    operation = useRef(crypto.randomUUID());
  const load = useCallback(
    async (signal: AbortSignal) => {
      try {
        if (!repo?.available) throw { code: "SANDBOX_DISABLED" };
        return { value: await repo.overview(businessId, signal) };
      } catch (e) {
        return { error: billingError(e) };
      }
    },
    [repo, businessId, revision],
  );
  const state = usePublicQuery(businessId + revision, load);
  async function act(work: () => Promise<unknown>) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      await work();
      setRevision((n) => n + 1);
    } catch (e) {
      setError(billingError(e));
      setRevision((n) => n + 1);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  const contracts = state.data?.value?.contracts ?? [],
    open = contracts.some((c) => c.state !== "cancelled");
  return (
    <div className="account-page sandbox-billing">
      <Link className="back-link" to="/conta/profissional">
        Espaço profissional
      </Link>
      <PageHeader title="Assinatura em homologação">
        <p>Sandbox Asaas · somente simulações, sem cobrança real.</p>
      </PageHeader>
      <p className="form-notice">
        Estes testes não publicam seu perfil, não iniciam nem reiniciam os 90
        dias e não alteram seu acesso real.
      </p>
      {!repo?.available ? (
        <p>As simulações ficam disponíveis apenas no Preview autorizado.</p>
      ) : state.loading ? (
        <p role="status">Consultando simulações…</p>
      ) : state.error || state.data?.error ? (
        <p role="alert">
          {state.data?.error ?? "Consulta indisponível."}
          <button className="text-link" onClick={state.retry}>
            Tentar novamente
          </button>
        </p>
      ) : (
        <>
          <button
            className="button button--secondary"
            disabled={pending}
            onClick={() => setRevision((n) => n + 1)}
          >
            Atualizar situação
          </button>
          <ul className="subscription-list">
            {contracts.map((c) => (
              <li key={c.requestId}>
                <strong>
                  {testStates[c.state] ?? "Conciliação necessária"}
                </strong>
                <p>
                  {c.method === "PIX"
                    ? "Pix por cobrança mensal"
                    : "Cartão de crédito no Asaas"}{" "}
                  · {money(c.amountCents)}/mês — valor de teste
                </p>
                <p>Primeiro vencimento: {c.firstDueDate}</p>
                {safeCheckout(c.checkoutUrl) && c.state !== "cancelled" && (
                  <a
                    className="text-link"
                    href={safeCheckout(c.checkoutUrl)!}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir pagamento no Sandbox Asaas
                  </a>
                )}
                <div className="work-actions">
                  <button
                    className="button button--secondary"
                    disabled={pending}
                    onClick={() => void act(() => repo.reconcile(c.requestId))}
                  >
                    Conciliar simulação
                  </button>
                  {c.state !== "cancelled" && (
                    <button
                      className="button button--secondary"
                      disabled={pending}
                      onClick={() => setCancelId(c.requestId)}
                    >
                      Cancelar simulação
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {!open && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!accepted) return;
                void act(async () => {
                  await repo.start(businessId, operation.current, method);
                  setAccepted(false);
                  operation.current = crypto.randomUUID();
                });
              }}
            >
              <h2>Simular plano profissional</h2>
              <p>
                R$ 19,99/mês é um valor de homologação, sem oferta comercial
                aprovada.
              </p>
              <label className="form-field">
                Forma de pagamento
                <select
                  value={method}
                  disabled={pending}
                  onChange={(e) =>
                    setMethod(e.target.value as "PIX" | "CREDIT_CARD")
                  }
                >
                  <option value="PIX">Pix — pagamento a cada cobrança</option>
                  <option value="CREDIT_CARD">
                    Cartão de crédito — checkout hospedado
                  </option>
                </select>
              </label>
              <p className="field-help">
                Use somente dados sintéticos e meios de homologação. Nenhum dado
                completo de cartão será solicitado pelo PEREIRÃO. Pix Automático
                não está habilitado.
              </p>
              <label className="work-checkbox">
                <input
                  type="checkbox"
                  checked={accepted}
                  disabled={pending}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                Aceito simular a assinatura mensal por R$ 19,99 no Sandbox.
                Entendo que não é uma contratação real.
              </label>
              <button
                className="button button--primary"
                disabled={!accepted || pending}
              >
                {pending ? "Preparando…" : "Iniciar simulação no Sandbox"}
              </button>
            </form>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {cancelId && (
        <Modal
          title="Cancelar simulação?"
          locked={pending}
          onClose={() => setCancelId(null)}
        >
          <p>
            A recorrência de teste será cancelada. O histórico e as cobranças já
            geradas serão preservados.
          </p>
          <button
            className="button button--secondary"
            disabled={pending}
            onClick={() => setCancelId(null)}
          >
            Voltar
          </button>
          <button
            className="button button--primary"
            disabled={pending}
            onClick={() =>
              void act(async () => {
                await repo!.cancel(cancelId);
                setCancelId(null);
              })
            }
          >
            Confirmar cancelamento Sandbox
          </button>
        </Modal>
      )}
    </div>
  );
}
export function SandboxFinancePanel() {
  const repo = useBilling(),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [refund, setRefund] = useState<string | null>(null),
    busy = useRef(false);
  const load = useCallback(
    async (signal: AbortSignal) => {
      try {
        if (!repo?.available) throw { code: "SANDBOX_DISABLED" };
        return { value: await repo.admin(signal) };
      } catch (e) {
        return { error: billingError(e) };
      }
    },
    [repo, revision],
  );
  const state = usePublicQuery("sandbox" + revision, load);
  async function act(work: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      await work();
      setRevision((n) => n + 1);
    } catch (e) {
      setError(billingError(e));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  if (state.loading)
    return <p role="status">Consultando homologação financeira…</p>;
  if (state.error || state.data?.error)
    return (
      <p role="alert">
        {state.data?.error ?? "Consulta indisponível."}
        <button className="text-link" onClick={state.retry}>
          Tentar novamente
        </button>
      </p>
    );
  const data = state.data?.value,
    summary = data?.summary;
  return (
    <section className="sandbox-billing" aria-label="Financeiro Sandbox">
      <p className="form-notice">
        Ambiente de homologação. Valores e estados abaixo são de teste e não
        alteram os perfis reais.
      </p>
      {summary && (
        <div className="admin-metrics">
          {[
            ["Contratos de teste", summary.testContracts],
            ["Ativas Sandbox", summary.active],
            ["Pendentes Sandbox", summary.pending],
            ["Vencidas Sandbox", summary.overdue],
            ["Canceladas Sandbox", summary.cancelled],
            ["Estornadas Sandbox", summary.refunded],
            ["Pagamentos confirmados de teste", summary.confirmedPayments],
            ["Receita recebida Sandbox", money(summary.receivedCents)],
            ["Eventos aguardando conciliação", summary.eventsPending],
            ["Receita real", "Indisponível"],
          ].map(([label, value]) => (
            <article key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>
      )}
      <div className="work-actions">
        <button
          className="button button--secondary"
          disabled={pending}
          onClick={() => setRevision((n) => n + 1)}
        >
          Atualizar financeiro Sandbox
        </button>
        <button
          className="button button--secondary"
          disabled={pending}
          onClick={() => void act(() => repo!.retry())}
        >
          Reprocessar eventos pendentes
        </button>
      </div>
      <p className="field-help">
        Receita recebida considera pagamentos conciliados como recebidos,
        descontando estornos. Confirmação de cartão ainda sem liquidação não é
        receita recebida.
      </p>
      <ul className="subscription-list">
        {data?.contracts.map((c) => (
          <li key={c.requestId}>
            <strong>{testStates[c.state] ?? "Conciliação necessária"}</strong>
            <p>
              Negócio: {c.businessId} · {money(c.amountCents)} · {c.method}
            </p>
          </li>
        ))}
      </ul>
      <p className="field-help">
        Histórico recente: até 20 contratos e 100 pagamentos. Os indicadores
        consideram todos os registros de teste.
      </p>
      <h3>Pagamentos de teste</h3>
      {!data?.payments.length && <p>Nenhum pagamento Sandbox conciliado.</p>}
      <ul className="subscription-list">
        {data?.payments.map((p) => (
          <li key={p.paymentId}>
            <strong>{p.status}</strong>
            <p>
              {money(p.amountCents)} · vencimento {p.dueDate}
            </p>
            {["CONFIRMED", "RECEIVED"].includes(p.status) && (
              <button
                className="button button--secondary"
                disabled={pending}
                onClick={() => setRefund(p.paymentId)}
              >
                Estornar no Sandbox
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && <p role="alert">{error}</p>}
      {refund && (
        <Modal
          title="Estornar pagamento de teste?"
          locked={pending}
          onClose={() => setRefund(null)}
        >
          <p>
            O estorno será solicitado exclusivamente ao Sandbox. A confirmação
            depende da conciliação no Asaas.
          </p>
          <button
            disabled={pending}
            className="button button--secondary"
            onClick={() => setRefund(null)}
          >
            Voltar
          </button>
          <button
            disabled={pending}
            className="button button--primary"
            onClick={() =>
              void act(async () => {
                await repo!.refund(refund, crypto.randomUUID());
                setRefund(null);
              })
            }
          >
            Confirmar estorno Sandbox
          </button>
        </Modal>
      )}
    </section>
  );
}
