import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../auth/AuthProvider";
import { createWorkFixtures } from "../test/workFixtures";
import { SocialProvider } from "./SocialProvider";
import { PersonalComposer, PersonalPublisher } from "./PersonalComposer";
import { SocialFeed,publicFeedPageCounts } from "./SocialFeed";
import {PostBackLink} from "../posts/PostBackLink";
import { PersonalPostPage, PersonalPublishingEntry } from "./PersonalPages";
import type { SocialPost, SocialRepository } from "./model";
vi.mock("../work/images", () => ({
  optimizeImage: vi.fn(
    async () => new Blob(["optimized"], { type: "image/webp" }),
  ),
}));
const post: SocialPost = {
  id: "00000000-0000-4000-8000-000000000111",
  kind: "personal",
  authorId: "local-user",
  author: "Pessoa local de teste",
  title: "Projeto local",
  description: "Legenda local",
  status: "draft",
  createdAt: "2026-11-20T10:00:00Z",
  publishedAt: null,
  images: [
    {
      id: "00000000-0000-4000-8000-000000000112",
      bucket: "personal-posts",
      path: "local/posts/photo.webp",
    },
  ],
  profileUrl: "/pessoas/local-user",
};
function fixture() {
  return {
    mine: vi.fn<SocialRepository["mine"]>(async () => ({
      items: [post],
      hasNext: false,
    })),
    get: vi.fn<SocialRepository["get"]>(async () => post),
    feed: vi.fn<SocialRepository["feed"]>(async () => ({
      items: [],
      hasNext: false,
    })),
    image: vi.fn<SocialRepository["image"]>(
      async () => "data:image/webp;base64,AA",
    ),
    save: vi.fn<SocialRepository["save"]>(async () => {}),
    command: vi.fn<SocialRepository["command"]>(async () => {}),
  } satisfies SocialRepository;
}
function open(content: React.ReactNode, repository = fixture(), path = "/") {
  const f = createWorkFixtures();
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider gateway={f.gateway}>
        <SocialProvider repository={repository}>{content}</SocialProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
  return repository;
}
beforeEach(() => {
  publicFeedPageCounts.clear();
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: vi.fn(() => "blob:local-fixture"),
      revokeObjectURL: vi.fn(),
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe("publicações pessoais sem negócio", () => {
  it("cancelar seletor não cria compositor, post ou upload", () => {
    const r = open(<PersonalPublisher onSaved={vi.fn()} />);
    fireEvent.change(
      screen.getByLabelText("Fotos para nova publicação pessoal"),
      { target: { files: [] } },
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(r.save).not.toHaveBeenCalled();
  });
  it("Conta oferece publicação sem cadastrar negócio ou serviço", () => {
    open(<PersonalPublishingEntry />);
    expect(
      screen.getByRole("button", { name: "Adicionar publicação" }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Adicionar serviço" }),
    ).not.toBeInTheDocument();
  });
  it("seleciona, ordena e publica somente ao confirmar", async () => {
    const saved = vi.fn(),
      r = open(
        <PersonalComposer
          files={[
            new File(["a"], "a.jpg", { type: "image/jpeg" }),
            new File(["b"], "b.jpg", { type: "image/jpeg" }),
          ]}
          onClose={vi.fn()}
          onSaved={saved}
        />,
      );
    await screen.findByAltText("Foto 2");
    expect(r.save).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Mover foto 2 para antes" }),
    );
    fireEvent.change(screen.getByLabelText("Legenda"), {
      target: { value: "Uma legenda de teste" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publicar" }));
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(r.save.mock.calls[0]?.[1].images).toHaveLength(2);
    expect(r.command).toHaveBeenCalledWith(
      r.save.mock.calls[0]?.[0],
      "publish",
    );
  });
  it("cancelar prévia não grava", () => {
    const close = vi.fn(),
      r = open(
        <PersonalComposer initial={post} onClose={close} onSaved={vi.fn()} />,
      );
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(close).toHaveBeenCalledOnce();
    expect(r.save).not.toHaveBeenCalled();
  });
  it("recusa mais de seis fotos antes do upload", async () => {
    const r = open(
      <PersonalComposer
        files={Array.from(
          { length: 7 },
          () => new File(["x"], "photo.jpg", { type: "image/jpeg" }),
        )}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("uma a seis");
    expect(r.save).not.toHaveBeenCalled();
  });
  it("falha preserva legenda e reaproveita IDs na nova tentativa", async () => {
    const r = fixture();
    r.save.mockRejectedValueOnce({ code: "UNAVAILABLE" });
    open(
      <PersonalComposer initial={post} onClose={vi.fn()} onSaved={vi.fn()} />,
      r,
    );
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Legenda")).toHaveValue("Legenda local");
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    await waitFor(() => expect(r.save).toHaveBeenCalledTimes(2));
    expect(r.save.mock.calls[0]?.[0]).toBe(r.save.mock.calls[1]?.[0]);
    expect(r.save.mock.calls[0]?.[1].images).toEqual(
      r.save.mock.calls[1]?.[1].images,
    );
  });
  it("ver como visitante não oferece edição nem serviços fictícios", async () => {
    const r = fixture();
    open(
      <Routes>
        <Route path="/publicacoes/:postId" element={<PersonalPostPage />} />
      </Routes>,
      r,
      `/publicacoes/${post.id}?visao=visitante`,
    );
    await screen.findByRole("heading", { name: "Projeto local" });
    expect(
      screen.queryByRole("button", { name: "Editar publicação" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Conferir serviços")).not.toBeInTheDocument();
  });
});
it("feed único pagina com cursor de data/ID/tipo e revalida no retorno", async () => {
  const r = fixture(),
    personal = {
      ...post,
      status: "published" as const,
      publishedAt: "2026-11-20T11:00:00Z",
    },
    professional = {
      ...personal,
      id: "00000000-0000-4000-8000-000000000222",
      kind: "professional" as const,
      title: "Trabalho profissional local",
      author: "Empresa local",
      profileUrl: "/prestadores/local",
      publishedAt: "2026-11-20T10:00:00Z",
    };
  r.feed
    .mockResolvedValueOnce({ items: [personal, professional], hasNext: true })
    .mockResolvedValue({ items: [], hasNext: false });
  open(<SocialFeed />, r);
  await screen.findByText("Trabalho profissional local");
  fireEvent.click(screen.getByRole("button", { name: "Mais publicações" }));
  await waitFor(() =>
    expect(r.feed).toHaveBeenCalledWith(
      {
        time: professional.publishedAt,
        id: professional.id,
        kind: "professional",
      },
      undefined,
    ),
  );
  fireEvent.focus(window);
  await waitFor(() =>
    expect(
      r.feed.mock.calls.filter(([cursor]) => cursor === null),
    ).toHaveLength(2),
  );
});

it('volta da página própria à mesma quantidade de capas carregadas no feed',async()=>{
 const r=fixture(),a={...post,status:'published' as const,publishedAt:'2026-11-24T10:00:00Z'},b={...post,id:'00000000-0000-4000-8000-000000000222',title:'Segundo projeto',status:'published' as const,publishedAt:'2026-11-23T10:00:00Z'};
 r.feed.mockImplementation(async cursor=>cursor?{items:[b],hasNext:false}:{items:[a],hasNext:true});
 open(<Routes><Route path="/" element={<SocialFeed/>}/><Route path="/publicacoes/:id" element={<PostBackLink fallback="/conta"/>}/></Routes>,r);
 fireEvent.click(await screen.findByRole('button',{name:'Mais publicações'}));
 fireEvent.click(await screen.findByRole('link',{name:'Segundo projeto'}));
 fireEvent.click(await screen.findByRole('button',{name:'Voltar'}));
 await screen.findByRole('link',{name:'Segundo projeto'});expect(r.feed).toHaveBeenCalledTimes(4);
});

it('feed mostra legenda e carrossel diretamente; o nome abre o perfil correto sem obrigar abrir post',async()=>{
 const r=fixture(),value={...post,status:'published' as const,publishedAt:'2026-11-24T10:00:00Z',profileUrl:'/pessoas/'+post.authorId,images:[...post.images,{...post.images[0]!,id:'segunda-imagem'}]};
 r.feed.mockResolvedValue({items:[value],hasNext:false});open(<SocialFeed/>,r);
 const author=await screen.findByRole('link',{name:value.author});expect(author).toHaveAttribute('href',value.profileUrl);
 expect(screen.getByText(value.description)).toBeVisible();
 const photos=screen.getByRole('region',{name:'Fotos de '+value.title});expect(within(photos).getAllByRole('figure')).toHaveLength(2);
 expect(within(photos).queryByRole('link')).not.toBeInTheDocument();expect(within(photos).getByRole('button',{name:'Próxima foto'})).toBeVisible();
 expect(screen.queryByRole('link',{name:/Abrir publicação/})).not.toBeInTheDocument();
});
