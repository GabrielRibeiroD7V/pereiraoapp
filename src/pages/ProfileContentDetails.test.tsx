import {beforeEach} from 'vitest';
import {profileViews} from '../posts/postReturn';
beforeEach(()=>profileViews.clear());
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { App } from "../app/App";
import {
  createWorkFixtures,
  fixtureBusinessId as bid,
} from "../test/workFixtures";
import { postsFixtures } from "../test/postsFixtures";
async function showPhotos(){fireEvent.click(await screen.findByRole("tab",{name:"Fotos de trabalhos"}));}
function open(f = createWorkFixtures(), readOnly = false) {
  const posts = postsFixtures("draft");
  render(
    <MemoryRouter
      initialEntries={[
        `/conta/profissional/${bid}/${readOnly ? "previa" : "perfil"}`,
      ]}
    >
      <App
        authGateway={f.gateway}
        professionalRepository={f.professional}
        workRepository={f.work}
        managedPosts={posts.managed}
      />
    </MemoryRouter>,
  );
  return { f, posts };
}
it("abre imagem, legenda e serviço; edição cancela sem gravar", async () => {
  const { f } = open(),
    save = vi.spyOn(f.work, "savePhotoDetails");
  await showPhotos();
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Ampliar fotografia Instalação residencial",
    }),
  );
  const dialog = await screen.findByRole("dialog", {
    name: "Foto de trabalho",
  });
  expect(dialog).toHaveTextContent("Instalação residencial");
  expect(dialog).toHaveTextContent("Instalação de ar-condicionado");
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Editar legenda e serviço" }),
  );
  await screen.findByRole("dialog", { name: "Editar fotografia" });
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(save).not.toHaveBeenCalled();
});
it("mostra ausência real de legenda e associação na prévia privada, sem edição", async () => {
  const f = createWorkFixtures(),
    photo = f.snapshot().photos[0]!;
  await f.work.savePhotoDetails(bid, photo.id, "", null);
  open(f, true);
  await showPhotos();
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Ampliar fotografia do trabalho",
    }),
  );
  const dialog = await screen.findByRole("dialog", {
    name: "Foto de trabalho",
  });
  expect(dialog).toHaveTextContent("Esta foto não tem legenda.");
  expect(dialog).toHaveTextContent("Nenhum serviço associado.");
  expect(
    within(dialog).queryByRole("button", { name: "Editar legenda e serviço" }),
  ).not.toBeInTheDocument();
});
it("capa de rascunho abre autor, título, legenda e todas as imagens em ordem", async () => {
  open();
  fireEvent.click(
    await screen.findByRole("link", {
      name: "Abrir publicação Trabalho demonstrativo local",
    }),
  );
  const dialog = await screen.findByRole("article", {name: "Trabalho demonstrativo local"});
  expect(dialog).toHaveTextContent("Rascunho — só você vê");
  expect(dialog).toHaveTextContent(
    "Descrição simulada de um trabalho concluído",
  );
  expect(dialog).toHaveTextContent("Foto 1 de 2");
  expect(dialog).toHaveTextContent("Foto 2 de 2");
});
it("retorno à aba revalida e revela foto salva em outro dispositivo sem apagar dados", async () => {
  const { f } = open();
  await showPhotos();
  await screen.findByRole("button", {
    name: "Ampliar fotografia Instalação residencial",
  });
  const list = vi.spyOn(f.work, "list");
  await f.work.uploadPhoto(
    bid,
    "00000000-0000-4000-8000-000000000999",
    new Blob(["local"]),
    "Salva fora desta aba",
    null,
  );
  expect(
    screen.queryByRole("button", {
      name: "Ampliar fotografia Salva fora desta aba",
    }),
  ).not.toBeInTheDocument();
  act(() => {
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("pageshow"));
  });
  await screen.findByRole("button", {
    name: "Ampliar fotografia Salva fora desta aba",
  });
  expect(list).toHaveBeenCalledOnce();
  await waitFor(() =>
    expect(screen.queryByText("Carregando prévia…")).not.toBeInTheDocument(),
  );
});
it("reutiliza foto do portfólio em novo rascunho por ação expressa sem reenviar arquivo", async () => {
  const { f, posts } = open(),
    upload = vi.spyOn(posts.managed, "uploadPostPhoto"),
    save = vi.spyOn(posts.managed, "save");
  await showPhotos();
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Ampliar fotografia Instalação residencial",
    }),
  );
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Usar esta foto em uma publicação",
    }),
  );
  await screen.findByRole("dialog", { name: "Nova publicação" });
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.change(screen.getByLabelText("Título do trabalho"), {
    target: { value: "Publicação sintética" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Confirmar fotos e salvar rascunho" }),
  );
  await waitFor(() => expect(save).toHaveBeenCalled());
  expect(upload).not.toHaveBeenCalled();
  expect(f.snapshot().photos).toHaveLength(2);
  expect(save.mock.calls[0]?.[2].photos[0]?.kind).toBe("portfolio");
});
