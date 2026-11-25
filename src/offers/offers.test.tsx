import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { OfferEditor } from "./OfferEditor";
import { UnifiedSearch } from "./UnifiedSearch";
import { OffersProvider } from "./OffersProvider";
import type { Offer, OfferCatalog, OffersRepository } from "./model";
const catalog: OfferCatalog = {
  areas: [
    { id: "limpeza", name: "Limpeza e conservação" },
    { id: "pintura", name: "Pintura" },
  ],
  activities: [
    { id: "telhados", name: "Limpeza de telhados", kind: "service" },
    { id: "tintas", name: "Tintas", kind: "product" },
  ],
  links: [
    { area_id: "limpeza", activity_id: "telhados" },
    { area_id: "pintura", activity_id: "tintas" },
  ],
};
const offer: Offer = {
  id: "local",
  source: "offer",
  business_id: "business",
  kind: "service",
  name: "Limpeza de telhados",
  description: "Descrição local",
  area_id: "limpeza",
  activity_ids: ["telhados"],
  pricing_type: "quote",
  price_amount_cents: null,
  active: false,
  featured: false,
  image_id: null,
  image_path: null,
  created_at: "2026-11-25T00:00:00Z",
  updated_at: "2026-11-25T00:00:00Z",
  author: "Responsável local",
  slug: "responsavel-local",
};
export function fixtureOffers(): OffersRepository {
  return {
    catalog: vi.fn(async () => catalog),
    list: vi.fn(async () => [offer]),
    get: vi.fn(async () => offer),
    save: vi.fn(async () => offer),
    remove: vi.fn(async () => {}),
    search: vi.fn(async () => [
      {
        id: "local",
        kind: "service" as const,
        title: "Limpeza de telhados",
        description: "Descrição local",
        author: "Responsável local",
        url: "/ofertas/offer/local",
        business_id: "business",
        pricing_type: "quote" as const,
        price_amount_cents: null,
        score: 100,
      },
    ]),
    image: vi.fn(async () => "/test.webp"),
    upload: vi.fn(async () => {}),
    postOffer: vi.fn(async () => null),
    linkPost: vi.fn(async () => {}),
  };
}
function openEditor(
  repo = fixtureOffers(),
  kind: "service" | "product" = "service",
) {
  const onClose = vi.fn();
  render(
    <OfferEditor
      kind={kind}
      catalog={catalog}
      business="business"
      repository={repo}
      onSaved={vi.fn()}
      onClose={onClose}
    />,
  );
  return { repo, onClose };
}
describe("ofertas reais, sem inferir tipo pela categoria", () => {
  it("nome específico livre e sob orçamento sem campo de valor", async () => {
    const { repo } = openEditor();
    fireEvent.change(screen.getByLabelText("Nome da oferta"), {
      target: { value: "Limpeza de telhados especiais" },
    });
    fireEvent.change(screen.getByLabelText("Área"), {
      target: { value: "limpeza" },
    });
    expect(screen.queryByLabelText("Preço (R$)")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Salvar oferta"));
    await waitFor(() =>
      expect(repo.save).toHaveBeenCalledWith(
        "business",
        expect.any(String),
        expect.objectContaining({
          name: "Limpeza de telhados especiais",
          pricingType: "quote",
          price: "",
          active: false,
        }),
      ),
    );
    expect(repo.upload).not.toHaveBeenCalled();
  });
  it("cancelar sem confirmar não escreve nem envia", () => {
    const { repo, onClose } = openEditor();
    fireEvent.change(screen.getByLabelText("Nome da oferta"), {
      target: { value: "Não salvar" },
    });
    fireEvent.click(screen.getByText("Cancelar"));
    expect(onClose).toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
    expect(repo.upload).not.toHaveBeenCalled();
  });
  it("fixo sem valor ou zero é rejeitado", async () => {
    const { repo } = openEditor();
    fireEvent.change(screen.getByLabelText("Nome da oferta"), {
      target: { value: "Oferta local" },
    });
    fireEvent.change(screen.getByLabelText("Área"), {
      target: { value: "limpeza" },
    });
    fireEvent.change(screen.getByLabelText("Tipo de preço"), {
      target: { value: "fixed" },
    });
    fireEvent.change(screen.getByLabelText("Preço (R$)"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByText("Salvar oferta"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "maior que zero",
    );
    expect(repo.save).not.toHaveBeenCalled();
  });
  it("produto não recebe sugestão de serviço nem carrinho", () => {
    openEditor(undefined, "product");
    fireEvent.change(screen.getByLabelText("Área"), {
      target: { value: "pintura" },
    });
    expect(screen.getByText("Tintas")).toBeInTheDocument();
    expect(screen.queryByText("Limpeza de telhados")).not.toBeInTheDocument();
    expect(screen.getByText(/Sem carrinho/)).toBeVisible();
  });
  it("busca Tudo distingue tipo e preserva cidade ao trocar filtro", async () => {
    const repo = fixtureOffers();
    render(
      <MemoryRouter initialEntries={["/buscar?q=telhados&cidade=guaira-pr"]}>
        <OffersProvider repository={repo}>
          <UnifiedSearch />
        </OffersProvider>
      </MemoryRouter>,
    );
    await screen.findByRole("link", { name: "Limpeza de telhados" });
    expect(repo.search).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "telhados",
        city: "guaira-pr",
        kind: "",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Produtos" }));
    await waitFor(() =>
      expect(repo.search).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "product", city: "guaira-pr" }),
      ),
    );
  });
});
