import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app/App";
import {
  createWorkFixtures,
  fixtureBusinessId as bid,
} from "../test/workFixtures";
import { marketplaceFixture } from "../test/marketplaceFixtures";
import { fixturePostId as pid, postsFixtures } from "../test/postsFixtures";
import { safeReturnPath } from "../auth/returnPath";
vi.mock('../work/images',()=>({optimizeImage:vi.fn(async()=>new Blob(['synthetic'],{type:'image/webp'})),MAX_UPLOAD_BYTES:5*1024*1024}));
beforeEach(()=>{vi.stubGlobal('URL',class extends URL {static createObjectURL=()=> 'blob:synthetic';static revokeObjectURL=()=>{};});});
afterEach(()=>vi.unstubAllGlobals());
async function selectNewPhotos(count=1){fireEvent.change(screen.getByLabelText('Selecionar fotos para nova publicação'),{target:{files:Array.from({length:count},(_,i)=>new File(['synthetic'],`sintetica-${i}.png`,{type:'image/png'}))}});await screen.findByAltText('Prévia da foto 1');}
const ownerPath = `/conta/profissional/${bid}/publicacoes`;
function open(
  path = ownerPath,
  options: {
    status?: string;
    empty?: boolean;
    visitor?: boolean;
    fixtures?: ReturnType<typeof postsFixtures>;
  } = {},
) {
  const posts =
      options.fixtures ??
      postsFixtures(options.status ?? "published", options.empty),
    work = createWorkFixtures(false, options.visitor);
  render(
    <MemoryRouter initialEntries={[path]}>
      <App
        authGateway={work.gateway}
        professionalRepository={work.professional}
        workRepository={work.work}
        marketplaceRepository={marketplaceFixture()}
        managedPosts={posts.managed}
        publicPosts={posts.publicPosts}
      />
    </MemoryRouter>,
  );
  return posts;
}
describe("publicações: interface com dados simulados locais", () => {
  it("preserva destino privado no login e não adiciona aba principal", async () => {
    expect(safeReturnPath(ownerPath)).toBe(ownerPath);
    open(ownerPath, { visitor: true });
    await screen.findByRole("heading", { name: "Entrar" });
    expect(
      within(
        screen.getByRole("navigation", { name: "Navegação principal" }),
      ).getAllByRole("link"),
    ).toHaveLength(4);
  });
  it('começa pela foto, ordena e salva rascunho sem publicar negócio',async()=>{
    const posts=open(ownerPath,{status:'draft',empty:true}),save=vi.spyOn(posts.managed,'save'),command=vi.spyOn(posts.managed,'command');
    fireEvent.click(await screen.findByRole('button',{name:'Nova publicação'}));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();await selectNewPhotos(2);
    expect(screen.queryByLabelText('Título do trabalho')).not.toBeInTheDocument();expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Mover imagem 2 para antes'}));fireEvent.click(screen.getByRole('button',{name:'Continuar'}));
    fireEvent.change(screen.getByLabelText('Título do trabalho'),{target:{value:'Trabalho em rascunho'}});
    fireEvent.change(screen.getByLabelText('Legenda ou descrição da publicação'),{target:{value:'Legenda sintética'}});
    expect(screen.getByRole('region',{name:'Prévia da publicação'})).toHaveTextContent('Rascunho privado');
    fireEvent.click(screen.getByRole('button',{name:'Confirmar fotos e salvar rascunho'}));
    await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());expect(save.mock.calls[0]?.[2].photos).toHaveLength(2);
    expect(await screen.findByRole('button',{name:'Publicar trabalho'})).toBeEnabled();expect(command).not.toHaveBeenCalled();
  });
  it("exige confirmação para publicar, retirar e excluir; preserva fotos", async () => {
    const posts = open(),
      command = vi.spyOn(posts.managed, "command");
    fireEvent.click(
      await screen.findByRole("button", { name: "Publicar trabalho" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(command).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Publicar trabalho" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await screen.findByRole("button", { name: "Retirar de circulação" });
    expect(command).toHaveBeenCalledWith(bid, pid, "publish");
    fireEvent.click(
      screen.getByRole("button", { name: "Retirar de circulação" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await screen.findByRole("button", { name: "Publicar trabalho" });
    fireEvent.click(
      screen.getByRole("button", { name: /Excluir.*Trabalho demonstrativo/ }),
    );
    expect(
      screen.getByText(
        "As fotografias originais do portfólio serão preservadas.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(posts.snapshot()).toHaveLength(0));
  });
  it("mantém rascunho e confirmação quando publicar falha", async () => {
    const posts = postsFixtures();
    vi.spyOn(posts.managed, "command").mockRejectedValue({ code: "23514" });
    open(ownerPath, { fixtures: posts });
    fireEvent.click(
      await screen.findByRole("button", { name: "Publicar trabalho" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Seu rascunho foi preservado",
    );
    expect(posts.snapshot()[0]?.status).toBe("draft");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  it("bloqueia envio repetido do formulário enquanto a RPC não conclui", async () => {
    const posts = open();
    let finish!: () => void;
    const save = vi.spyOn(posts.managed, "save").mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Nova publicação" }),
    );
    await selectNewPhotos();
    fireEvent.click(screen.getByRole('button',{name:'Continuar'}));
    fireEvent.change(screen.getByLabelText("Título do trabalho"), {
      target: { value: "Trabalho novo" },
    });
    const form = screen
      .getByRole("button", { name: "Confirmar fotos e salvar rascunho" })
      .closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(()=>expect(save).toHaveBeenCalledOnce());
    await act(async () => finish());
  });
  it("oculta seção pública quando migração está pendente e mostra aviso apenas no gerenciamento", async () => {
    const posts = postsFixtures();
    posts.managed.load = async () => {
      throw { code: "SETUP_REQUIRED" };
    };
    open(ownerPath, { fixtures: posts });
    await screen.findByText(
      "As publicações estão sendo preparadas. Seu portfólio continua disponível.",
    );
    expect(
      screen.queryByRole("button", { name: "Nova publicação" }),
    ).not.toBeInTheDocument();
  });
  it("carrega trabalhos gradualmente e preserva resultados ao falhar próxima página", async () => {
    const posts = postsFixtures();
    const list = vi.spyOn(posts.publicPosts, "list");
    list
      .mockImplementationOnce(async () => ({
        items: [posts.work],
        next: { id: pid, publishedAt: posts.work.publishedAt },
      }))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ items: [], next: null });
    open("/", { fixtures: posts });
    await screen.findByRole("heading", { name: "Trabalhos recentes" });
    fireEvent.click(
      await screen.findByRole("button", { name: "Carregar mais trabalhos" }),
    );
    await screen.findByRole("alert");
    expect(
      screen.getByRole("link", {
        name: "Trabalho demonstrativo local",
      }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
    expect(list).toHaveBeenCalledTimes(3);
  });
  it("abre detalhe público, fotos e perfil responsável sem login", async () => {
    open(`/trabalhos/${pid}`, { visitor: true });
    await screen.findByRole("heading", {
      name: "Trabalho demonstrativo local",
    });
    expect(
      screen.getByRole("link", { name: "Ver perfil de Profissional simulado" }),
    ).toHaveAttribute("href", "/prestadores/prestador-simulado");
    fireEvent.click(
      screen.getByRole("button", { name: "Ampliar Foto sintética 1" }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent(
      screen.getByRole("dialog"),
      new Event("cancel", { cancelable: true }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("navigation")).getAllByRole("link"),
    ).toHaveLength(4);
    expect(
      screen.queryByText(/Curtidas|Seguidores|Comentários/),
    ).not.toBeInTheDocument();
  });
  it("não revela publicação indisponível", async () => {
    open("/trabalhos/00000000-0000-4000-8000-000000000999", { visitor: true });
    await screen.findByRole("heading", { name: "Trabalho indisponível" });
    expect(
      screen.queryByText("Trabalho demonstrativo local"),
    ).not.toBeInTheDocument();
  });
  it("mantém Home funcional e informa indisponibilidade sem inventar trabalhos", async () => {
    const posts = postsFixtures();
    const list = vi.spyOn(posts.publicPosts, "list").mockResolvedValue(null);
    open("/", { fixtures: posts });
    await waitFor(() => expect(list).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        screen.getByText("Trabalhos indisponíveis neste momento."),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("heading", { name: "Categorias populares" }),
    ).toBeInTheDocument();
  });
});
