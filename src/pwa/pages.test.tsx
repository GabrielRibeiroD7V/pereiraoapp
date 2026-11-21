import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { PwaProvider, PwaGate, InstallInvitation } from "./PwaProvider";
import { pwaFixture, installEvent } from "../test/pwaFixtures";
import { App } from "../app/App";
import { createWorkFixtures } from "../test/workFixtures";
import { Modal } from "../components/Modal";
import type { AuthListener, AuthSession } from "../auth/types";
function open(path = "/", f = pwaFixture(), child = <InstallInvitation />) {
  vi.useFakeTimers();
  render(
    <MemoryRouter initialEntries={[path]}>
      <PwaProvider controller={f.controller}>
        <PwaGate>{child}</PwaGate>
      </PwaProvider>
    </MemoryRouter>,
  );
  fireEvent.pointerDown(document.body);
  act(() => { vi.advanceTimersByTime(45_000); });
  vi.useRealTimers();
  return f;
}
describe("experiência de instalação e atualização", () => {
  it("não mostra botão de instalação sem suporte", () => {
    const f = open();
    expect(
      screen.queryByRole("button", { name: "Instalar PEREIRÃO" }),
    ).not.toBeInTheDocument();
    f.controller.dispose();
  });
  it("oferece instalação nativa apenas após beforeinstallprompt e a oculta ao instalar", async () => {
    const f = pwaFixture();
    const event = installEvent();
    f.browser.dispatchEvent(event);
    open("/", f);
    fireEvent.click(screen.getByRole("button", { name: "Instalar PEREIRÃO" }));
    await waitFor(() => expect(event.prompt).toHaveBeenCalledOnce());
    expect(screen.queryByText("Instalação concluída")).not.toBeInTheDocument();
    act(() => {
      f.browser.dispatchEvent(new Event("appinstalled"));
    });
    expect(
      screen.queryByRole("region", { name: "Instalar PEREIRÃO" }),
    ).not.toBeInTheDocument();
    f.controller.dispose();
  });
  it("mostra instruções visuais no iPhone, sem botão falso de instalação", () => {
    const f = open("/", pwaFixture({ ios: true }));
    expect(
      screen.queryByRole("button", { name: "Instalar PEREIRÃO" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Como adicionar no iPhone" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Adicionar à Tela de Início" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Compartilhar")).toBeInTheDocument();
    expect(screen.getByText("Abrir como App")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Entendi" }));
    expect(
      screen.queryByRole("button", { name: "Como adicionar no iPhone" }),
    ).not.toBeInTheDocument();
    f.controller.dispose();
  });
  it("orienta abrir no Safari quando o iPhone usa outro navegador", () => {
    const f = open("/", pwaFixture({ ios: true, safari: false }));
    fireEvent.click(
      screen.getByRole("button", { name: "Como adicionar no iPhone" }),
    );
    expect(
      screen.getByText(/Abra este mesmo endereço no Safari/),
    ).toBeInTheDocument();
    f.controller.dispose();
  });
  it("oculta convite quando já está em standalone", () => {
    const f = open("/", pwaFixture({ installed: true, ios: true }));
    expect(
      screen.queryByRole("region", { name: "Instalar PEREIRÃO" }),
    ).not.toBeInTheDocument();
    f.controller.dispose();
  });
  it("permite dispensar o convite sem alterar autenticação", () => {
    const f = pwaFixture();
    f.browser.dispatchEvent(installEvent());
    open("/", f);
    fireEvent.click(screen.getByRole("button", { name: "Dispensar convite de instalação" }));
    expect(f.storage.get("pereirao.install.dismissed")).toBe("1");
    expect(
      screen.queryByRole("button", { name: "Instalar PEREIRÃO" }),
    ).not.toBeInTheDocument();
    f.controller.dispose();
  });
  it("atualização waiting permite salvar antes da recarga explícita", async () => {
    const f = pwaFixture({ enabled: true, waiting: true, version: 'aaaaaaaaaaaaaaaaaaaa', published: 'bbbbbbbbbbbbbbbbbbbb' });
    f.browser.location.pathname = '/conta';
    await vi.waitFor(() =>
      expect(f.controller.getSnapshot().updateReady).toBe(true),
    );
    open(
      "/conta",
      f,
      <label>
        Rascunho
        <input defaultValue="Dados não salvos" />
      </label>,
    );
    expect(screen.getByLabelText("Rascunho")).toBeVisible();
    expect(f.browser.location.reload).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Atualizar aplicativo" })).not.toBeInTheDocument();
    expect(f.waiting.postMessage.mock.calls.some(([message]) => message.type === 'PEREIRAO_ACTIVATE_UPDATE')).toBe(false);
    f.controller.dispose();
  });
  it("não apresenta dados administrativos antigos sem rede e exige revalidação ao voltar", () => {
    const f = open(
      "/admin",
      pwaFixture(),
      <p>Informação administrativa privada</p>,
    );
    expect(screen.getByText("Informação administrativa privada")).toBeVisible();
    act(() => {
      f.browser.dispatchEvent(new Event("offline"));
    });
    expect(
      screen.getByText("Informação administrativa privada"),
    ).not.toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "Conecte-se para acessar sua conta",
      }),
    ).toBeInTheDocument();
    act(() => {
      f.browser.dispatchEvent(new Event("online"));
    });
    expect(
      screen.getByText("Informação administrativa privada"),
    ).not.toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Valide sua sessão novamente" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Recarregar aplicativo" }),
    );
    expect(f.browser.location.reload).toHaveBeenCalledOnce();
    f.controller.dispose();
  });
  it("também fecha modais privados que estavam na camada superior", async () => {
    const f = open(
      "/admin",
      pwaFixture(),
      <Modal title="Fotografia privada" onClose={() => {}}>
        <p>Detalhe restrito</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("open");
    act(() => {
      f.browser.dispatchEvent(new Event("offline"));
    });
    await waitFor(() => expect(dialog).not.toHaveAttribute("open"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    f.controller.dispose();
  });
  it("preserva páginas públicas e links diretos quando perde conexão", () => {
    const f = open(
      "/prestadores/exemplo",
      pwaFixture(),
      <a href="/trabalhos/exemplo">Trabalho público</a>,
    );
    act(() => {
      f.browser.dispatchEvent(new Event("offline"));
    });
    expect(
      screen.getByRole("link", { name: "Trabalho público" }),
    ).toBeVisible();
    expect(screen.getByText(/Sem conexão. Reconecte-se/)).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        name: "Conecte-se para acessar sua conta",
      }),
    ).not.toBeInTheDocument();
    f.controller.dispose();
  });
  it("preserva o logout normal da conta dentro do PWA", async () => {
    const f = pwaFixture({ installed: true }),
      work = createWorkFixtures();
    let current: AuthSession | null = {
      user: {
        id: "local-user",
        email: "local@example.invalid",
        displayName: "Teste local",
      },
    };
    let listener: AuthListener = () => {};
    const gateway = {
      ...work.gateway,
      getSession: async () => current,
      subscribe: (callback: AuthListener) => {
        listener = callback;
        return () => {};
      },
      signOut: vi.fn(async () => {
        current = null;
        listener(null);
      }),
    };
    open(
      "/conta",
      f,
      <App
        authGateway={gateway}
        professionalRepository={work.professional}
        adminRepository={null}
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /Sair da conta/ }),
    );
    await waitFor(() => expect(gateway.signOut).toHaveBeenCalledOnce());
    expect(
      await screen.findByRole("link", {
        name: "Entrar",
      }),
    ).toBeInTheDocument();
    expect(f.controller.getSnapshot().installed).toBe(true);
    f.controller.dispose();
  });
});
describe('instalação sem atalhos artificiais',()=>{
 it('chama prompt nativo no mesmo toque e só confirma por appinstalled',()=>{
   const f=open();const event=installEvent();act(()=>{f.browser.dispatchEvent(event);});
   fireEvent.click(screen.getByRole('button',{name:'Instalar PEREIRÃO'}));
   expect(event.prompt).toHaveBeenCalledOnce();expect(f.controller.getSnapshot().installed).toBe(false);
   act(()=>{f.browser.dispatchEvent(new Event('appinstalled'));});
   expect(f.controller.getSnapshot().installed).toBe(true);
   expect(screen.queryByRole('region',{name:'Instalar PEREIRÃO'})).not.toBeInTheDocument();f.controller.dispose();
 });
 it('não convida novamente quando já aberto standalone no iPhone',()=>{
   const f=open('/',pwaFixture({ios:true,installed:true}));
   expect(screen.queryByRole('region',{name:'Instalar PEREIRÃO'})).not.toBeInTheDocument();f.controller.dispose();
 });
 it('dispensa o convite sem sair da página ou apagar dados',()=>{
   const f=open('/',pwaFixture({ios:true}));
   fireEvent.click(screen.getByRole('button',{name:'Dispensar convite de instalação'}));
   expect(screen.queryByRole('region',{name:'Instalar PEREIRÃO'})).not.toBeInTheDocument();
   expect(f.browser.location.reload).not.toHaveBeenCalled();f.controller.dispose();
 });
});
