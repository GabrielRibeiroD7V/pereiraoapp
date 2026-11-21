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
import { createWorkFixtures } from "../test/workFixtures";
import { adminFixture } from "../test/adminFixtures";
import { safeReturnPath } from "../auth/returnPath";
import { createSubscriptionRepository } from "./repository";
import type {
  BusinessSubscription,
  SubscriptionRepository,
  AdminSubscriptions,
} from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
const item: BusinessSubscription = {
  businessId: "00000000-0000-4000-8000-000000008101",
  businessName: "Negócio local A",
  state: "trial_active",
  trialStartedAt: "2026-11-21T12:00:00Z",
  trialEndsAt: "2027-02-19T12:00:00Z",
  contractedAt: null,
  billingPeriodStart: null,
  billingPeriodEnd: null,
  serverNow: "2026-11-21T12:00:00Z",
  checkoutAvailable: false,
  enforcementEnabled: false,
};
function open(
  repository: SubscriptionRepository | null,
  path = "/conta/assinaturas",
  visitor = false,
) {
  const work = createWorkFixtures(false, visitor);
  render(
    <MemoryRouter initialEntries={[path]}>
      <App
        authGateway={work.gateway}
        professionalRepository={work.professional}
        subscriptionRepository={repository}
      />
    </MemoryRouter>,
  );
}
describe("consulta informativa de assinatura", () => {
  it("mantém situações individuais sem oferta ou pagamento", async () => {
    open({
      list: vi.fn(async () => ({
        items: [
          item,
          {
            ...item,
            businessId: "00000000-0000-4000-8000-000000008102",
            businessName: "Negócio local B",
              state: "trial_ended" as const,
          },
        ],
        hasNext: false,
      })),
    });
    expect(await screen.findByText("Gratuidade ativa")).toBeInTheDocument();
    expect(screen.getByText("Gratuidade encerrada")).toBeInTheDocument();
    expect(
      screen.getByText(/Nenhuma cobrança será iniciada/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/19,99|Pagar|Contratar agora/),
    ).not.toBeInTheDocument();
    expect(
      within(
        screen.getByRole("navigation", { name: "Navegação principal" }),
      ).getAllByRole("link"),
    ).toHaveLength(3);
  });
  it("aguarda a primeira ativação para começar os 90 dias", async () => {
    open({
      list: async () => ({
        items: [
          {
            ...item,
            state: "awaiting_activation",
            trialStartedAt: null,
            trialEndsAt: null,
          },
        ],
        hasNext: false,
      }),
    });
    expect(
      await screen.findByText(/Os 90 dias começam na primeira ativação/),
    ).toBeInTheDocument();
  });
  it("apresenta migração pendente e permite nova tentativa", async () => {
    const list = vi
      .fn()
      .mockRejectedValueOnce({ code: "PGRST202", message: "private-data" })
      .mockResolvedValue({ items: [], hasNext: false });
    open({ list });
    expect(
      await screen.findByText(
        /estrutura de gratuidade e assinatura está em preparação/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("private-data")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      await screen.findByText("Nenhum negócio disponível para esta conta."),
    ).toBeInTheDocument();
  });
  it("exige sessão e preserva o destino", async () => {
    open(null, "/conta/assinaturas", true);
    expect(
      await screen.findByRole("heading", { name: "Entrar" }),
    ).toBeInTheDocument();
    expect(safeReturnPath("/conta/assinaturas")).toBe("/conta/assinaturas");
    expect(safeReturnPath("/conta/assinaturas?token=x")).toBe("/conta");
  });
  it("pagina e trata erro de rede sem liberar cobrança", async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({ items: [item], hasNext: true })
      .mockRejectedValueOnce(Error("secret"));
    open({ list });
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Próxima — situações de assinatura",
      }),
    );
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(undefined, 2, expect.anything()),
    );
    expect(
      await screen.findByText(/Verifique sua conexão/),
    ).toBeInTheDocument();
  });
  it("admin consulta contagens reais e receita indisponível", async () => {
    const work = createWorkFixtures();
    const admin = adminFixture();
    const data: AdminSubscriptions = {
      items: [{ ...item, sameOwnerActivations: 2 }],
      hasNext: false,
      summary: {
        trialActive: 2,
        trialEnded: 0,
        active: 0,
        pendingPayment: 0,
        cancelled: 0,
        confirmedRevenueCents: null,
        revenueAvailable: false,
      },
      extensionsEnabled: false,
      checkoutAvailable: false,
      enforcementEnabled: false,
    };
    admin.repo.query = vi.fn(async () => data) as typeof admin.repo.query;
    render(
      <MemoryRouter initialEntries={["/admin?sec=subscriptions"]}>
        <App authGateway={work.gateway} adminRepository={admin.repo} />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Indisponível")).toBeInTheDocument();
    expect(screen.getByText(item.businessName)).toBeInTheDocument();
    const calls = vi.mocked(admin.repo.query).mock.calls.length;
    fireEvent.click(
      screen.getByRole("button", { name: /^Atualizar$/ }),
    );
    await waitFor(() =>
      expect(admin.repo.query).toHaveBeenCalledTimes(calls + 1),
    );
    fireEvent.change(screen.getByLabelText("Situação da assinatura"), {
      target: { value: "trial_ended" },
    });
    await waitFor(() =>
      expect(admin.repo.query).toHaveBeenLastCalledWith(
        "subscriptions",
        expect.objectContaining({ status: "trial_ended", page: 1 }),
        expect.anything(),
      ),
    );
    expect(
      screen.queryByRole("button", { name: /Estender|Pagar|Cobrar/ }),
    ).not.toBeInTheDocument();
  });
});
describe("repositório autenticado somente de leitura", () => {
  function client(
    data: unknown = { items: [item], hasNext: false },
    error: unknown = null,
  ) {
    const abortSignal = vi.fn(async () => ({ data, error }));
    const rpc = vi.fn(() => ({ abortSignal }));
    const getUser = vi.fn(async () => ({
      data: { user: { id: "owner" } },
      error: null,
    }));
    return {
      rpc,
      getUser,
      repo: createSubscriptionRepository({
        auth: { getUser },
        rpc,
      } as unknown as SupabaseClient<Database>),
    };
  }
  it("usa sessão normal e apenas RPC de leitura", async () => {
    const f = client();
    await expect(f.repo.list(item.businessId)).resolves.toMatchObject({
      items: [item],
    });
    expect(f.getUser).toHaveBeenCalledOnce();
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith("my_subscriptions", {
      target_business: item.businessId,
      page_number: 1,
    });
  });
  it("recusa UUID e paginação inválidos antes da rede", async () => {
    const f = client();
    await expect(f.repo.list("outro")).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    await expect(f.repo.list(undefined, 0)).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("não consulta sem identidade validada", async () => {
    const f = client();
    f.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    } as never);
    await expect(f.repo.list()).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
    });
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("recusa respostas que habilitem checkout inesperadamente", async () => {
    const f = client({
      items: [{ ...item, checkoutAvailable: true }],
      hasNext: false,
    });
    await expect(f.repo.list()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
  it("preserva código de migração ausente", async () => {
    const f = client(null, { code: "PGRST202" });
    await expect(f.repo.list()).rejects.toMatchObject({ code: "PGRST202" });
  });
});
