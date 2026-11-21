// @vitest-environment node
import { it, expect, vi } from "vitest";
import { sandboxReadOnlyPreflight } from "../scripts/preflight-asaas-readonly.mjs";
it("consulta apenas os dois GETs oficiais sem divulgar cadastro ou chaves", async () => {
  const request = vi.fn(async (url) =>
    Response.json(
      url.includes("/myAccount/")
        ? {
            commercialInfo: "APPROVED",
            bankAccountInfo: "APPROVED",
            documentation: "APPROVED",
            general: "APPROVED",
            name: "PRIVATE-NAME",
            cpfCnpj: "PRIVATE-DOCUMENT",
          }
        : {
            hasMore: false,
            data: [
              {
                status: "AWAITING_ACTIVATION",
                key: "PRIVATE-PIX-KEY",
                qrCode: { payload: "PRIVATE-QR" },
              },
            ],
          },
    ),
  );
  const result = await sandboxReadOnlyPreflight("$aact_hmlg_fixture", request);
  expect(request.mock.calls).toHaveLength(2);
  for (const [url, init] of request.mock.calls) {
    expect(url).toMatch(
      /^https:\/\/api-sandbox\.asaas\.com\/v3\/(myAccount\/status\/|pix\/addressKeys\?limit=100&offset=0)$/,
    );
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
    expect(init.redirect).toBe("error");
  }
  expect(result.account.general).toBe("APPROVED");
  expect(result.pixKeys).toEqual({ AWAITING_ACTIVATION: 1 });
  expect(result.causality).toBe("NOT_ESTABLISHED");
  expect(result.pixMayBeTested).toBe(false);
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|aact/);
});
it.each(["$aact_prod_fixture", " $aact_hmlg_fixture", undefined])(
  "não envia chave inadequada",
  async (key) => {
    const request = vi.fn();
    expect((await sandboxReadOnlyPreflight(key, request)).keyAccepted).toBe(
      false,
    );
    expect(request).not.toHaveBeenCalled();
  },
);
it("não interpreta 403 como habilitação nem imprime corpo privado", async () => {
  const result = await sandboxReadOnlyPreflight(
    "$aact_hmlg_fixture",
    async () => new Response("PRIVATE", { status: 403 }),
  );
  expect(result.accountHttp).toBe(403);
  expect(result.pixHttp).toBe(403);
  expect(result.account).toBeNull();
  expect(result.pixMayBeTested).toBe(false);
  expect(JSON.stringify(result)).not.toContain("PRIVATE");
});

it.each([false, true])(
  "o ensaio Pix bloqueado não cria cliente nem assinatura (autorização=%s)",
  async (authorized) => {
    const { spawnSync } = await import("node:child_process");
    const source = `const seen=[];globalThis.fetch=async(url,init)=>{seen.push(init.method);return Response.json(url.includes('/myAccount/')?{commercialInfo:'APPROVED',bankAccountInfo:'APPROVED',documentation:'APPROVED',general:'APPROVED'}:{data:[{status:'AWAITING_ACTIVATION'}],hasMore:false});};process.argv[2]='pr17-fake-pix';await import('./scripts/smoke-asaas-sandbox.mjs');console.log('REQUEST_METHODS '+JSON.stringify(seen));`;
    const result = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "--input-type=module", "-e", source],
      {
        cwd: process.cwd(),
        env: {
          VERCEL_ENV: "preview",
          VERCEL_GIT_COMMIT_REF: "feat/asaas-sandbox",
          ASSAS_API_KEY_SANDBOX: "$aact_hmlg_fixture",
          ...(authorized ? { ASAAS_SANDBOX_PIX_TEST_AUTHORIZED: "true" } : {}),
        },
        encoding: "utf8",
      },
    );
    expect(result.status, result.stderr).toBe(1);
    expect(result.stdout).toContain(
      authorized
        ? "PIX_CONFIGURATION_NOT_READY"
        : "PIX_TEST_AUTHORIZATION_REQUIRED",
    );
    expect(result.stdout).toContain(
      "REQUEST_METHODS " + JSON.stringify(authorized ? ["GET", "GET"] : []),
    );
    expect(result.stdout).not.toContain("POST");
  },
);
