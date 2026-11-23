import { useInstallOpportunity } from './useInstallOpportunity';
import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  useState,
  useRef,
  useLayoutEffect,
} from "react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Download,
  X,
  Share,
  SquarePlus,
  Check,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import { Modal } from "../components/Modal";
import { Brand } from "../components/Brand";
import { PwaController, isSensitivePath } from "./controller";
import type { PwaState } from "./controller";
const Context = createContext<PwaController | null>(null);
const inactive: PwaState = {
  runningVersion: null, publishedVersion: null, sessionRefreshRequired: false,
  installed: false,
  ios: false,
  safari: false,
  canInstall: false,
  installing: false,
  dismissed: false,
  online: true,
  refreshRequired: false,
  updateReady: false,
  updating: false,
  installError: false,
  updateError: false,
  worker: "unavailable",
};
const noop = () => () => {};
const snapshot = () => inactive;
export function PwaProvider({
  controller,
  children,
}: {
  controller: PwaController;
  children: ReactNode;
}) {
  return <Context.Provider value={controller}>{children}</Context.Provider>;
}
function usePwa() {
  const controller = useContext(Context),
    state = useSyncExternalStore(
      controller?.subscribe ?? noop,
      controller?.getSnapshot ?? snapshot,
      snapshot,
    );
  return { controller, state };
}
export function InstallInvitation() {
  const { controller, state } = usePwa(),
    [help, setHelp] = useState(false);
  const { pathname } = useLocation();
  const opportunity = useInstallOpportunity(pathname);
  if (
    !opportunity ||
    !state.online ||
    !controller ||
    state.installed ||
    state.dismissed ||
    (!state.canInstall &&
      !state.ios &&
      !state.installing &&
      !state.installError)
  )
    return null;
  return (
    <section className="pwa-install" aria-label="Instalar PEREIRÃO">
      <button type="button" className="pwa-install-close icon-button" aria-label="Dispensar convite de instalação" onClick={() => controller.dismiss()}><X size={17} aria-hidden="true" /></button>
      <img src="/images/pwa/icon-192.png" width="32" height="32" alt="" />
      <div>
        <h2>PEREIRÃO na sua tela inicial</h2>
        <div className="pwa-install-actions">
          {state.canInstall || state.installing ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={state.installing}
              onClick={() => void controller.install()}
            >
              <Download size={17} aria-hidden="true" />
              {state.installing ? "Abrindo instalação…" : "Instalar PEREIRÃO"}
            </button>
          ) : state.ios ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setHelp(true)}
            >
              Como adicionar no iPhone
            </button>
          ) : null}

        </div>
        {state.installError && (
          <p role="alert">
            Não foi possível abrir a instalação. Tente pelo menu do navegador.
          </p>
        )}
      </div>
      {help && <IosInstallHelp safari={state.safari} onClose={() => setHelp(false)} onUnderstood={() => controller.dismiss()} />}
    </section>
  );
}
function IosInstallHelp({ safari, onClose, onUnderstood }: { safari: boolean; onClose: () => void; onUnderstood?: () => void }) {
  return (
        <Modal
          title="Adicionar à Tela de Início"
          onClose={() => onClose()}
        >
          <div className="pwa-ios-help">
            <img src="/images/pwa/icon-192.png" width="48" height="48" alt="Ícone oficial do PEREIRÃO" />
            {!safari && (
              <p>Abra este mesmo endereço no Safari. Depois, siga os passos abaixo; este navegador não disponibiliza a instalação nativa do iPhone.</p>
            )}
            <ol>
              <li>
                <span>
                  Comece pela <Link className="text-link" to="/" onClick={() => onClose()}>tela Início</Link> antes de adicionar o ícone.
                </span>
              </li>
              <li>
                <Share aria-hidden="true" />
                <span>
                  No Safari, toque em <strong>Compartilhar</strong>.
                </span>
              </li>
              <li>
                <SquarePlus aria-hidden="true" />
                <span>
                  Escolha <strong>Adicionar à Tela de Início</strong>. Role o
                  menu se necessário.
                </span>
              </li>
              <li>
                <Check aria-hidden="true" />
                <span>
                  Toque em <strong>Adicionar</strong>. Se aparecer{" "}
                  <strong>Abrir como App</strong>, mantenha a opção ativada.
                </span>
              </li>
            </ol>
            <p className="field-help">Se já adicionou o PEREIRÃO, abra pelo ícone existente; não crie outro atalho.</p>
            <p className="field-help">
              Ao abrir pelo ícone da tela inicial, o PEREIRÃO funciona como
              aplicativo quando o sistema oferece esse modo.
            </p>
            <button
              className="button button--primary"
              onClick={() => {
                onClose();
                onUnderstood?.();
              }}
            >
              Entendi
            </button>
          </div>
        </Modal>
  );
}

