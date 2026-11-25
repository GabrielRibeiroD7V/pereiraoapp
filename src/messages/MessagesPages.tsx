import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, Bell, Send } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ProfileAvatar } from "../components/ProfileAvatar";
import { useAuth } from "../auth/AuthProvider";
import { PublicImage } from "../marketplace/PublicImage";
import { useMessages, useMessageStatus } from "./MessagesProvider";
import { messageError } from "./repository";
import type { ChatMessage, Conversation, MessageTarget, PushState } from "./repository";
import "./messages.scss";

function nameOf(item: Conversation) {
  return item.side === "account" ? item.peerName || "Conta PEREIRÃO" : item.side === "customer" ? item.businessName : item.customerName;
}

function Avatar({ item, target }: { item?: Conversation; target?: MessageTarget | null }) {
  const business = target?.kind === "business" || (!!item && item.side === "customer");
  const businessId = target?.id || item?.businessId || "";
  const path = target?.businessAvatarPath || item?.businessAvatarPath;
  const url = target?.avatarUrl || (item?.side === "account" ? item.peerAvatarUrl : item?.customerAvatarUrl);
  return <span className="chat-avatar">{business && path ? <PublicImage businessId={businessId} path={path} alt="" avatar /> : <ProfileAvatar src={url} business={business} />}</span>;
}

function Composer({ value, setValue, onSubmit, pending, disabled, first = false }: { value: string; setValue: (value: string) => void; onSubmit: (event: FormEvent) => void; pending: boolean; disabled?: boolean; first?: boolean }) {
  return <form className="chat-composer" onSubmit={onSubmit}>
    <label className="sr-only" htmlFor={first ? "first-message" : "reply-message"}>{first ? "Sua mensagem" : "Responder"}</label>
    <textarea id={first ? "first-message" : "reply-message"} value={value} onChange={event => setValue(event.target.value)} maxLength={2000} rows={1} required placeholder="Mensagem…" onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
    <button type="submit" aria-label={first ? "Enviar mensagem" : "Enviar"} disabled={disabled || pending || !value.trim()}><Send aria-hidden="true" size={22} /></button>
  </form>;
}

function PushControl() {
  const repository = useMessages();
  const [state, setState] = useState<PushState | "loading">("loading");
  useEffect(() => { let live = true; void repository?.pushState?.().then(value => { if (live) setState(value); }).catch(() => { if (live) setState("unsupported"); }); return () => { live = false; }; }, [repository]);
  if (!repository?.enablePush || state === "loading" || state === "unsupported") return null;
  if (state === "enabled") return <p className="notification-state"><Bell size={17} aria-hidden="true" /> Notificações ativadas</p>;
  return <div className="notification-control"><button type="button" onClick={() => { setState("loading"); void repository.enablePush!().then(setState).catch(() => setState("available")); }}><Bell size={18} aria-hidden="true" /> Ativar notificações</button>{state === "denied" && <small>Permita as notificações nos ajustes do aparelho.</small>}</div>;
}

export function MessagesInboxPage() {
  const repository = useMessages(), { session } = useAuth(), { revision } = useMessageStatus();
  const [items, setItems] = useState<Conversation[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const load = useCallback(async () => { if (!repository) { setLoading(false); return; } try { setItems(await repository.list()); setError(""); } catch (cause) { setError(messageError(cause)); } finally { setLoading(false); } }, [repository]);
  useEffect(() => { setLoading(true); void load(); const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 30000); return () => window.clearInterval(timer); }, [load, session?.user.id, revision]);
  return <div className="messages-page inbox-page">
    <header className="inbox-header"><div><h1>Mensagens</h1><p>Conversas no PEREIRÃO</p></div><PushControl /></header>
    {!repository && <p role="status">Mensagens indisponíveis neste momento.</p>}
    {loading && <p role="status">Carregando conversas…</p>}
    {error && <div role="alert" className="form-error"><p>{error}</p><button type="button" className="text-link" onClick={() => void load()}>Tentar novamente</button></div>}
    {repository && !loading && !error && !items.length && <div className="chat-empty"><strong>Ainda não há conversas</strong><p>Encontre um profissional e envie a primeira mensagem.</p><Link className="button button--primary" to="/buscar">Buscar profissionais</Link></div>}
    <ul className="conversation-list">{items.map(item => <li key={item.id} className={item.unreadCount ? "conversation-list__unread" : ""}><Link to={`/mensagens/${item.id}`}>
      <Avatar item={item} />
      <span className="conversation-list__copy"><span className="conversation-list__top"><strong>{nameOf(item)}</strong><time dateTime={item.updatedAt}>{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(item.updatedAt))}</time></span>{item.side === "professional" && <small>{item.businessName}</small>}<span className="conversation-list__preview">{item.lastMessage}</span></span>
      {!!item.unreadCount && <span className="conversation-list__badge" aria-label={`${item.unreadCount} mensagens não lidas`}>{item.unreadCount > 99 ? "99+" : item.unreadCount}</span>}
    </Link></li>)}</ul>
  </div>;
}

