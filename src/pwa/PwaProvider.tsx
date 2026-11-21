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
  if (
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
      <img src="/images/pwa/icon-192.png" width="48" height="48" alt="" />
      <div>
        <h2>PEREIRÃO na sua tela inicial</h2>
        <p>Abra o aplicativo com um toque, sem procurar no navegador.</p>
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
          <button
            type="button"
            className="text-link"
            onClick={() => controller.dismiss()}
          >
            Agora não
          </button>
        </div>
        {state.installError && (
          <p role="alert">
            Não foi possível abrir a instalação. Tente pelo menu do navegador.
          </p>
        )}
      </div>
      {help && (
        <Modal
          title="Adicionar à Tela de Início"
          onClose={() => setHelp(false)}
        >
          <div className="pwa-ios-help">
            {!state.safari && (
              <p>Abra esta página no Safari para seguir as instruções.</p>
            )}
            <ol>
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
            <p className="field-help">
              Ao abrir pelo ícone da tela inicial, o PEREIRÃO funciona como
              aplicativo quando o sistema oferece esse modo.
            </p>
            <button
              className="button button--primary"
              onClick={() => {
                setHelp(false);
                controller.dismiss();
              }}
            >
              Entendi
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
export function PwaGate({ children }: { children: ReactNode }) {
  const { controller, state } = usePwa(),
    { pathname } = useLocation();
  const sensitive = isSensitivePath(pathname),
    stale = state.updateReady || state.refreshRequired,
    guard = sensitive && (!state.online || state.refreshRequired);
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
    void controller?.checkForUpdate();
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
        : state.updateReady
          ? "Atualizar aplicativo"
          : "Recarregar aplicativo"}
    </button>
  );
  return (
    <>
      {!guard && (!state.online || stale) && (
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
                  {state.updateReady
                    ? "Nova versão disponível."
                    : "Conexão restabelecida ou versão atualizada."}{" "}
                  Salve suas alterações antes de recarregar.
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
