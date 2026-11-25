// Exclusivo do Preview. Credenciais Supabase são removidas no build desta entrada.
import { createRoot } from "react-dom/client";
import { MemoryRouter, Link } from "react-router-dom";
import { App } from "../../../src/app/App";
import {
  createWorkFixtures,
  fixtureBusinessId as bid,
  fixtureImage,
} from "../../../src/test/workFixtures";
import { marketplaceFixture } from "../../../src/test/marketplaceFixtures";
import type {
  Offer,
  OfferCatalog,
  OffersRepository,
} from "../../../src/offers/model";
import { priceInCents } from "../../../src/work/validation";
import "../../../src/styles/main.scss";
const f = createWorkFixtures(true),
  catalog: OfferCatalog = {
    areas: [
      { id: "limpeza", name: "Limpeza e conservação" },
      { id: "pintura", name: "Pintura" },
      { id: "seguranca-eletronica", name: "Segurança eletrônica" },
      { id: "eletrica", name: "Elétrica" },
      { id: "materiais-ferramentas", name: "Materiais e ferramentas" },
    ],
    activities: [
      { id: "limpeza-telhados", name: "Limpeza de telhados", kind: "service" },
      { id: "cameras", name: "Instalação de câmeras", kind: "service" },
      { id: "tintas", name: "Tintas", kind: "product" },
      { id: "cameras-produto", name: "Venda de câmeras", kind: "product" },
    ],
    links: [
      { area_id: "limpeza", activity_id: "limpeza-telhados" },
      { area_id: "seguranca-eletronica", activity_id: "cameras" },
      { area_id: "seguranca-eletronica", activity_id: "cameras-produto" },
      { area_id: "pintura", activity_id: "tintas" },
      { area_id: "materiais-ferramentas", activity_id: "tintas" },
    ],
  };
let rows: Offer[] = [
  ["service", "Limpeza de telhados", "limpeza", "limpeza-telhados"],
  ["service", "Instalação de câmeras", "seguranca-eletronica", "cameras"],
  ["product", "Tinta acrílica", "pintura", "tintas"],
  ["product", "Câmera de segurança", "seguranca-eletronica", "cameras-produto"],
].map(([kind, name, area, activity], i) => ({
  id: `00000000-0000-4000-8000-00000000800${i}`,
  source: "offer",
  business_id: bid,
  kind: kind as Offer["kind"],
  name: name!,
  description:
    "Exemplo sintético de oferta, apenas para avaliar esta interface.",
  area_id: area!,
  activity_ids: [activity!],
  pricing_type: i === 2 ? "fixed" : "quote",
  price_amount_cents: i === 2 ? 1999 : null,
  active: true,
  featured: kind === "product",
  image_id: null,
  image_path: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  author: "EXEMPLO LOCAL — não é prestador real",
  slug: "prestador-simulado",
}));
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/s\b/g, "");
const repo: OffersRepository = {
  catalog: async () => catalog,
  list: async () => structuredClone(rows),
  get: async (id) => structuredClone(rows.find((o) => o.id === id) ?? null),
  search: async (f) =>
    rows
      .filter(
        (o) =>
          o.active &&
          (!f.kind || f.kind === o.kind || f.kind === "provider") &&
          (!f.area || o.area_id === f.area) &&
          (!f.query || norm(o.name).includes(norm(f.query))),
      )
      .map((o) => ({
        id: o.id,
        kind: o.kind,
        title: o.name,
        description: o.description,
        author: o.author,
        url: `/ofertas/offer/${o.id}`,
        business_id: bid,
        pricing_type: o.pricing_type,
        price_amount_cents: o.price_amount_cents,
        score: 100,
      })),
  save: async (business, id, input) => {
    const old = rows.find((o) => o.id === id);
    const row: Offer = {
      id,
      source: "offer",
      business_id: business,
      kind: input.kind,
      name: input.name,
      description: input.description,
      area_id: input.areaId,
      activity_ids: input.activityIds,
      pricing_type: input.pricingType,
      price_amount_cents:
        input.pricingType === "quote" ? null : priceInCents(input.price),
      active: input.active,
      featured: input.featured,
      image_id: old?.image_id ?? null,
      image_path: old?.image_path ?? null,
      created_at: old?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
      author: "EXEMPLO LOCAL — não é prestador real",
      slug: "prestador-simulado",
    };
    rows = [...rows.filter((o) => o.id !== id), row];
    return structuredClone(row);
  },
  remove: async (_business, id) => {
    rows = rows.filter((o) => o.id !== id);
  },
  image: async () => fixtureImage,
  upload: async (_business, id) => {
    rows = rows.map((o) =>
      o.id === id ? { ...o, image_path: "somente-memoria" } : o,
    );
  },
  postOffer: async () => null,
  linkPost: async () => {},
};
const q = new URLSearchParams(window.location.search).get("q") ?? "telhados";
createRoot(document.getElementById("root")!).render(
  <MemoryRouter
    initialEntries={[`/buscar?q=${encodeURIComponent(q)}&cidade=todas`]}
  >
    <aside
      style={{
        padding: 12,
        background: "#e2faff",
        color: "#07344b",
        font: "14px/1.5 system-ui",
      }}
    >
      <strong>
        Demonstração sintética — sem Supabase, sem prestadores reais.
      </strong>
      <p>
        Seleção, salvamento e fotos são simulados em memória; recarregar
        restaura os exemplos. Não informe dados pessoais. A relevância real é
        testada no PostgreSQL local, não por esta simulação.
      </p>
      <nav>
        <Link to="/buscar?q=telhados&cidade=todas">Telhados</Link> ·{" "}
        <Link to="/buscar?q=câmera&cidade=todas">Câmera</Link> ·{" "}
        <Link to="/buscar?q=tinta&cidade=todas">Tinta</Link> ·{" "}
        <Link to={`/conta/profissional/${bid}/ofertas`}>Cadastrar oferta</Link>
      </nav>
    </aside>
    <App
      offersRepository={repo}
      authGateway={f.gateway}
      professionalRepository={f.professional}
      workRepository={f.work}
      marketplaceRepository={marketplaceFixture()}
      managedPosts={null}
      publicPosts={null}
      adminRepository={null}
      subscriptionRepository={null}
      billingRepository={null}
    />
  </MemoryRouter>,
);
