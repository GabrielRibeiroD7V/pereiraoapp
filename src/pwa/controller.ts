import { workerVersion } from './workerVersion';
import type { PwaDiagnostics } from './workerVersion';
export interface InstallPromptEvent extends Event {
  prompt(): Promise<unknown>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}
export interface PwaState {
  runningVersion: string | null;
  publishedVersion: string | null;
  sessionRefreshRequired: boolean;
  installed: boolean;
  ios: boolean;
  safari: boolean;
  canInstall: boolean;
  installing: boolean;
  dismissed: boolean;
  online: boolean;
  refreshRequired: boolean;
  updateReady: boolean;
  updating: boolean;
  installError: boolean;
  updateError: boolean;
  updateDeferred?: boolean;
  worker: "unavailable" | "registering" | "ready" | "failed";
}
export function isSensitivePath(path: string) {
  // React Router aceita variações de caixa; a proteção deve classificar igual.
  path = path.toLowerCase();
  return (
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path === "/conta" ||
    path.startsWith("/conta/") ||
    path === "/mensagens" ||
    path.startsWith("/mensagens/") ||
    [
      "/entrar",
      "/criar-conta",
      "/recuperar-senha",
      "/redefinir-senha",
      "/auth/retorno",
    ].includes(path)
  );
}
export class PwaController {
  private listeners = new Set<() => void>();
  private cleanups: (() => void)[] = [];
  private registration: ServiceWorkerRegistration | null = null;
  private waiting: ServiceWorker | null = null;
  private prompt: InstallPromptEvent | null = null;
  private started = false;
  private disposed = false;
  private controlled: boolean;
  private lastCheck = 0;
  private updateTimer: number | undefined;
  private state: PwaState;
  private checking: Promise<void> | null = null;
  private waitingVersion: string | null = null;
  private lastVersionSuccess: number | null = null;
  private activationVersion: string | null = null;
  private restoredFromHistory: boolean | null = null;
  private dirty = new Set<Element>();
  private reloading = false;
  private retryTimer: number | undefined;
  constructor(
    private browser: Window,
    private device: Navigator,
    private registerWorker = false,
  ) {
    const ua = device.userAgent,
      ios =
        /iPhone|iPad|iPod/i.test(ua) ||
        (device.platform === "MacIntel" && device.maxTouchPoints > 1);
    this.controlled = Boolean(device.serviceWorker?.controller);
    const dismissed = false;
    const version = browser.document.querySelector<HTMLMetaElement>('meta[name="pereirao-build"]')?.content;
    this.state = {
      runningVersion: version && /^[a-f0-9]{20}$/.test(version) ? version : null,
      publishedVersion: null,
      sessionRefreshRequired: false,
      installed: this.standalone(),
      ios,
      safari: ios && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua),
      canInstall: false,
      installing: false,
      dismissed,
      online: device.onLine,
      refreshRequired: false,
      updateReady: false,
      updating: false,
      installError: false,
      updateError: false,
      worker: "unavailable",
    };
  }
  private standalone() {
    return Boolean(
      this.browser.matchMedia?.("(display-mode: standalone)").matches ||
      (this.device as Navigator & { standalone?: boolean }).standalone,
    );
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private patch(value: Partial<PwaState>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...value };
    for (const listener of this.listeners) listener();
  }
  private listen(target: EventTarget, name: string, listener: EventListener) {
    target.addEventListener(name, listener);
    this.cleanups.push(() => target.removeEventListener(name, listener));
  }
  start() {
    if (this.started) return;
    this.started = true;
    if (this.registerWorker) {
      const poll = () => {
        if (this.disposed) return;
        if (this.browser.document.visibilityState === 'visible') void this.checkForUpdate();
        this.retryTimer = this.browser.setTimeout(poll, 60000);
      };
      this.retryTimer = this.browser.setTimeout(poll, 60000);
    }
    this.listen(this.browser, "beforeinstallprompt", (event) => {
      const candidate = event as InstallPromptEvent;
      if (typeof candidate.prompt !== "function" || !candidate.userChoice)
        return;
      event.preventDefault();
      this.prompt = candidate;
      this.patch({ canInstall: !this.state.installed, installError: false });
    });
    this.listen(this.browser, "appinstalled", () => {
      this.prompt = null;
      this.patch({ installed: true, canInstall: false, installing: false });
    });
    const mode = this.browser.matchMedia?.("(display-mode: standalone)");
    if (mode)
      this.listen(mode, "change", () => {
        const installed = this.standalone();
        this.patch({
          installed,
          canInstall: installed ? false : Boolean(this.prompt),
        });
      });
    this.listen(this.browser, "offline", () =>
      this.patch({ online: false, refreshRequired: true, sessionRefreshRequired: true }),
    );
    this.listen(this.browser, "online", () => {
      this.patch({ online: true });
      void this.checkForUpdate();
    });
    this.listen(this.browser, "focus", () => {
      void this.checkForUpdate(true);
    });
    this.listen(this.browser.document, "visibilitychange", () => {
      if (this.browser.document.visibilityState === "visible")
        void this.checkForUpdate(true);
    });
    this.listen(this.browser, "pageshow", event => { this.restoredFromHistory = Boolean((event as PageTransitionEvent).persisted); void this.checkForUpdate(true); });
    const markDirty = (event: Event) => {
      const target = event.target as Element | null;
      if (target?.closest) this.dirty.add(target.closest('form') ?? target);
    };
    this.listen(this.browser.document, 'input', markDirty);
    this.listen(this.browser.document, 'change', markDirty);
    if (
      !this.registerWorker ||
      !this.device.serviceWorker ||
      !this.browser.isSecureContext
    )
      return;
    this.patch({ worker: "registering" });
    this.listen(this.device.serviceWorker, 'message', event => {
      const message = event as MessageEvent;
      if (message.data?.type === 'PEREIRAO_CAN_ACCEPT_CONTROLLER' && message.ports[0]) {
        // O controlador atual preserva formulários quando outra aba troca o worker.
        message.ports[0].postMessage({ protocol: 1 });
      }
      if (message.data?.type === 'PEREIRAO_UPDATE_DEFERRED'
        && (message.source === this.registration?.waiting || message.source === this.device.serviceWorker.controller)) {
        if (this.updateTimer) this.browser.clearTimeout(this.updateTimer);
        this.activationVersion = null;
        this.patch({ updating: false, updateDeferred: true, updateReady: true });
      }
    });
    this.listen(this.device.serviceWorker, "controllerchange", () => {
      this.waiting = null;
      if (!this.controlled) {
        this.controlled = true;
        this.acknowledgeVersion();
        void this.checkForUpdate(true);
        return;
      }
      if (this.state.updating) {
        if (this.updateTimer) this.browser.clearTimeout(this.updateTimer);
        const alreadyCurrent = this.activationVersion !== null && this.activationVersion === this.state.runningVersion;
        this.patch({ updating: false, refreshRequired: !alreadyCurrent || this.state.sessionRefreshRequired, updateReady: false });
        // O HTML já atual não precisa de reload só para trocar o worker legado.
        if (alreadyCurrent) { this.activationVersion = null; this.acknowledgeVersion(); return; }
        // Outra aba pode assumir o worker enquanto este formulário está aberto.
        if (!this.hasEdits() && !this.busy()) this.reload(false);
      } else {
        const verifiedCurrent = Boolean(this.state.runningVersion && this.state.publishedVersion === this.state.runningVersion);
        this.patch({ refreshRequired: !verifiedCurrent || this.state.sessionRefreshRequired, updateReady: false });
        void this.checkForUpdate(true);
      }
      this.acknowledgeVersion();
    });
    const register = () => {
      void this.register();
    };
    if (this.browser.document.readyState === "complete") register();
    else this.listen(this.browser, "load", register);
  }
  private async register() {
    if (this.registration || this.disposed) return;
    try {
      const registration = await this.device.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
      if (this.disposed) return;
      this.registration = registration;
      this.patch({ worker: "ready" });
      this.inspectWaiting();
      const inspect = () => {
        const worker = registration.installing;
        if (!worker) return;
        this.listen(worker, "statechange", () => {
          if (
            worker.state === "installed" &&
            this.device.serviceWorker.controller
          ) {
            this.waiting = registration.waiting ?? worker;
            void this.checkForUpdate(true);
          }
        });
      };
      this.listen(registration, "updatefound", inspect);
      inspect();
      this.acknowledgeVersion();
      void this.checkForUpdate();
    } catch {
      this.patch({ worker: "failed" });
    }
  }
  private inspectWaiting() {
    if (this.registration?.waiting) {
      this.waiting = this.registration.waiting;
    }
  }
  private acknowledgeVersion() {
    if (this.state.runningVersion) this.device.serviceWorker?.controller?.postMessage({
      type: 'PEREIRAO_CLIENT_VERSION', version: this.state.runningVersion,
    });
  }
  private busy() {
    return Boolean(this.browser.document.querySelector('[aria-busy="true"], form button[type="submit"]:disabled'));
  }
  private hasEdits() {
    for (const element of this.dirty) if (!element.isConnected) this.dirty.delete(element);
    return this.dirty.size > 0;
  }
  private safeToReload() {
    return !isSensitivePath(this.browser.location.pathname) && !this.hasEdits() && !this.busy()
      && !this.browser.document.querySelector('dialog[open], input:focus, textarea:focus, select:focus, [contenteditable="true"]:focus');
  }
  private reload(automatic: boolean) {
    if (this.reloading || !this.state.online || this.browser.document.visibilityState !== 'visible') return;
    if (automatic && !this.safeToReload()) return;
    const version = this.state.publishedVersion;
    if (automatic && !version) return;
    try {
      if (automatic && this.browser.sessionStorage.getItem('pereirao.update.attempt') === version) return;
      if (version) this.browser.sessionStorage.setItem('pereirao.update.attempt', version);
    } catch { if (automatic) return; } // Sem storage, somente atualização explícita: impede loops.
    this.reloading = true;
    this.browser.location.reload(); // Mantém rota, query e hash; nunca redireciona à Home.
  }
  private maybeUpdate() {
    const waitingCurrent = Boolean(this.registration?.waiting && this.waitingVersion === this.state.publishedVersion);
    if (this.state.sessionRefreshRequired && this.state.publishedVersion && this.state.online
      && this.browser.document.visibilityState === 'visible' && this.safeToReload()) {
      this.reload(true);
      return;
    }
    if (!this.state.runningVersion || !this.state.publishedVersion || (this.state.runningVersion === this.state.publishedVersion && !waitingCurrent)
      || !this.state.online || this.state.sessionRefreshRequired || this.state.updating || this.reloading
      || this.browser.document.visibilityState !== 'visible' || !this.safeToReload()) return;
    try {
      if (this.browser.sessionStorage.getItem('pereirao.update.attempt') === this.state.publishedVersion) return;
    } catch { return; }
    // Um waiting legado/desconhecido não deve bloquear indefinidamente a troca
    // do HTML público. A navegação busca HTML novo pela rede sem ativar esse worker.
    if (this.registration?.waiting && !waitingCurrent) { this.reload(true); return; }
    this.update(true);
  }
  async checkForUpdate(force = false): Promise<void> {
    if (!this.registerWorker || !this.state.online || this.disposed) return;
    if (this.checking) return this.checking;
    if (!force && Date.now() - this.lastCheck < 15000) return;
    this.lastCheck = Date.now();
    this.checking = (async () => {
      const versionCheck = async () => {
        if (!this.state.runningVersion) return false;
        const abort = new AbortController();
        const timeout = this.browser.setTimeout(() => abort.abort(), 8000);
        try {
          const response = await this.browser.fetch('/version.json', {
            cache: 'no-store', credentials: 'omit', redirect: 'error',
            headers: { Accept: 'application/json' }, signal: abort.signal,
          });
          if (!response.ok || !response.headers.get('Content-Type')?.includes('application/json')) return false;
          const data: unknown = await response.json();
          const version = data && typeof data === 'object' && 'version' in data ? data.version : null;
          if (typeof version !== 'string' || !/^[a-f0-9]{20}$/.test(version)) return false;
          this.lastVersionSuccess = Date.now();
          this.patch({ publishedVersion: version, refreshRequired: version !== this.state.runningVersion || this.state.sessionRefreshRequired });
          // O reload que chegou ao build certo concluiu a tentativa anterior.
          // Uma página antiga restaurada depois pelo histórico precisa poder atualizar de novo.
          if (version === this.state.runningVersion) {
            try {
              if (this.browser.sessionStorage.getItem('pereirao.update.attempt') === version)
                this.browser.sessionStorage.removeItem('pereirao.update.attempt');
            } catch { /* Storage opcional; não interfere na consulta. */ }
          }
          return true;
        } catch { /* Offline/proteção/erro HTTP nunca força reload. */ return false; }
        finally { this.browser.clearTimeout(timeout); }
      };
      const [verified] = await Promise.all([versionCheck(), this.registration?.update().catch(() => {})]);
      if (this.disposed) return;
      this.inspectWaiting();
      const waiting = this.registration?.waiting;
      this.waitingVersion = waiting && this.state.runningVersion ? await workerVersion(waiting) : null;
      // A instalação pode ter substituído o candidato enquanto ele respondia.
      if (this.registration?.waiting !== waiting || this.disposed) return;
      // Um worker em espera pode ser antigo ou coincidir com o HTML atual.
      // Só oferecemos atualização quando o build dele foi confirmado como publicado.
      this.patch({ updateReady: Boolean(verified && waiting && this.waitingVersion
        && this.waitingVersion === this.state.publishedVersion
        && this.waitingVersion !== this.state.runningVersion) });
      if (verified) this.maybeUpdate();
    })().finally(() => { this.checking = null; });
    return this.checking;
  }
  async diagnostics(): Promise<PwaDiagnostics> {
    await this.checkForUpdate(true);
    const active = this.registration?.active, waiting = this.registration?.waiting;
    const [controller, activeVersion, waitingVersion] = await Promise.all([
      workerVersion(this.device.serviceWorker?.controller), workerVersion(active), workerVersion(waiting),
    ]);
    let staticCacheVersions: string[] = [];
    try { staticCacheVersions = (await this.browser.caches.keys()).flatMap(key => /^pereirao-static-[a-f0-9]{20}$/.test(key) ? [key.slice('pereirao-static-'.length)] : []).sort(); } catch { /* Cache indisponível não impede diagnóstico. */ }
    return {
      origin: this.browser.location.origin, installed: this.standalone(), running: this.state.runningVersion,
      published: this.state.publishedVersion, publishedCheckedAt: this.lastVersionSuccess === null ? null : new Date(this.lastVersionSuccess).toISOString(), online: this.state.online, controller,
      active: active ? { state: active.state, version: activeVersion } : null,
      waiting: waiting ? { state: waiting.state, version: waitingVersion } : null,
      installing: this.registration?.installing?.state ?? null, staticCacheVersions,
      restoredFromHistory: this.restoredFromHistory,
    };
  }
  async install() {
    if (!this.prompt || this.state.installed || this.state.installing) return;
    const prompt = this.prompt;
    this.prompt = null;
    this.patch({ canInstall: false, installing: true, installError: false });
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      this.patch({ installError: true });
    } finally {
      this.patch({ installing: false });
    }
    // Aceitar o diálogo não é tratado como confirmação de instalação concluída.
  }
  offerInstallInvitation() {
    return !this.state.dismissed && !this.state.installed;
  }
  markInstallInvitationSeen() {
    return true;
  }
  installDiagnostics() {
    return { installed: this.state.installed, ios: this.state.ios, safari: this.state.safari, nativePrompt: this.state.canInstall,
      dismissedUntil: null, automaticUntil: null };
  }
  dismiss() {
    this.patch({ dismissed: true });
  }
  update(automatic = false) {
    if (!this.state.online || this.state.updating || this.reloading || this.busy()) return;
    if (automatic && !this.safeToReload()) return;
    if (!automatic && this.hasEdits() && !this.browser.confirm('Há alterações não salvas. Atualizar agora e descartá-las?')) return;
    if (!automatic) this.dirty.clear();
    const waiting = this.registration?.waiting ?? this.waiting;
    if (!waiting) {
      // Não recarrega enquanto a instalação ainda está baixando a versão nova.
      if (this.registration?.installing) return;
      this.reload(automatic);
      return;
    }
    this.patch({ updating: true, updateError: false, updateDeferred: false });
    try {
      this.updateTimer = this.browser.setTimeout(() => this.patch({ updating: false, updateError: true }), 12000);
      this.activationVersion = this.waitingVersion;
      waiting.postMessage({ type: 'PEREIRAO_ACTIVATE_UPDATE', protocol: 1 });
    } catch { this.patch({ updating: false, updateError: true }); }
  }
  dispose() {
    this.disposed = true;
    for (const cleanup of this.cleanups) cleanup();
    if (this.updateTimer) this.browser.clearTimeout(this.updateTimer);
    if (this.retryTimer) this.browser.clearTimeout(this.retryTimer);
    this.listeners.clear();
  }
}
