import { describe, it, expect, vi } from "vitest";
import { PwaController, isSensitivePath } from "./controller";
import { pwaFixture, installEvent } from "../test/pwaFixtures";
describe("instalação progressiva e sessão", () => {
  it("não inventa disponibilidade sem evento real do navegador", () => {
    const f = pwaFixture();
    expect(f.controller.getSnapshot().canInstall).toBe(false);
    f.controller.dispose();
  });
  it("consome o evento uma vez e não afirma instalação apenas pela aceitação", async () => {
    const f = pwaFixture();
    const event = installEvent();
    f.browser.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(f.controller.getSnapshot().canInstall).toBe(true);
    await f.controller.install();
    await f.controller.install();
    expect(event.prompt).toHaveBeenCalledOnce();
    expect(f.controller.getSnapshot().installed).toBe(false);
    f.browser.dispatchEvent(new Event("appinstalled"));
    expect(f.controller.getSnapshot().installed).toBe(true);
    f.controller.dispose();
  });
  it("não insiste após cancelar e sanitiza falha de prompt", async () => {
    const f = pwaFixture();
    f.browser.dispatchEvent(
      installEvent(
        vi.fn(async () => {
          throw Error("private");
        }),
      ),
    );
    await f.controller.install();
    expect(f.controller.getSnapshot()).toMatchObject({
      canInstall: false,
      installing: false,
      installError: true,
    });
    f.controller.dispose();
  });
  it("oculta convite standalone e detecta mudança de modo", () => {
    const f = pwaFixture({ installed: true });
    expect(f.controller.getSnapshot().installed).toBe(true);
    f.mode.matches = false;
    f.mode.dispatchEvent(new Event("change"));
    expect(f.controller.getSnapshot().installed).toBe(false);
    f.controller.dispose();
  });
  it("identifica iPhone e diferencia instruções fora do Safari", () => {
    const a = pwaFixture({ ios: true }),
      b = pwaFixture({ ios: true, safari: false });
    expect(a.controller.getSnapshot()).toMatchObject({
      ios: true,
      safari: true,
    });
    expect(b.controller.getSnapshot()).toMatchObject({
      ios: true,
      safari: false,
    });
    a.controller.dispose();
    b.controller.dispose();
  });
  it("guarda apenas preferência opcional de convite", () => {
    const f = pwaFixture();
    f.controller.dismiss();
    expect([...f.storage.entries()]).toEqual([
      ["pereirao.install.dismissed", "1"],
      ["pereirao.install.dismissedAt", expect.any(String)],
    ]);
    expect(f.controller.getSnapshot().dismissed).toBe(true);
    f.controller.dispose();
  });
  it("não registra worker em desenvolvimento", () => {
    const f = pwaFixture();
    expect(f.serviceWorker.register).not.toHaveBeenCalled();
    f.controller.dispose();
  });
  it("registra com escopo raiz e ignora cache HTTP na atualização", async () => {
    const f = pwaFixture({ enabled: true });
    await vi.waitFor(() =>
      expect(f.controller.getSnapshot().worker).toBe("ready"),
    );
    expect(f.serviceWorker.register).toHaveBeenCalledWith("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    f.controller.dispose();
  });
  it("atualização waiting não recarrega antes da ação explícita", async () => {
    const f = pwaFixture({ waiting: true, enabled: true });
    await vi.waitFor(() =>
      expect(f.controller.getSnapshot().updateReady).toBe(true),
    );
    expect(f.browser.location.reload).not.toHaveBeenCalled();
    expect(f.waiting.postMessage).not.toHaveBeenCalled();
    f.controller.update();
    expect(f.waiting.postMessage).toHaveBeenCalledWith({
      type: "PEREIRAO_ACTIVATE_UPDATE", protocol: 1,
    });
    expect(f.browser.location.reload).not.toHaveBeenCalled();
    f.serviceWorker.dispatchEvent(new Event("controllerchange"));
    expect(f.browser.location.reload).toHaveBeenCalledOnce();
    f.controller.dispose();
  });
  it("outra aba ativando versão nova exige recarga, sem recarregar formulários sozinha", async () => {
    const f = pwaFixture({ waiting: true, enabled: true });
    await vi.waitFor(() =>
      expect(f.controller.getSnapshot().worker).toBe("ready"),
    );
    f.serviceWorker.dispatchEvent(new Event("controllerchange"));
    expect(f.controller.getSnapshot().refreshRequired).toBe(true);
    expect(f.browser.location.reload).not.toHaveBeenCalled();
    f.controller.dispose();
  });
  it("primeiro controle do worker não provoca ciclo de recarga", async () => {
    const f = pwaFixture({ enabled: true });
    await vi.waitFor(() =>
      expect(f.controller.getSnapshot().worker).toBe("ready"),
    );
    f.serviceWorker.dispatchEvent(new Event("controllerchange"));
    expect(f.controller.getSnapshot().refreshRequired).toBe(false);
    expect(f.browser.location.reload).not.toHaveBeenCalled();
    f.controller.dispose();
  });
  it("conexão restabelecida exige conferir sessão antes da área privada", () => {
    const f = pwaFixture();
    f.browser.dispatchEvent(new Event("offline"));
    expect(f.controller.getSnapshot()).toMatchObject({
      online: false,
      refreshRequired: true,
    });
    f.browser.dispatchEvent(new Event("online"));
    expect(f.controller.getSnapshot()).toMatchObject({
      online: true,
      refreshRequired: true,
    });
    f.controller.dispose();
  });
  it("limita verificações de atualização e trata erro sem alterar Auth", async () => {
    const f = pwaFixture({ enabled: true });
    await vi.waitFor(() =>
      expect(f.controller.getSnapshot().worker).toBe("ready"),
    );
    f.registration.update.mockRejectedValueOnce(Error("network"));
    await f.controller.checkForUpdate();
    await f.controller.checkForUpdate();
    expect(f.registration.update).toHaveBeenCalledOnce();
    expect(f.controller.getSnapshot().worker).toBe("ready");
    f.controller.dispose();
  });
  it("falha de registro não interrompe o aplicativo", async () => {
    const f = pwaFixture();
    f.controller.dispose();
    const device = {
      ...f.device,
      serviceWorker: Object.assign(new EventTarget(), {
        controller: null,
        register: vi.fn(async () => {
          throw Error("network");
        }),
      }),
    };
    const c = new PwaController(
      f.browser as unknown as Window,
      device as unknown as Navigator,
      true,
    );
    c.start();
    await vi.waitFor(() => expect(c.getSnapshot().worker).toBe("failed"));
    c.dispose();
  });
  it.each([
    "/admin",
    "/conta",
    "/conta/profissional/cadastro",
    "/auth/retorno",
    "/entrar",
  ])("protege rota sensível %s", (path) =>
    expect(isSensitivePath(path)).toBe(true),
  );
  it.each(["/", "/buscar", "/prestadores/slug", "/trabalhos/id"])(
    "preserva rota pública %s",
    (path) => expect(isSensitivePath(path)).toBe(false),
  );
});
it.each(['/ADMIN','/CoNtA/profissional/cadastro','/ENTRAR','/AUTH/RETORNO'])('protege também a rota aceita pelo roteador com maiúsculas: %s', path=>expect(isSensitivePath(path)).toBe(true));