/** Always available in Conta, independently of the optional invitation cooldown. */
export function InstallAppAccess() {
  const { controller, state } = usePwa();
  const [help, setHelp] = useState(false);
  const nativeAvailable = state.canInstall && !state.installed;
  return <section id="instalar-aplicativo" className="account-install" aria-label="Aplicativo PEREIRÃO">
    <img src="/images/pwa/icon-192.png" width="32" height="32" alt="" />
    <div>
      {state.installed ? <p role="status">PEREIRÃO aberto como aplicativo instalado.</p> : <>
        <button type="button" className="text-link" disabled={state.installing} onClick={() => {
          if (nativeAvailable) void controller?.install();
          else setHelp(true);
        }}>{state.installing ? 'Abrindo instalação…' : state.ios ? 'Adicionar à Tela de Início' : 'Instalar aplicativo'}</button>
        <p className="field-help">{nativeAvailable ? 'Instale pelo navegador, sem alterar sua conta.' : 'Veja como adicionar o PEREIRÃO ao seu dispositivo.'}</p>
      </>}
      {state.installError && <p role="alert">Não foi possível abrir a instalação. Tente novamente pelo menu do navegador.</p>}
    </div>
    {help && !state.installed && (state.ios ? <IosInstallHelp safari={state.safari} onClose={() => setHelp(false)} /> :
      <Modal title="Instalar aplicativo" onClose={() => setHelp(false)}>
        <p>O navegador não disponibilizou a instalação direta nesta página. Se houver uma opção Instalar aplicativo no menu ou na barra de endereço do navegador, use-a.</p>
        <p>Se já adicionou o PEREIRÃO, abra pelo ícone existente. Não é necessário criar outro atalho.</p>
        <button type="button" className="button button--primary" onClick={() => setHelp(false)}>Entendi</button>
      </Modal>)}
  </section>;
}

export function PwaGate({ children }: { children: ReactNode }) {
  const { controller, state } = usePwa(),
    { pathname, search } = useLocation();
  const newerBuild = Boolean(state.publishedVersion && state.runningVersion !== state.publishedVersion);
  const sensitive = isSensitivePath(pathname),
    showNotice = !state.online || state.sessionRefreshRequired || state.updateError,
    guard = sensitive && (!state.online || state.sessionRefreshRequired);
  const content = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!guard || !content.current) return;
    const hideDialogs = () => {
      for (const dialog of content.current!.querySelectorAll<HTMLDialogElement>(
        "dialog[open]",
      )) {
        if (typeof dialog.close === "function") dialog.close();
        else dialog.removeAttribute("open");
      }
    };
    hideDialogs();
    const observer = new MutationObserver(hideDialogs);
    observer.observe(content.current, {
      subtree: true,
      attributes: true,
      attributeFilter: ["open"],
      childList: true,
    });
    return () => observer.disconnect();
  }, [guard]);
  useEffect(() => {
    void controller?.checkForUpdate(true);
  }, [controller, pathname]);
  const updateButton = (
    <button
      type="button"
      className="button button--secondary"
      disabled={!state.online || state.updating}
      onClick={() => controller?.update()}
    >
      <RefreshCw size={17} aria-hidden="true" />
      {state.updating
        ? "Atualizando…"
        : state.updateReady || newerBuild
          ? "Atualizar aplicativo"
          : "Recarregar aplicativo"}
    </button>
  );
  return (
    <>
      {!guard && showNotice && (
        <aside className="pwa-notice" aria-label="Estado do aplicativo">
          <div>
            {!state.online ? (
              <>
                <WifiOff size={18} aria-hidden="true" />
                <span>
                  Sem conexão. Reconecte-se para consultar informações
                  atualizadas.
                </span>
              </>
            ) : (
              <>
                <RefreshCw size={18} aria-hidden="true" />
                <span>
                  {state.updateDeferred
                    ? "Outra aba privada ainda não confirmou a atualização. Salve o trabalho nela e volte ao Início para concluir."
                    : state.updateReady || newerBuild
                    ? "Nova versão disponível."
                    : "Conexão restabelecida. Recarregue para validar sua sessão."}{" "}
                  {state.updateDeferred && 'Salve suas alterações antes de atualizar. Sua sessão será preservada.'}
                </span>
              </>
            )}
          </div>
          {state.online && updateButton}
          {state.updateError && (
            <p role="alert">Não foi possível atualizar. Tente novamente.</p>
          )}
        </aside>
      )}
      {guard && (
        <main className="pwa-blocked">
          <Brand />
          {!state.online ? (
            <>
              <WifiOff size={32} aria-hidden="true" />
              <h1>Conecte-se para acessar sua conta</h1>
              <p>
                A conta e a administração precisam de internet. Seus dados
                privados não ficam disponíveis no cache offline.
              </p>
            </>
          ) : (
            <>
              <h1>
                {state.updateReady
                  ? "Atualize para continuar"
                  : "Valide sua sessão novamente"}
              </h1>
              <p>
                Recarregue o aplicativo para conferir sua sessão e as permissões
                atuais. Isso pode descartar alterações ainda não salvas.
              </p>
              {updateButton}
            </>
          )}
          <Link className="text-link" to="/">
            Voltar ao início
          </Link>
          {state.updateError && (
            <p role="alert">Não foi possível atualizar. Tente novamente.</p>
          )}
          {new URLSearchParams(search).get('pwa-diagnostico') === '1' && <VersionDiagnostics />}
        </main>
      )}
      <div
        ref={content}
        className={guard ? "pwa-private-hidden" : undefined}
        hidden={guard}
        inert={guard ? true : undefined}
      >
        {children}
      </div>
    </>
  );
}

