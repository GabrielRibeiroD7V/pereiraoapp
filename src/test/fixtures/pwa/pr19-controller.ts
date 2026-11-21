// Fixture histórica: d58980d9460b7febafb0d4759109c82a0cee5a88:src/pwa/controller.ts; somente caminho do import adaptado.
import { installDismissed, INSTALL_DISMISS_KEY } from '../../../pwa/installPolicy';
export interface InstallPromptEvent extends Event {
  prompt(): Promise<unknown>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}
export interface PwaState {
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
  worker: "unavailable" | "registering" | "ready" | "failed";
}
export function isSensitivePath(path: string) {
  return (
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path === "/conta" ||
    path.startsWith("/conta/") ||
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
    let dismissed = false;
    try {
      dismissed =
        browser.sessionStorage.getItem("pereirao.install.dismissed") === "1" ||
        installDismissed(browser.localStorage);
    } catch {
      /* preferência opcional */
    }
    this.state = {
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
      this.patch({ online: false, refreshRequired: true }),
    );
    this.listen(this.browser, "online", () => {
      this.patch({ online: true });
      void this.checkForUpdate();
    });
    this.listen(this.browser, "focus", () => {
      void this.checkForUpdate();
    });
    this.listen(this.browser.document, "visibilitychange", () => {
      if (this.browser.document.visibilityState === "visible")
        void this.checkForUpdate();
    });
    if (
      !this.registerWorker ||
      !this.device.serviceWorker ||
      !this.browser.isSecureContext
    )
      return;
    this.patch({ worker: "registering" });
    this.listen(this.device.serviceWorker, "controllerchange", () => {
      if (!this.controlled) {
        this.controlled = true;
        return;
      }
      if (this.state.updating) {
        if (this.updateTimer) this.browser.clearTimeout(this.updateTimer);
        this.browser.location.reload();
      } else this.patch({ refreshRequired: true, updateReady: false });
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
            this.patch({ updateReady: true });
          }
        });
      };
      this.listen(registration, "updatefound", inspect);
      inspect();
    } catch {
      this.patch({ worker: "failed" });
    }
  }
  private inspectWaiting() {
    if (this.registration?.waiting) {
      this.waiting = this.registration.waiting;
      this.patch({ updateReady: true });
    }
  }
  async checkForUpdate() {
    if (
      !this.registration ||
      !this.state.online ||
      Date.now() - this.lastCheck < 60000
    )
      return;
    this.lastCheck = Date.now();
    try {
      await this.registration.update();
      this.inspectWaiting();
    } catch {
      /* rede instável não invalida a versão ativa */
    }
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
  dismiss() {
    try {
      this.browser.sessionStorage.setItem("pereirao.install.dismissed", "1");
    } catch {
      /* preferência opcional */
    }
    try { this.browser.localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now())); } catch { /* Preferência opcional; navegação privada pode bloquear storage. */ }
    this.patch({ dismissed: true });
  }
  update() {
    if (!this.state.online || this.state.updating) return;
    const waiting = this.registration?.waiting ?? this.waiting;
    if (!waiting) {
      this.browser.location.reload();
      return;
    }
    this.patch({ updating: true, updateError: false });
    try {
      waiting.postMessage({ type: "PEREIRAO_ACTIVATE_UPDATE" });
      this.updateTimer = this.browser.setTimeout(
        () => this.patch({ updating: false, updateError: true }),
        12000,
      );
    } catch {
      this.patch({ updating: false, updateError: true });
    }
  }
  dispose() {
    this.disposed = true;
    for (const cleanup of this.cleanups) cleanup();
    if (this.updateTimer) this.browser.clearTimeout(this.updateTimer);
    this.listeners.clear();
  }
}
