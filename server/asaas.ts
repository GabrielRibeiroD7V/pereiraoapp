import type { SandboxDiagnostic } from "../src/admin/types.ts";
export async function checkAsaasSandbox(
  key: string | undefined,
  request: typeof fetch = fetch,
): Promise<SandboxDiagnostic> {
  const checkedAt = new Date().toISOString();
  if (!key) return { state: "missing", checkedAt };
  // Não enviar uma chave de produção ou de formato desconhecido, nem mesmo ao sandbox.
  if (
    !key.startsWith("$aact_hmlg_") ||
    key.trim() !== key ||
    /[\r\n]/.test(key)
  )
    return { state: "not_validated", checkedAt };
  try {
    const response = await request(
      "https://api-sandbox.asaas.com/v3/customers?limit=1&offset=0",
      {
        method: "GET",
        headers: {
          access_token: key,
          accept: "application/json",
          "User-Agent": "PereiraoSandboxDiagnostic/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(8000),
      },
    );
    // Não ler ou retornar cadastros, saldos, mensagens do fornecedor ou cabeçalhos.
    await response.body?.cancel();
    if (
      response.status === 200 &&
      response.headers.get("content-type")?.includes("application/json")
    )
      return { state: "connected", httpStatus: 200, checkedAt };
    return {
      state:
        response.status === 401 || response.status === 403
          ? "invalid"
          : "communication_error",
      httpStatus: response.status,
      checkedAt,
    };
  } catch {
    return { state: "communication_error", checkedAt };
  }
}