function NewChat({ target, back, submit, body, setBody, pending, error, available }: { target: MessageTarget | null; back: string; submit: (event: FormEvent) => void; body: string; setBody: (value: string) => void; pending: boolean; error: string; available: boolean }) {
  return <div className="messages-page chat-page new-chat-page">
    <header className="chat-header"><Link to={back} aria-label="Voltar"><ArrowLeft aria-hidden="true" /></Link><Avatar target={target} /><div><strong>{target?.name || "Nova conversa"}</strong><span>{target?.kind === "business" ? "Perfil profissional" : "Perfil PEREIRÃO"}</span></div></header>
    <main className="chat-history"><div className="chat-empty"><strong>Comece a conversa</strong><p>Envie uma mensagem para {target?.name || "este perfil"}.</p></div>{error && <p role="alert" className="form-error">{error}</p>}</main>
    <Composer value={body} setValue={setBody} onSubmit={submit} pending={pending} disabled={!available} first />
  </div>;
}

export function NewConversationPage() {
  const { businessId = "" } = useParams(), repository = useMessages(), navigate = useNavigate();
  const [target, setTarget] = useState<MessageTarget | null>(null), [body, setBody] = useState(""), [pending, setPending] = useState(false), [error, setError] = useState("");
  const busy = useRef(false);
  useEffect(() => { let live = true; void repository?.businessTarget?.(businessId).then(value => { if (live) setTarget(value); }).catch(() => {}); return () => { live = false; }; }, [repository, businessId]);
  async function submit(event: FormEvent) { event.preventDefault(); if (!repository || busy.current || !body.trim()) return; busy.current = true; setPending(true); setError(""); try { navigate(`/mensagens/${await repository.open(businessId, body.trim())}`, { replace: true }); } catch (cause) { setError(messageError(cause)); } finally { busy.current = false; setPending(false); } }
  return <NewChat target={target} back={`/prestadores/${target?.slug || businessId}`} submit={submit} body={body} setBody={setBody} pending={pending} error={error} available={!!repository} />;
}

