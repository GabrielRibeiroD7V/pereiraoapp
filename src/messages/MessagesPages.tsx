import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { ProfileAvatar } from "../components/ProfileAvatar";
import { useAuth } from "../auth/AuthProvider";
import { useMessages } from "./MessagesProvider";
import { messageError } from "./repository";
import type { ChatMessage, Conversation } from "./repository";
import "./messages.scss";

export function MessagesInboxPage() {
  const repository = useMessages();
  const { session } = useAuth();
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    setItems([]);
    setError("");
    setLoading(true);
    if (!repository) {
      setLoading(false);
      return;
    }
    let revision = 0;
    const load = async () => {
      const request = ++revision;
      try {
        const data = await repository.list();
        if (live && request === revision) {
          setItems(data);
          setError("");
        }
      } catch (cause) {
        if (live && request === revision) setError(messageError(cause));
      } finally {
        if (live && request === revision) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 20000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [repository, session?.user.id, retry]);
  return (
    <div className="messages-page">
      <Link className="back-link" to="/conta">
        Voltar ao perfil
      </Link>
      <PageHeader title="Mensagens">
        <p>Conversas entre pessoas, profissionais e clientes.</p>
      </PageHeader>
      {!repository && (
        <p role="status">Mensagens indisponíveis neste momento.</p>
      )}
      {loading && <p role="status">Carregando conversas…</p>}
      {error && (
        <div role="alert" className="form-error">
          <p>{error}</p>
          <button
            type="button"
            className="text-link"
            onClick={() => setRetry((value) => value + 1)}
          >
            Tentar novamente
          </button>
        </div>
      )}
      {repository && !loading && !error && items.length === 0 && (
        <p className="form-notice">
          Ainda não há conversas. Encontre uma publicação no feed ou um
          profissional na busca para iniciar uma conversa.
        </p>
      )}
      <ul className="conversation-list">
        {items.map((item) => (
          <li key={item.id}>
            <Link to={`/mensagens/${item.id}`}>
              <ProfileAvatar business={item.side === "customer"} />
              <span className="conversation-list__copy">
                <strong>
                  {item.side === "account"
                    ? item.peerName
                    : item.side === "customer"
                      ? item.businessName
                      : item.customerName}
                </strong>
                {item.side === "professional" && (
                  <small>{item.businessName}</small>
                )}
                <span>{item.lastMessage}</span>
              </span>
              <time dateTime={item.updatedAt}>
                {new Intl.DateTimeFormat("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date(item.updatedAt))}
              </time>
            </Link>
          </li>
        ))}
      </ul>
      <Link className="text-link" to="/buscar">
        Buscar profissionais
      </Link>
    </div>
  );
}

export function NewConversationPage() {
  const { businessId = "" } = useParams();
  const repository = useMessages();
  const navigate = useNavigate();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!repository || submitting.current || !body.trim()) return;
    submitting.current = true;
    setPending(true);
    setError("");
    try {
      const id = await repository.open(businessId, body.trim());
      navigate(`/mensagens/${id}`, { replace: true });
    } catch (cause) {
      setError(messageError(cause));
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }
  return (
    <div className="messages-page">
      <Link className="back-link" to="/buscar">
        Voltar à busca
      </Link>
      <PageHeader title="Enviar mensagem">
        <p>Escreva para o profissional pelo PEREIRÃO.</p>
      </PageHeader>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {!repository && (
        <p role="status">Mensagens indisponíveis neste momento.</p>
      )}
      <form className="message-form" onSubmit={submit}>
        <label htmlFor="first-message">Sua mensagem</label>
        <textarea
          id="first-message"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={2000}
          rows={5}
          required
          placeholder="Olá! Gostaria de saber mais sobre o seu serviço."
        />
        <button
          className="button button--primary"
          disabled={!repository || pending || !body.trim()}
        >
          {pending ? "Enviando…" : "Enviar mensagem"}
        </button>
      </form>
    </div>
  );
}

export function ConversationPage() {
  const { conversationId = "" } = useParams();
  const repository = useMessages();
  const { session } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [items, setItems] = useState<ChatMessage[]>([]);
  const [older, setOlder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const busy = useRef(false);
  const request = useRef<{ body: string; id: string } | null>(null);
  const showingOlder = useRef(false);
  const loadRevision = useRef(0);
  const load = useCallback(
    async (quiet = false) => {
      if (!repository) {
        setLoading(false);
        return;
      }
      const request = ++loadRevision.current;
      try {
        const [conversations, page] = await Promise.all([
          repository.list(),
          repository.messages(conversationId),
        ]);
        if (request !== loadRevision.current) return;
        const current = conversations.find(
          (item) => item.id === conversationId,
        );
        if (!current) throw { code: "42501" };
        setConversation(current);
        setItems((previous) =>
          quiet && showingOlder.current
            ? [
                ...previous.filter(
                  (message) =>
                    !page.items.some((fresh) => fresh.id === message.id),
                ),
                ...page.items,
              ]
            : page.items,
        );
        if (!quiet || !showingOlder.current) setOlder(page.hasMore);
        setError("");
      } catch (cause) {
        if (request === loadRevision.current) setError(messageError(cause));
      } finally {
        if (request === loadRevision.current) setLoading(false);
      }
    },
    [repository, conversationId],
  );
  useEffect(() => {
    showingOlder.current = false;
    setItems([]);
    setConversation(null);
    setLoading(true);
    setOlder(false);
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, 12000);
    return () => {
      loadRevision.current++;
      window.clearInterval(timer);
    };
  }, [load, session?.user.id]);
  async function loadOlder() {
    if (!repository || !items[0] || pending) return;
    setPending(true);
    try {
      const page = await repository.messages(conversationId, items[0].id);
      showingOlder.current = true;
      setItems((previous) => [...page.items, ...previous]);
      setOlder(page.hasMore);
      setError("");
    } catch (cause) {
      setError(messageError(cause));
    } finally {
      setPending(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!repository || !body.trim() || busy.current) return;
    const submittedBody = body;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      if (request.current?.body !== submittedBody.trim())
        request.current = {
          body: submittedBody.trim(),
          id: crypto.randomUUID(),
        };
      await repository.send(
        conversationId,
        submittedBody.trim(),
        request.current.id,
      );
      request.current = null;
      setBody((current) => (current === submittedBody ? "" : current));
      await load(true);
    } catch (cause) {
      setError(messageError(cause));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <div className="messages-page">
      <Link className="back-link" to="/mensagens">
        Todas as conversas
      </Link>
      <PageHeader
        title={
          conversation
            ? conversation.side === "account"
              ? (conversation.peerName || "Conta PEREIRÃO")
              : conversation.side === "customer"
                ? conversation.businessName
                : conversation.customerName
            : "Conversa"
        }
      />
      {conversation?.side === "account" && (
        <Link className="text-link" to={`/pessoas/${conversation.peerId}`}>
          Ver publicações do perfil
        </Link>
      )}
      {conversation?.side === "customer" && (
        <Link
          className="text-link"
          to={`/prestadores/${conversation.businessSlug}`}
        >
          Ver perfil profissional e WhatsApp
        </Link>
      )}
      {loading && <p role="status">Carregando mensagens…</p>}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {older && (
        <button
          className="button button--secondary"
          disabled={pending}
          onClick={() => void loadOlder()}
        >
          Carregar mensagens anteriores
        </button>
      )}
      <ol className="message-list" aria-label="Mensagens da conversa">
        {items.map((item) => (
          <li
            key={item.id}
            className={
              item.senderId === session?.user.id ? "message-list__mine" : ""
            }
          >
            <p>{item.body}</p>
            <time dateTime={item.createdAt}>
              {new Intl.DateTimeFormat("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(item.createdAt))}
            </time>
          </li>
        ))}
      </ol>
      {conversation && (
        <form className="message-form" onSubmit={submit}>
          <label htmlFor="reply-message">Responder</label>
          <textarea
            id="reply-message"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={2000}
            rows={3}
            required
          />
          <button
            className="button button--primary"
            disabled={pending || !body.trim()}
          >
            {pending ? "Enviando…" : "Enviar"}
          </button>
        </form>
      )}
    </div>
  );
}

export function NewAccountConversationPage() {
  const { authorId, workId } = useParams(),
    repository = useMessages(),
    navigate = useNavigate();
  const [body, setBody] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const busy = useRef(false),
    request = useRef<{ body: string; id: string } | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!repository?.openAccount || busy.current || !body.trim()) return;
    busy.current = true;
    setPending(true);
    setError("");
    if (request.current?.body !== body.trim())
      request.current = { body: body.trim(), id: crypto.randomUUID() };
    try {
      const id = await repository.openAccount(
        { author: authorId, work: workId },
        body.trim(),
        request.current.id,
      );
      navigate(`/mensagens/${id}`, { replace: true });
    } catch (e) {
      setError(messageError(e));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <div className="messages-page">
      <Link
        className="back-link"
        to={workId ? `/trabalhos/${workId}` : `/pessoas/${authorId}`}
      >
        Voltar à publicação ou perfil
      </Link>
      <PageHeader title="Conversar com o autor">
        <p>
          Sua mensagem será privada entre as duas contas. Não envie dados
          sensíveis desnecessários.
        </p>
      </PageHeader>
      {error && <p role="alert">{error}</p>}
      <form className="message-form" onSubmit={submit}>
        <label htmlFor="account-first-message">Sua mensagem</label>
        <textarea
          id="account-first-message"
          required
          rows={5}
          maxLength={2000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button
          className="button button--primary"
          disabled={pending || !repository?.openAccount || !body.trim()}
        >
          {pending ? "Enviando…" : "Enviar mensagem"}
        </button>
      </form>
    </div>
  );
}
