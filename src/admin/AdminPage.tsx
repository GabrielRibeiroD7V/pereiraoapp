import { LayoutDashboard, Users, BriefcaseBusiness, Images, History, CalendarDays, FlaskConical, Activity } from 'lucide-react';
import { useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Brand } from "../components/Brand";
import { AdminSubscriptionsPanel } from "../subscriptions/SubscriptionViews";
import { useBilling } from "../billing/BillingProvider";
import { SandboxFinancePanel } from "../billing/BillingViews";
import { PageHeader } from "../components/PageHeader";
import { Modal } from "../components/Modal";
import { Pagination } from "../marketplace/Pagination";
import { usePublicQuery } from "../marketplace/usePublicQuery";
import { useAuth } from "../auth/AuthProvider";
import { useAdmin } from "./AdminProvider";
import { adminError } from "./types";
import type {
  AdminAction,
  AdminSection,
  AdminFilters,
  AdminDashboard,
  AdminPage as Page,
  AdminBusiness,
  AdminUser,
  AdminPost,
  AdminDetail,
  AuditEntry,
  SandboxDiagnostic,
} from "./types";
const sections = [
  ["dashboard", "Visão geral"],
  ["users", "Usuários"],
  ["businesses", "Prestadores"],
  ["posts", "Publicações"],
  ["audit", "Histórico"],
  ["subscriptions", "Gratuidade e assinaturas"],
  ["sandbox", "Financeiro Sandbox"],
] as const;
const sectionIcons = { dashboard: LayoutDashboard, users: Users, businesses: BriefcaseBusiness, posts: Images, audit: History, subscriptions: CalendarDays, sandbox: FlaskConical };
const states: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicado",
  unpublished: "Não publicado",
  suspended: "Suspenso",
  active: "Ativo",
  blocked: "Bloqueado",
};
const actionNames: Record<string, string> = {
  publish: "Aprovar publicação",
  suspend: "Suspender",
  reactivate: "Reativar",
  withdraw: "Retirar e bloquear",
  release: "Liberar para revisão do prestador",
};
function date(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}
function Resource<T>({
  section,
  filters,
  revision = 0,
  children,
}: {
  section: AdminSection;
  filters: AdminFilters;
  revision?: number;
  children: (data: T) => ReactNode;
}) {
  const repo = useAdmin(),
    key = JSON.stringify([section, filters, revision]);
  const load = useCallback(
    async (signal: AbortSignal) => {
      try {
        if (!repo) throw { code: "SETUP_REQUIRED" };
        return {
          data: await repo.query<T>(section, JSON.parse(key)[1], signal),
        };
      } catch (e) {
        return { error: adminError(e) };
      }
    },
    [repo, section, key],
  );
  const state = usePublicQuery(key, load);
  if (state.loading)
    return <p role="status">Carregando dados administrativos…</p>;
  if (state.error || state.data?.error)
    return (
      <div role="alert" className="form-error">
        {state.data?.error ?? "Falha ao carregar."}{" "}
        <button type="button" className="text-link" onClick={state.retry}>
          Tentar novamente
        </button>
      </div>
    );
  return state.data?.data !== undefined ? children(state.data.data) : null;
}
export function AdminPage() {
  const repo = useAdmin(),
    { session } = useAuth();
  const accessLoad = useCallback(
    async (signal: AbortSignal) => {
      try {
        if (!repo) throw { code: "SETUP_REQUIRED" };
        return { allowed: await repo.access(signal) };
      } catch (e) {
        return { allowed: false, error: adminError(e) };
      }
    },
    [repo],
  );
  const access = usePublicQuery(session?.user.id ?? "", accessLoad);
  return (
    <div className="admin-app">
      <a className="skip-link" href="#admin-main">
        Pular para administração
      </a>
      <header className="admin-header">
        <Brand />
        <span>Administração</span>
        <Link to="/conta">Voltar ao aplicativo</Link>
      </header>
      <main id="admin-main" className="admin-main">
        <PageHeader title="Painel administrativo">
          <p>Acompanhe e revise os cadastros do PEREIRÃO.</p>
        </PageHeader>
        {access.loading ? (
          <p role="status">Verificando autorização administrativa…</p>
        ) : access.error || !access.data?.allowed ? (
          <div role="alert" className="form-notice">
            {access.data?.error ??
              "Acesso restrito à administração da plataforma."}
            <button className="text-link" onClick={access.retry}>
              Verificar novamente
            </button>
          </div>
        ) : (
          <AdminContent key={session?.user.id} />
        )}
      </main>
    </div>
  );
}
function AdminContent() {
  const billing = useBilling();
  const visibleSections = sections.filter(
    ([id]) => id !== "sandbox" || billing?.available,
  );
  const [params, setParams] = useSearchParams();
  const section = visibleSections.some(([id]) => id === params.get("sec"))
    ? (params.get("sec") as Exclude<AdminSection, "detail">)
    : "dashboard";
  const page = Math.max(1, Math.min(100000, Number(params.get("page")) || 1)),
    days = [0, 7, 30, 90].includes(Number(params.get("days")))
      ? Number(params.get("days") ?? 30)
      : 30;
  const q = params.get("q") ?? "",
    status = params.get("status") ?? "";
  const [search, setSearch] = useState(q),
    [revision, refresh] = useState(0),
    [review, setReview] = useState<string | null>(null);
  const [decision, setDecision] = useState<{
    input: Omit<AdminAction, "reason">;
    label: string;
  } | null>(null);
  function update(values: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(values))
      v ? next.set(k, v) : next.delete(k);
    setParams(next);
  }
  function decide(input: Omit<AdminAction, "reason">, label: string) {
    setDecision({ input, label });
  }
  const filters = {
    q,
    status,
    page,
    days,
    ...(section === "audit" && params.get("id")
      ? { id: params.get("id")! }
      : {}),
  };
  const paged = (next: boolean) => (
    <Pagination
      page={page}
      hasNext={next}
      onChange={(p) => update({ page: String(p) })}
      label="administração"
    />
  );
  return (
    <div className="admin-workspace">
      <nav className="admin-sections" aria-label="Seções administrativas">
        {visibleSections.map(([id, label]) => {
          const Icon = sectionIcons[id];
          return <button
            key={id}
            className={id === section ? "is-active" : ""}
            aria-current={id === section ? "page" : undefined}
            onClick={() => {
              setSearch("");
              setParams({ sec: id });
            }}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
          </button>;
        })}
      </nav>
      <div className="admin-content">
      <div className="admin-section-heading">
        <h2>{visibleSections.find(([id]) => id === section)?.[1]}</h2>
        <button
          className="button button--secondary"
          onClick={() => refresh((n) => n + 1)}
        >
          Atualizar
        </button>
      </div>
      {(section === "dashboard" || section === "users") && (
        <label className="admin-period">
          Período de cadastro
          <select
            value={days}
            onChange={(e) => update({ days: e.target.value, page: "" })}
          >
            <option value={0}>Todo o período</option>
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
          </select>
        </label>
      )}
      {["users", "businesses", "posts"].includes(section) && (
        <form
          className="admin-filters"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: search.trim().slice(0, 80), page: "" });
          }}
        >
          <label>
            Pesquisar
            <input
              maxLength={80}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                section === "users" ? "Nome ou e-mail" : "Nome ou título"
              }
            />
          </label>
          <label>
            Situação
            <select
              value={status}
              onChange={(e) => update({ status: e.target.value, page: "" })}
            >
              <option value="">Todas</option>
              {(section === "users"
                ? ["active", "suspended"]
                : section === "businesses"
                  ? ["draft", "published", "unpublished", "suspended"]
                  : ["draft", "published", "unpublished"]
              ).map((s) => (
                <option key={s} value={s}>
                  {states[s]}
                </option>
              ))}
            </select>
          </label>
          <button className="button button--primary" type="submit">
            Pesquisar
          </button>
        </form>
      )}
      {section === "sandbox" ? (
        <SandboxFinancePanel key={revision} />
      ) : section === "subscriptions" ? (
        <AdminSubscriptionsPanel revision={revision} />
      ) : section === "dashboard" ? (
        <Resource<AdminDashboard>
          section={section}
          filters={filters}
          revision={revision}
        >
          {(data) => (
            <>
              <div className="admin-metrics">
                {[
                  ["Usuários cadastrados", data.users],
                  ["Cadastros no período", data.newUsers],
                  ["Autônomos", data.autonomos],
                  ["Empresas", data.empresas],
                  ["Prestadores publicados", data.published],
                  ["Rascunhos para análise", data.drafts],
                  ["Prestadores suspensos", data.suspended],
                  ["Publicações de trabalhos", data.posts],
                ].map(([label, value]) => (
                  <article key={label}>
                    <Activity size={17} aria-hidden="true" />
                    <span>{label}</span>
                    <strong>{value ?? "Indisponível"}</strong>
                  </article>
                ))}
              </div>
              <p className="field-help">
                Rascunhos para análise incluem cadastros incompletos; não
                representam solicitações formais de aprovação.
              </p>
              <p className="form-notice">
                Usuários ativos em 7 e 30 dias: indisponível. Ainda não existem
                eventos confiáveis de atividade.
              </p>
              {!data.postsAvailable && (
                <p className="form-notice">
                  Publicações aguardam a ativação da migração de trabalhos. Os
                  demais indicadores permanecem disponíveis.
                </p>
              )}
              <SandboxPanel />
            </>
          )}
        </Resource>
      ) : section === "businesses" ? (
        <Resource<Page<AdminBusiness>>
          section={section}
          filters={filters}
          revision={revision}
        >
          {(data) => (
            <>
              <DataTable
                empty={data.items.length === 0}
                headings={["Prestador", "Tipo e local", "Situação", "Ações"]}
              >
                {data.items.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <strong>{b.name}</strong>
                      <small>{b.category ?? "Sem categoria"}</small>
                    </td>
                    <td>
                      {b.type === "empresa" ? "Empresa" : "Autônomo"}
                      <small>{b.city}</small>
                    </td>
                    <td>
                      <Status value={b.suspended ? "suspended" : b.status} />
                    </td>
                    <td>
                      <button
                        className="text-link"
                        onClick={() => setReview(b.id)}
                      >
                        Analisar perfil
                        <span className="visually-hidden"> {b.name}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </DataTable>
              {paged(data.hasNext)}
            </>
          )}
        </Resource>
      ) : section === "users" ? (
        <Resource<Page<AdminUser>>
          section={section}
          filters={filters}
          revision={revision}
        >
          {(data) => (
            <>
              <p className="field-help">
                Suspender bloqueia a gestão profissional e retira os negócios
                próprios de circulação. Não exclui a conta nem impede o login no
                Supabase Auth.
              </p>
              <DataTable
                empty={data.items.length === 0}
                headings={["Usuário", "Cadastro", "Situação", "Ações"]}
              >
                {data.items.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.display_name || "Sem nome"}</strong>
                      <small>{u.email ?? "Sem e-mail"}</small>
                      <small>
                        {u.confirmed
                          ? "E-mail confirmado"
                          : "E-mail não confirmado"}
                      </small>
                    </td>
                    <td>{date(u.created_at)}</td>
                    <td>
                      <Status value={u.suspended ? "suspended" : "active"} />
                    </td>
                    <td>
                      <button
                        className="text-link"
                        onClick={() =>
                          decide(
                            {
                              kind: "user",
                              target: u.id,
                              command: u.suspended ? "reactivate" : "suspend",
                              expected_state: u.suspended
                                ? "suspended"
                                : "active",
                            },
                            u.display_name || u.email || u.id,
                          )
                        }
                      >
                        {u.suspended ? "Reativar" : "Suspender"}
                      </button>
                    </td>
                  </tr>
                ))}
              </DataTable>
              {paged(data.hasNext)}
            </>
          )}
        </Resource>
      ) : section === "posts" ? (
        <Resource<Page<AdminPost>>
          section={section}
          filters={filters}
          revision={revision}
        >
          {(data) =>
            data.available === false ? (
              <p role="status" className="form-notice">
                Publicações aguardam a ativação da migração de trabalhos.
              </p>
            ) : (
              <>
                {!data.moderationAvailable && (
                  <p className="form-notice">
                    A moderação aguarda sua migração específica.
                  </p>
                )}
                <DataTable
                  empty={data.items.length === 0}
                  headings={["Trabalho", "Prestador", "Situação", "Ações"]}
                >
                  {data.items.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.title}</strong>
                        <small>{date(p.created_at)}</small>
                      </td>
                      <td>
                        <button
                          className="text-link"
                          onClick={() => setReview(p.business_id)}
                        >
                          {p.business_name}
                        </button>
                      </td>
                      <td>
                        <Status value={p.blocked ? "blocked" : p.status} />
                      </td>
                      <td>
                        <button
                          className="text-link"
                          disabled={!data.moderationAvailable}
                          onClick={() =>
                            decide(
                              {
                                kind: "post",
                                target: p.id,
                                command: p.blocked ? "release" : "withdraw",
                                expected_state: p.blocked
                                  ? "blocked"
                                  : p.status,
                              },
                              p.title,
                            )
                          }
                        >
                          {p.blocked ? "Liberar" : "Retirar e bloquear"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </DataTable>
                {paged(data.hasNext)}
              </>
            )
          }
        </Resource>
      ) : (
        <Resource<Page<AuditEntry>>
          section="audit"
          filters={filters}
          revision={revision}
        >
          {(data) => (
            <>
              <AuditTable items={data.items} />
              {paged(data.hasNext)}
              {params.get("id") && (
                <button
                  className="text-link"
                  onClick={() => update({ id: "", page: "" })}
                >
                  Ver todo o histórico
                </button>
              )}
            </>
          )}
        </Resource>
      )}
      {review && (
        <Modal title="Análise do perfil" onClose={() => setReview(null)}>
          <BusinessDetails
            id={review}
            revision={revision}
            decide={decide}
            onHistory={() => {
              setReview(null);
              setParams({ sec: "audit", id: review });
            }}
          />
        </Modal>
      )}
      {decision && (
        <DecisionModal
          decision={decision}
          onClose={() => setDecision(null)}
          onSuccess={() => {
            setDecision(null);
            refresh((n) => n + 1);
          }}
        />
      )}
      </div>
    </div>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span className={"admin-status admin-status--" + value}>
      {states[value] ?? value}
    </span>
  );
}
function DataTable({
  headings,
  empty,
  children,
}: {
  headings: string[];
  empty: boolean;
  children: ReactNode;
}) {
  return empty ? (
    <p role="status" className="admin-empty">
      Nenhum registro encontrado.
    </p>
  ) : (
    <div
      className="admin-table-scroll"
      role="region"
      aria-label="Registros administrativos"
      tabIndex={0}
    >
      <p className="admin-table-hint">Deslize para ver todas as colunas.</p>
      <table className="admin-table">
        <thead>
          <tr>
            {headings.map((h) => (
              <th scope="col" key={h}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function AuditTable({ items }: { items: AuditEntry[] }) {
  return (
    <DataTable
      headings={["Decisão", "Motivo", "Data e responsável"]}
      empty={items.length === 0}
    >
      {items.map((a) => (
        <tr key={a.id}>
          <td>
            {actionNames[a.action] ?? a.action}
            <small>
              {(a.before_state && states[a.before_state]) || a.before_state} →{" "}
              {(a.after_state && states[a.after_state]) || a.after_state}
            </small>
            <small>
              {a.target_type} {a.target_id}
            </small>
          </td>
          <td>{a.reason}</td>
          <td>
            {date(a.created_at)}
            <small className="admin-id">
              {a.actor_id ?? "Operação SQL revisada"}
            </small>
          </td>
        </tr>
      ))}
    </DataTable>
  );
}
function BusinessDetails({
  id,
  revision,
  decide,
  onHistory,
}: {
  id: string;
  revision: number;
  decide: (input: Omit<AdminAction, "reason">, label: string) => void;
  onHistory: () => void;
}) {
  const [page, setPage] = useState(1);
  return (
    <Resource<AdminDetail>
      section="detail"
      filters={{ id, page }}
      revision={revision}
    >
      {(data) => (
        <>
          <BusinessReview data={data} decide={decide} onHistory={onHistory} />
          <Pagination
            page={page}
            hasNext={data.servicesHasNext || data.photosHasNext}
            onChange={setPage}
            label="serviços e fotografias"
          />
        </>
      )}
    </Resource>
  );
}
function BusinessReview({
  data,
  decide,
  onHistory,
}: {
  data: AdminDetail;
  decide: (input: Omit<AdminAction, "reason">, label: string) => void;
  onHistory: () => void;
}) {
  const b = data.business,
    state = b.suspended ? "suspended" : b.status;
  return (
    <div className="admin-review">
      <h3>{b.name}</h3>
      <Status value={state} />
      <p>{b.description || "Descrição não informada."}</p>
      <p>
        {b.category ?? "Sem categoria"} · {b.city ?? "Sem cidade"}
      </p>
      <p>WhatsApp: {b.whatsapp ?? "Não informado"}</p>
      <div className="work-actions">
        {(b.suspended
          ? ["reactivate"]
          : b.status === "published"
            ? ["suspend"]
            : ["publish", "suspend"]
        ).map((command) => (
          <button
            key={command}
            className="button button--secondary"
            onClick={() =>
              decide(
                {
                  kind: "business",
                  target: b.id,
                  command: command as AdminAction["command"],
                  expected_state: state,
                },
                b.name,
              )
            }
          >
            {actionNames[command]}
          </button>
        ))}
      </div>
      <h3>Serviços</h3>
      {data.services.length === 0 ? (
        <p>Nenhum serviço cadastrado.</p>
      ) : (
        <ul className="admin-service-list">
          {data.services.map((s) => (
            <li key={s.id}>
              <strong>{s.name}</strong>
              <p>{s.description}</p>
              <small>
                {s.active ? "Ativo" : "Inativo"} ·{" "}
                {s.pricing_type === "quote"
                  ? "Sob orçamento"
                  : (s.pricing_type === "starting-at" ? "A partir de " : "") +
                    new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format((s.price_amount_cents ?? 0) / 100)}
              </small>
            </li>
          ))}
        </ul>
      )}
      <h3>Foto principal do perfil</h3>
      {data.profilePhoto ? <div className="admin-photo-grid"><AdminPhotoPreview key={data.profilePhoto} businessId={b.id} photo={{ id: 'profile-' + data.profilePhoto, storage_path: data.profilePhoto, caption: 'Foto principal do perfil', media_state: 'ready' }} /></div> : <p>Nenhuma foto principal informada.</p>}
      <h3>Fotografias de trabalhos</h3>
      {data.photos.length === 0 ? (
        <p>Nenhuma fotografia cadastrada.</p>
      ) : (
        <div className="admin-photo-grid">
          {data.photos.map((p) => (
            <AdminPhotoPreview key={p.id} businessId={b.id} photo={p} />
          ))}
        </div>
      )}
      <h3>Histórico recente</h3>
      <AuditTable items={data.history} />
      <button className="text-link" onClick={onHistory}>
        Ver histórico completo
      </button>
    </div>
  );
}
function AdminPhotoPreview({
  businessId,
  photo,
}: {
  businessId: string;
  photo: AdminDetail["photos"][number];
}) {
  const repo = useAdmin();
  const [expanded, setExpanded] = useState<string | null>(null),
    [error, setError] = useState(false),
    [busy, setBusy] = useState(false);
  const load = useCallback(
    async () =>
      photo.media_state === "ready" && repo
        ? repo.image(businessId, photo.storage_path)
        : null,
    [repo, businessId, photo.storage_path, photo.media_state],
  );
  const state = usePublicQuery(photo.id, load);
  async function enlarge() {
    if (!repo || busy) return;
    setBusy(true);
    try {
      setExpanded(await repo.image(businessId, photo.storage_path));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <figure>
      <button
        type="button"
        disabled={!state.data || busy}
        aria-label={"Ampliar " + (photo.caption ?? "fotografia")}
        onClick={() => void enlarge()}
      >
        {state.data && !error ? (
          <img
            src={state.data}
            alt={photo.caption ?? "Fotografia do portfólio"}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setError(true)}
          />
        ) : (
          <span>
            {photo.media_state === "ready"
              ? "Imagem indisponível"
              : "Arquivo " + photo.media_state}
          </span>
        )}
      </button>
      <figcaption>{photo.caption}</figcaption>
      {expanded && (
        <Modal
          title="Fotografia para análise"
          onClose={() => setExpanded(null)}
        >
          <img
            className="admin-expanded"
            src={expanded}
            alt={photo.caption ?? "Fotografia do portfólio"}
            referrerPolicy="no-referrer"
          />
        </Modal>
      )}
    </figure>
  );
}
function DecisionModal({
  decision,
  onClose,
  onSuccess,
}: {
  decision: { input: Omit<AdminAction, "reason">; label: string };
  onClose: () => void;
  onSuccess: () => void;
}) {
  const repo = useAdmin(),
    [reason, setReason] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const busy = useRef(false);
  async function submit() {
    if (!repo || busy.current) return;
    if (reason.trim().length < 5) {
      setError("Informe um motivo com pelo menos cinco caracteres.");
      return;
    }
    busy.current = true;
    setPending(true);
    setError("");
    try {
      await repo.act({ ...decision.input, reason: reason.trim() });
      onSuccess();
    } catch (e) {
      setError(adminError(e));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <Modal
      title={actionNames[decision.input.command] ?? "Confirmar decisão"}
      onClose={onClose}
      locked={pending}
    >
      <form
        className="admin-decision"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <strong>{decision.label}</strong>
        <p>Esta decisão será registrada no histórico com sua identificação.</p>
        {decision.input.kind === "user" &&
          decision.input.command === "reactivate" && (
            <p>Reativar a conta não republica seus negócios automaticamente.</p>
          )}
        {decision.input.kind === "post" &&
          decision.input.command === "release" && (
            <p>
              O trabalho ficará não publicado. O prestador precisará publicá-lo
              novamente.
            </p>
          )}
        <label>
          Motivo da decisão
          <textarea
            required
            minLength={5}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
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
          <button className="button button--primary" disabled={pending}>
            {pending ? "Registrando…" : "Confirmar decisão"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
const sandboxLabels: Record<SandboxDiagnostic["state"], string> = {
  connected: "Sandbox conectado e validado",
  missing: "Variável ausente",
  invalid: "Credencial inválida ou sem permissão",
  communication_error: "Falha de comunicação",
  not_validated: "Configuração não validada",
};
function SandboxPanel() {
  const repo = useAdmin(),
    [result, setResult] = useState<SandboxDiagnostic | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const busy = useRef(false);
  async function check() {
    if (!repo || busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      setResult(await repo.sandbox());
    } catch (e) {
      setError(adminError(e));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <section className="admin-sandbox" aria-label="Asaas Sandbox">
      <div>
        <h3>Asaas Sandbox</h3>
        <p role="status">
          {result ? sandboxLabels[result.state] : "Configuração não validada"}
        </p>
        {result && (
          <small>
            Verificado em {new Date(result.checkedAt).toLocaleString("pt-BR")}
            {result.httpStatus ? " · HTTP " + result.httpStatus : ""}
          </small>
        )}
      </div>
      <button
        className="button button--secondary"
        disabled={pending}
        onClick={() => void check()}
      >
        {pending ? "Verificando…" : "Validar conexão"}
      </button>
      {error && <p role="alert">{error}</p>}
      <p className="field-help">
        Somente leitura no sandbox. Nenhum cliente financeiro, cobrança ou
        assinatura será criado.
      </p>
    </section>
  );
}
