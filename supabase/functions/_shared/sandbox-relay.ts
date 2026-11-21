// Receptor restrito: nenhum proxy genérico, chave Asaas ou acesso direto ao banco.
const target =
  "https://pereirao-git-feat-asaas-sandbox-77badblock-5101s-projects.vercel.app/api/asaas-webhook";
type RelayEnv = Record<string, string | undefined>;
const reply = (status: number, body: unknown) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
async function sameToken(expected: string, received: string | null) {
  if (!received || received.length > 255) return false;
  const encode = new TextEncoder();
  const digests = await Promise.all(
    [expected, received].map(
      async (value) =>
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", encode.encode(value)),
        ),
    ),
  );
  const a = digests[0]!,
    b = digests[1]!;
  let difference = 0;
  for (let i = 0; i < 32; i++) difference |= a[i]! ^ b[i]!;
  return difference === 0;
}
export function createSandboxRelay(
  env: RelayEnv,
  requestUpstream: typeof fetch = fetch,
) {
  return async (request: Request) => {
    if (
      ![
        "/asaas-sandbox-webhook",
        "/functions/v1/asaas-sandbox-webhook",
      ].includes(new URL(request.url).pathname)
    )
      return reply(404, { code: "NOT_FOUND" });
    if (request.method !== "POST")
      return reply(405, { code: "METHOD_NOT_ALLOWED" });
    const token = env.ASAAS_SANDBOX_WEBHOOK_TOKEN;
    const bypass = env.ASAAS_SANDBOX_PREVIEW_BYPASS;
    if (
      env.ASAAS_SANDBOX_WEBHOOK_RELAY_ENABLED !== "true" ||
      !token ||
      !/^[!-~]{32,255}$/.test(token) ||
      !bypass ||
      !/^[!-~]{16,255}$/.test(bypass) ||
      token === bypass
    )
      return reply(503, { code: "SETUP_REQUIRED" });
    if (!(await sameToken(token, request.headers.get("asaas-access-token"))))
      return reply(401, { code: "AUTH_REQUIRED" });
    if (Number(request.headers.get("content-length") ?? 0) > 65536)
      return reply(413, { code: "BODY_TOO_LARGE" });
    try {
      const chunks: Uint8Array[] = [];
      let size = 0;
      const reader = request.body?.getReader();
      if (!reader) return reply(400, { code: "INVALID_INPUT" });
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.length;
        if (size > 65536) {
          await reader.cancel();
          return reply(413, { code: "BODY_TOO_LARGE" });
        }
        chunks.push(part.value);
      }
      const body = new Uint8Array(size);
      let offset = 0;
      for (const part of chunks) {
        body.set(part, offset);
        offset += part.length;
      }
      // Sem cookies, sessão de usuário, URL de destino ou headers controlados pelo chamador.
      const response = await requestUpstream(target, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "asaas-access-token": token,
          "x-vercel-protection-bypass": bypass,
          "User-Agent": "PereiraoSandboxWebhookRelay/1.0",
        },
        body,
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      });
      if (response.status === 400) return reply(400, { code: "INVALID_INPUT" });
      if (response.status !== 200) {
        await response.body?.cancel();
        return reply(502, { code: "UPSTREAM_UNAVAILABLE" });
      }
      const data = await response.json();
      // Não confundir tela HTML da proteção/erro com ACK durável da Function.
      if (data?.received === true) return reply(200, { received: true });
      if (data?.ignored === true) return reply(200, { ignored: true });
      return reply(502, { code: "UPSTREAM_UNAVAILABLE" });
    } catch {
      return reply(502, { code: "UPSTREAM_UNAVAILABLE" });
    }
  };
}
