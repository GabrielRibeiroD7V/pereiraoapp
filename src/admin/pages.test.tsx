import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { App } from "../app/App";
import { adminFixture } from "../test/adminFixtures";
import { createWorkFixtures } from "../test/workFixtures";
import { safeReturnPath } from "../auth/returnPath";
function open(path = "/admin", fixture = adminFixture(), visitor = false) {
  const work = createWorkFixtures(false, visitor);
  render(
    <MemoryRouter initialEntries={[path]}>
      <App
        authGateway={work.gateway}
        professionalRepository={work.professional}
        adminRepository={fixture.repo}
      />
    </MemoryRouter>,
  );
  return fixture;
}
describe("administração protegida", () => {
  it("exige login e preserva retorno para /admin", async () => {
    open("/admin", adminFixture(), true);
    expect(
      await screen.findByRole("heading", { name: "Entrar" }),
    ).toBeInTheDocument();
    expect(safeReturnPath("/admin")).toBe("/admin");
    expect(safeReturnPath("/admin-malicioso")).toBe("/conta");
  });
  it("nega usuário comum antes de consultar dados", async () => {
    const f = adminFixture({ allowed: false });
    const query = vi.spyOn(f.repo, "query");
    open("/admin", f);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Acesso restrito",
    );
    expect(query).not.toHaveBeenCalled();
  });
  it("apresenta ativação pendente sem autenticar por e-mail fixo", async () => {
    const f = adminFixture();
    f.repo.access = async () => {
      throw { code: "SETUP_REQUIRED" };
    };
    open("/admin", f);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "aguarda ativação",
    );
    expect(screen.queryByText("Usuários cadastrados")).not.toBeInTheDocument();
  });
  it("mostra métricas reais do adaptador e identifica métricas indisponíveis", async () => {
    open("/admin", adminFixture({ pendingPosts: true }));
    expect(await screen.findByText("Usuários cadastrados")).toBeInTheDocument();
    expect(
      screen.getByText(/Ainda não existem eventos confiáveis/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Publicações aguardam a ativação/),
    ).toBeInTheDocument();
    expect(screen.queryByText("99%")).not.toBeInTheDocument();
  });
  it("renderiza a seção de gratuidade com resumo e tabela sem iniciar períodos", async () => {
    const f = open('/admin?sec=subscriptions');
    expect(await screen.findByText('Gratuidade ativa', { selector: '.admin-metrics span' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Gratuidade por negócio' })).toBeVisible();
    expect(screen.getByRole('cell', { name: 'Aguardando ativação' })).toBeVisible();
    expect(f.business.status).toBe('draft');
    expect(f.history).toHaveLength(0);
  });
  it("filtra e pagina sem carregar todos os usuários", async () => {
    const f = adminFixture();
    const query = vi.spyOn(f.repo, "query");
    open("/admin?sec=users", f);
    expect(await screen.findByText("Usuário sintético")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Pesquisar"), {
      target: { value: "sintético" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Pesquisar" }));
    await waitFor(() =>
      expect(query).toHaveBeenCalledWith(
        "users",
        expect.objectContaining({ q: "sintético", page: 1 }),
        expect.anything(),
      ),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Próxima — administração" }),
    );
    expect(
      await screen.findByText("Nenhum registro encontrado."),
    ).toBeInTheDocument();
    expect(query).toHaveBeenLastCalledWith(
      "users",
      expect.objectContaining({ page: 2 }),
      expect.anything(),
    );
  });
  it("exige confirmação e motivo antes de suspender uma conta", async () => {
    const f = adminFixture();
    const act = vi.spyOn(f.repo, "act");
    open("/admin?sec=users", f);
    fireEvent.click(await screen.findByRole("button", { name: "Suspender" }));
    expect(act).not.toHaveBeenCalled();
    const modal = screen.getByRole("dialog");
    fireEvent.change(within(modal).getByLabelText("Motivo da decisão"), {
      target: { value: "Análise técnica local" },
    });
    fireEvent.click(
      within(modal).getByRole("button", { name: "Confirmar decisão" }),
    );
    await waitFor(() => expect(act).toHaveBeenCalledTimes(1));
    expect(act).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "user",
        target: f.user.id,
        reason: "Análise técnica local",
        expected_state: "active",
      }),
    );
    expect(
      await screen.findByRole("button", { name: "Reativar" }),
    ).toBeInTheDocument();
  });
  it("aprova somente por ação explícita e evita cliques repetidos", async () => {
    const f = adminFixture();
    let done!: () => void;
    const act = vi.fn(
      () =>
        new Promise<void>((r) => {
          done = r;
        }),
    );
    f.repo.act = act;
    open("/admin?sec=businesses", f);
    fireEvent.click(
      await screen.findByRole("button", { name: /Analisar perfil/ }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Suspender" }),
    );
    const modal = screen.getAllByRole("dialog").at(-1)!;
    fireEvent.change(within(modal).getByLabelText("Motivo da decisão"), {
      target: { value: "Perfil técnico revisado" },
    });
    const confirm = within(modal).getByRole("button", {
      name: "Confirmar decisão",
    });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(act).toHaveBeenCalledTimes(1);
    done();
    await waitFor(() =>
      expect(screen.queryByText("Registrando…")).not.toBeInTheDocument(),
    );
  });
  it("preserva motivo e informa conflito sem aprovar indevidamente", async () => {
    const f = adminFixture();
    f.repo.act = async () => {
      throw { code: "CONFLICT" };
    };
    open("/admin?sec=users", f);
    fireEvent.click(await screen.findByRole("button", { name: "Suspender" }));
    fireEvent.change(screen.getByLabelText("Motivo da decisão"), {
      target: { value: "Revisão local registrada" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar decisão" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Os dados mudaram",
    );
    expect(screen.getByLabelText("Motivo da decisão")).toHaveValue(
      "Revisão local registrada",
    );
  });
  it("consulta serviço, foto e histórico sem expor dados legais", async () => {
    const f = adminFixture();
    const image = vi.spyOn(f.repo, "image");
    open("/admin?sec=businesses", f);
    fireEvent.click(
      await screen.findByRole("button", { name: /Analisar perfil/ }),
    );
    expect(
      await screen.findByText("Serviço demonstrativo"),
    ).toBeInTheDocument();
    const enlarge = await screen.findByRole("button", {
      name: "Ampliar Imagem sintética local",
    });
    await waitFor(() => expect(enlarge).not.toBeDisabled());
    fireEvent.click(enlarge);
    expect(
      await screen.findByRole("heading", { name: "Fotografia para análise" }),
    ).toBeInTheDocument();
    expect(image).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/CNPJ/)).not.toBeInTheDocument();
  });
  it("diagnostica Asaas somente após solicitar leitura", async () => {
    const f = adminFixture();
    const sandbox = vi.spyOn(f.repo, "sandbox");
    open("/admin", f);
    const check = await screen.findByRole("button", {
      name: "Validar conexão",
    });
    expect(sandbox).not.toHaveBeenCalled();
    fireEvent.click(check);
    expect(
      await screen.findByText("Sandbox conectado e validado"),
    ).toBeInTheDocument();
    expect(sandbox).toHaveBeenCalledTimes(1);
  });
  it("trata falha de rede e permite tentar novamente", async () => {
    const f = adminFixture();
    const query = f.repo.query;
    f.repo.query = vi
      .fn()
      .mockRejectedValueOnce(Error())
      .mockImplementation(query);
    open("/admin?sec=users", f);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível",
    );
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Usuário sintético")).toBeInTheDocument();
  });
  it("apresenta publicações pendentes sem quebrar outras seções", async () => {
    open("/admin?sec=posts", adminFixture({ pendingPosts: true }));
    expect(await screen.findByText(/Publicações aguardam/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Prestadores" }));
    expect(
      await screen.findByRole("button", { name: /Analisar perfil/ }),
    ).toBeInTheDocument();
  });
});

it('não permite aprovar na interface sem ler especialidades e atendimento',async()=>{
  const f=adminFixture();f.detail.reviewCatalog=null;
  const action=vi.spyOn(f.repo,'act');
  open('/admin?sec=businesses',f);
  fireEvent.click(await screen.findByRole('button',{name:/Analisar perfil/}));
  expect(screen.queryByRole('button',{name:'Aprovar publicação'})).not.toBeInTheDocument();
  expect(await screen.findByRole('button',{name:'Suspender'})).toBeEnabled();
  expect(screen.getByText(/A revisão completa de especialidades/)).toBeVisible();
  expect(action).not.toHaveBeenCalled();
});