export function ConversationPage() {
  const { conversationId = "" } = useParams(), repository = useMessages(), { session } = useAuth(), { revision, refresh } = useMessageStatus();
  const [conversation, setConversation] = useState<Conversation | null>(null), [items, setItems] = useState<ChatMessage[]>([]), [older, setOlder] = useState(false), [loading, setLoading] = useState(true), [pending, setPending] = useState(false), [body, setBody] = useState(""), [error, setError] = useState("");
  const busy = useRef(false), request = useRef<{body:string;id:string}|null>(null), bottom = useRef<HTMLDivElement>(null), loadRevision = useRef(0);
  const load = useCallback(async () => {
    if (!repository) { setLoading(false); return; }
    const rev = ++loadRevision.current;
    try {
      const [conversations, page] = await Promise.all([repository.list(), repository.messages(conversationId)]);
      if (rev !== loadRevision.current) return;
      const current = conversations.find(item => item.id === conversationId);
      if (!current) throw { code: "42501" };
      setConversation(current); setItems(page.items); setOlder(page.hasMore); setError("");
      await repository.markRead?.(conversationId); refresh();
    } catch (cause) { if (rev === loadRevision.current) setError(messageError(cause)); }
    finally { if (rev === loadRevision.current) setLoading(false); }
  }, [repository, conversationId, refresh]);
  useEffect(() => {
    setLoading(true); void load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 12000);
    return () => { loadRevision.current++; window.clearInterval(timer); };
  }, [load, session?.user.id, revision]);
  useEffect(() => { if (typeof bottom.current?.scrollIntoView === "function") bottom.current.scrollIntoView({ block: "end" }); }, [items.length]);
  async function loadOlder() {
    if (!repository || !items[0] || pending) return;
    setPending(true);
    try { const page = await repository.messages(conversationId, items[0].id); setItems(previous => [...page.items, ...previous]); setOlder(page.hasMore); }
    catch (cause) { setError(messageError(cause)); }
    finally { setPending(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!repository || !body.trim() || busy.current) return;
    const text = body.trim(); busy.current = true; setPending(true); setError("");
    if (request.current?.body !== text) request.current = { body: text, id: crypto.randomUUID() };
    const optimistic: ChatMessage = { id: request.current.id, body: text, senderId: session?.user.id || "", createdAt: new Date().toISOString() };
    setItems(current => [...current, optimistic]); setBody("");
    try { await repository.send(conversationId, text, request.current.id); request.current = null; await load(); }
    catch (cause) { setItems(current => current.filter(item => item.id !== optimistic.id)); setBody(current => current || text); setError(messageError(cause)); }
    finally { busy.current = false; setPending(false); }
  }
  const profile = conversation?.side === "account" ? `/pessoas/${conversation.peerId}` : conversation?.side === "customer" ? `/prestadores/${conversation.businessSlug}` : undefined;
  return <div className="messages-page chat-page">
    <header className="chat-header"><Link to="/mensagens" aria-label="Voltar às conversas"><ArrowLeft aria-hidden="true" /></Link>{conversation && <Avatar item={conversation} />}<div><h1 className="sr-only">{conversation ? nameOf(conversation) : "Conversa"}</h1>{profile ? <Link to={profile} aria-label={conversation?.side === "account" ? "Ver publicações do perfil" : "Ver perfil profissional e WhatsApp"}><strong aria-hidden="true">{conversation ? nameOf(conversation) : "Conversa"}</strong></Link> : <strong>{conversation ? nameOf(conversation) : "Conversa"}</strong>}<span>{conversation?.side === "professional" ? conversation.businessName : "PEREIRÃO"}</span></div></header>
    <main className="chat-history" aria-live="polite">{loading && <p role="status">Carregando mensagens…</p>}{error && <p role="alert" className="form-error">{error}</p>}{older && <button className="older-messages" disabled={pending} onClick={() => void loadOlder()}>Carregar mensagens anteriores</button>}<ol className="message-list" aria-label="Mensagens da conversa">{items.map(item => { const mine = item.senderId === session?.user.id; return <li key={item.id} className={mine ? "message-list__mine" : ""}><p>{item.body}</p><time dateTime={item.createdAt}>{new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(item.createdAt))}</time></li>; })}</ol><div ref={bottom} /></main>
    {conversation && <Composer value={body} setValue={setBody} onSubmit={submit} pending={pending} />}
  </div>;
}

export function NewAccountConversationPage() {
  const { authorId, workId } = useParams(), repository = useMessages(), navigate = useNavigate();
  const [target, setTarget] = useState<MessageTarget | null>(null), [body, setBody] = useState(""), [pending, setPending] = useState(false), [error, setError] = useState("");
  const busy = useRef(false), request = useRef<{ body: string; id: string } | null>(null);
  useEffect(() => { let live = true; void repository?.accountTarget?.({ author: authorId, work: workId }).then(value => { if (live) setTarget(value); }).catch(() => {}); return () => { live = false; }; }, [repository, authorId, workId]);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!repository?.openAccount || busy.current || !body.trim()) return;
    busy.current = true; setPending(true); setError(""); const text = body.trim();
    if (request.current?.body !== text) request.current = { body: text, id: crypto.randomUUID() };
    try { const id = await repository.openAccount({ author: authorId, work: workId }, text, request.current.id); navigate(`/mensagens/${id}`, { replace: true }); }
    catch (cause) { setError(messageError(cause)); }
    finally { busy.current = false; setPending(false); }
  }
  return <NewChat target={target} back={workId ? `/trabalhos/${workId}` : `/pessoas/${authorId}`} submit={submit} body={body} setBody={setBody} pending={pending} error={error} available={!!repository?.openAccount} />;
}