/** Diagnóstico sob demanda, sem sessão, identificação pessoal ou conteúdo do cache. */
export function VersionDiagnostics() {
  const { controller } = usePwa();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<import('./workerVersion').PwaDiagnostics | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!controller) return null;
  async function inspect() {
    setPending(true); setFailed(false);
    try { setData(await controller!.diagnostics()); } catch { setFailed(true); }
    finally { setPending(false); }
  }
  const version = (value: string | null) => value ?? 'Não informada (legado ou sem resposta)';
  return <div className="pwa-diagnostics-entry">
    <button type="button" className="text-link" onClick={() => { setOpen(true); void inspect(); }}>Versão e atualização</button>
    {open && <Modal title="Versão do PEREIRÃO" onClose={() => setOpen(false)}>
      <p className="field-help">Somente informações técnicas públicas. Nenhuma senha, sessão ou fotografia é consultada.</p>
      {pending && <p role="status">Consultando versões…</p>}
      {failed && <p role="alert">Não foi possível consultar agora. Tente novamente.</p>}
      {data && <>
        <dl className="pwa-diagnostics-list">
          <dt>Origem desta instalação</dt><dd>{data.origin}</dd>
          <dt>Modo</dt><dd>{data.installed ? 'Aplicativo independente' : 'Aba do navegador'}</dd>
          <dt>Versão em execução</dt><dd>{version(data.running)}</dd>
          <dt>Última versão publicada consultada</dt><dd>{version(data.published)}</dd>
          <dt>Última consulta bem-sucedida</dt><dd>{data.publishedCheckedAt ? new Date(data.publishedCheckedAt).toLocaleString('pt-BR') : 'Nenhuma'}</dd>
          <dt>Worker que controla esta página</dt><dd>{version(data.controller)}</dd>
          <dt>Worker ativo</dt><dd>{data.active ? `${data.active.state} · ${version(data.active.version)}` : 'Nenhum'}</dd>
          <dt>Worker em espera</dt><dd>{data.waiting ? `${data.waiting.state} · ${version(data.waiting.version)}` : 'Nenhum'}</dd>
          <dt>Worker instalando</dt><dd>{data.installing ?? 'Nenhum'}</dd>
          <dt>Retorno por BFCache</dt><dd>{data.restoredFromHistory === null ? 'Não observado' : data.restoredFromHistory ? 'Sim' : 'Não no último pageshow'}</dd>
          <dt>Versões de cache estático do PEREIRÃO</dt><dd>{data.staticCacheVersions.join(', ') || 'Nenhuma ou indisponível'}</dd>
        </dl>
        {!data.online && <p className="form-notice">Sem conexão. A versão publicada é a última consulta bem-sucedida, não uma confirmação online.</p>}
        {(!data.controller || (data.active && !data.active.version)) && <p className="form-notice">Um worker antigo pode não informar sua versão. Salve o trabalho nas abas antigas. Se o botão antigo não concluir, recarregue normalmente a página pública ou já salva. Não apague dados do navegador.</p>}
        {data.origin !== 'https://pereirao.vercel.app' && <p className="form-notice">Esta origem não é o endereço oficial de produção. Um atalho de Preview ou de teste não acompanha as publicações de pereirao.vercel.app.</p>}
      </>}
      <button type="button" className="button button--secondary" disabled={pending} onClick={() => void inspect()}>Conferir novamente</button>
    </Modal>}
  </div>;
}
