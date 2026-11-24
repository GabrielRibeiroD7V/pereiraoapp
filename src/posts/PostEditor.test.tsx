import { StrictMode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { PostEditor } from "./PostEditor";
import { PostsProvider } from "./PostsProvider";
import { postsFixtures } from "../test/postsFixtures";
vi.mock("../work/images", () => ({
  optimizeImage: vi.fn(async () => new Blob(["test"], { type: "image/webp" })),
}));
beforeEach(() =>
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = () => "blob:local";
      static revokeObjectURL = vi.fn();
    },
  ),
);
afterEach(() => vi.unstubAllGlobals());
function setup(files = 1) {
  const managed = postsFixtures().managed,
    close = vi.fn(),
    save = vi.fn(async () => {});
  render(
    <StrictMode>
      <PostsProvider managed={managed}>
        <PostEditor
          businessId="00000000-0000-4000-8000-000000000001"
          initialFiles={Array.from(
            { length: files },
            (_, i) => new File(["test"], `${i}.png`, { type: "image/png" }),
          )}
          onClose={close}
          onSave={save}
        />
      </PostsProvider>
    </StrictMode>,
  );
  return { managed, close, save };
}
it("prepara a seleção sob StrictMode e cancelar não envia nem salva", async () => {
  const { managed, close, save } = setup(),
    upload = vi.spyOn(managed, "uploadPostPhoto");
  await screen.findByAltText("Prévia da foto 1");
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(close).toHaveBeenCalledOnce();
  expect(upload).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
});
it("recusa mais de seis fotos sem criar upload", async () => {
  const { managed } = setup(7),
    upload = vi.spyOn(managed, "uploadPostPhoto");
  expect(await screen.findByRole("alert")).toHaveTextContent("no máximo seis");
  expect(upload).not.toHaveBeenCalled();
});
it("mantém legenda, IDs e prévia depois de falha para recuperar sem duplicar", async () => {
  const { managed, save } = setup(),
    upload = vi
      .spyOn(managed, "uploadPostPhoto")
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue();
  await screen.findByAltText("Prévia da foto 1");
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.change(screen.getByLabelText("Título do trabalho"), {
    target: { value: "Teste sintético" },
  });
  fireEvent.change(
    screen.getByLabelText("Legenda ou descrição da publicação"),
    { target: { value: "Legenda preservada" } },
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Confirmar fotos e salvar rascunho" }),
  );
  await screen.findByRole("alert");
  expect(save).not.toHaveBeenCalled();
  expect(
    screen.getByLabelText("Legenda ou descrição da publicação"),
  ).toHaveValue("Legenda preservada");
  fireEvent.click(
    screen.getByRole("button", { name: "Confirmar fotos e salvar rascunho" }),
  );
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(upload.mock.calls[0]?.slice(0, 3)).toEqual(
    upload.mock.calls[1]?.slice(0, 3),
  );
});
it.each([1, 2, 3, 6])(
  "permite %i fotos antes da legenda e cancelar não envia",
  async (count) => {
    const { managed, save } = setup(count),
      upload = vi.spyOn(managed, "uploadPostPhoto");
    await screen.findByAltText(`Prévia da foto ${count}`);
    expect(
      screen.getByText(`${count} de 6 fotos selecionadas`),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(
      screen
        .getByRole("region", { name: "Todas as fotos da prévia" })
        .querySelectorAll("img"),
    ).toHaveLength(count);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(upload).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  },
);
it("acrescenta fotos ainda na legenda e permite voltar para remover e ordenar", async () => {
  setup();
  await screen.findByAltText("Prévia da foto 1");
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  expect(
    screen.getByRole("button", { name: "Adicionar outras fotos" }),
  ).toBeVisible();
  fireEvent.change(screen.getByLabelText("Fotos da publicação"), {
    target: { files: [new File(["test"], "outra.png", { type: "image/png" })] },
  });
  await screen.findByText("2 de 6 fotos selecionadas");
  expect(
    screen.getByLabelText("Legenda ou descrição da publicação"),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Voltar às fotos" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Mover imagem 2 para antes" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Remover imagem 1 da seleção" }),
  );
  expect(screen.getByText("1 de 6 fotos selecionadas")).toBeInTheDocument();
});
