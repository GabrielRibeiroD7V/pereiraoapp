import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { SandboxBillingPage, SandboxFinancePanel } from "./BillingViews";
import { BillingProvider } from "./BillingProvider";
import { billingFixture } from "../test/billingFixtures";
import { safeReturnPath } from "../auth/returnPath";
import { createBillingRepository } from "./repository";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import type { SandboxBillingRepository } from "./types";
const bid = "00000000-0000-4000-8000-000000000001";
function open(repo: SandboxBillingRepository, admin = false) {
  render(
    <MemoryRouter initialEntries={[`/conta/profissional/${bid}/assinatura`]}>
      <BillingProvider repository={repo}>
        <Routes>
          <Route
            path="/conta/profissional/:businessId/assinatura"
            element={admin ? <SandboxFinancePanel /> : <SandboxBillingPage />}
          />
        </Routes>
      </BillingProvider>
    </MemoryRouter>,
  );
}
describe("contratação expressa de homologação", () => {
  it("oferece cartão e identifica Pix ainda não homologado", async () => {
    const f = billingFixture();
    f.repo.pixAvailable = false;
    open(f.repo);
    expect(await screen.findByRole("combobox")).toHaveValue("CREDIT_CARD");
    expect(
      screen.getByRole("option", { name: "Pix — em validação" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/contratação por Pix aguarda homologação/),
    ).toBeInTheDocument();
  });
  it("exige consentimento, envia preço fixo e bloqueia clique duplicado", async () => {
    const f = billingFixture(),
      start = vi.spyOn(f.repo, "start");
    open(f.repo);
    const button = await screen.findByRole("button", {
      name: "Iniciar simulação no Sandbox",
    });
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(button);
    fireEvent.click(button);
    await screen.findByText("Aguardando pagamento de teste");
    expect(start).toHaveBeenCalledTimes(1);
    expect(start.mock.calls[0]).toMatchObject([bid, expect.any(String), "PIX"]);
    expect(
      screen.queryByRole("textbox", { name: /cartão/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/não iniciam nem reiniciam os 90/),
    ).toBeInTheDocument();
  });
  it("ausência da migração mostra pendência específica sem checkout", async () => {
    const f = billingFixture();
    f.repo.overview = async () => {
      throw { code: "SETUP_REQUIRED" };
    };
    open(f.repo);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "aguarda a migração",
    );
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
  it("produção indisponível não consulta API nem exibe contratação", async () => {
    const f = billingFixture();
    f.repo.available = false;
    const query = vi.spyOn(f.repo, "overview");
    open(f.repo);
    await screen.findByText(/apenas no Preview autorizado/);
    expect(query).not.toHaveBeenCalled();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
  it("recorrência estornada ainda precisa ser cancelada antes de outra contratação", async () => {
    const f = billingFixture(true);
    f.data.contracts[0]!.state = "refunded";
    open(f.repo);
    await screen.findByText("Pagamento de teste estornado");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar simulação" }));
    await screen.findByRole("dialog");
    expect(f.data.contracts[0]!.state).toBe("refunded");
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar cancelamento Sandbox" }),
    );
    await waitFor(() => expect(f.data.contracts[0]!.state).toBe("cancelled"));
  });
  it("não abre URL de pagamento fora do Sandbox", async () => {
    const f = billingFixture(true);
    f.data.contracts[0]!.checkoutUrl = "https://www.asaas.com/i/real";
    open(f.repo);
    await screen.findByText("Aguardando pagamento de teste");
    expect(
      screen.queryByRole("link", { name: /Abrir pagamento/ }),
    ).not.toBeInTheDocument();
  });
  it("separa métricas Sandbox e receita real", async () => {
    const f = billingFixture(true);
    open(f.repo, true);
    await screen.findByText("Receita bruta recebida Sandbox");
    expect(screen.getByText("Receita real")).toBeInTheDocument();
    expect(screen.getByText("Indisponível")).toBeInTheDocument();
    expect(screen.getByText(/até 20 contratos/)).toBeInTheDocument();
  });
  it("preserva rota privada após login", () =>
    expect(safeReturnPath(`/conta/profissional/${bid}/assinatura`)).toBe(
      `/conta/profissional/${bid}/assinatura`,
    ));
});
describe("cliente HTTP financeiro", () => {
  const client = {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "local-session-fixture" } },
        error: null,
      }),
    },
  } as unknown as SupabaseClient<Database>;
  it("transporta somente sessão normal e opções de consentimento, sem provider key", async () => {
    const request = vi.fn<typeof fetch>(async () =>
      Response.json({ data: {} }),
    );
    await createBillingRepository(client, request, true).start(
      bid,
      crypto.randomUUID(),
      "PIX",
    );
    const init = request.mock.calls[0]?.[1];
    expect(init?.cache).toBe("no-store");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer local-session-fixture",
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      accepted: true,
      amountCents: 1999,
      termsVersion: "sandbox-v1",
    });
    expect(String(init?.body)).not.toMatch(
      /userId|owner|access_token|creditCard/,
    );
  });
  it("não faz request sem sessão", async () => {
    const request = vi.fn();
    const anon = {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
      },
    } as unknown as SupabaseClient<Database>;
    await expect(
      createBillingRepository(anon, request, true).admin(),
    ).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    expect(request).not.toHaveBeenCalled();
  });
});
