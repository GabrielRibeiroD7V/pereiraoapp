// Ambiente local de navegador simulado. Não altera navigator real nem contém sessão de usuário.
import { vi } from "vitest";
import { PwaController } from "../pwa/controller";
export function pwaFixture(
  options: {
    ios?: boolean;
    safari?: boolean;
    installed?: boolean;
    waiting?: boolean;
    online?: boolean;
    enabled?: boolean;
    version?: string;
    published?: string;
  } = {},
) {
  const mode = Object.assign(new EventTarget(), {
    matches: Boolean(options.installed),
  });
  const waiting = Object.assign(new EventTarget(), {
    state: "installed",
    postMessage: vi.fn(),
  });
  const registration = Object.assign(new EventTarget(), {
    waiting: options.waiting ? waiting : null,
    installing: null as ServiceWorker | null,
    update: vi.fn(async () => {}),
  });
  const serviceWorker = Object.assign(new EventTarget(), {
    controller: options.waiting ? waiting : null,
    register: vi.fn(
      async () => registration as unknown as ServiceWorkerRegistration,
    ),
  });
  const storage = new Map<string, string>();
  const document = Object.assign(new EventTarget(), {
    readyState: "complete",
    visibilityState: "visible",
    querySelector: (selector: string) => selector.includes("pereirao-build") && options.version ? { content: options.version } : null,
  });
  const browser = Object.assign(new EventTarget(), {
    document,
    isSecureContext: true,
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
    matchMedia: () => mode,
    location: { reload: vi.fn(), pathname: "/" },
    fetch: vi.fn(async () => ({ ok: true, headers: new Headers({"Content-Type":"application/json"}), json: async () => ({version: options.published ?? options.version}) })),
    confirm: vi.fn(() => true),
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  });
  const device = {
    userAgent: options.ios
      ? options.safari === false
        ? "iPhone CriOS"
        : "iPhone Safari"
      : "Chrome Android",
    platform: options.ios ? "iPhone" : "Linux",
    maxTouchPoints: options.ios ? 5 : 0,
    onLine: options.online ?? true,
    serviceWorker,
  };
  const controller = new PwaController(
    browser as unknown as Window,
    device as unknown as Navigator,
    options.enabled ?? false,
  );
  controller.start();
  return {
    controller,
    browser,
    device,
    serviceWorker,
    registration,
    waiting,
    mode,
    storage,
  };
}
export function installEvent(
  prompt = vi.fn(async () => {}),
  outcome: "accepted" | "dismissed" = "accepted",
) {
  return Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt,
    userChoice: Promise.resolve({ outcome, platform: "web" }),
  });
}
