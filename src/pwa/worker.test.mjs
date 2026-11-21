// @vitest-environment node
import { readFile, mkdtemp, mkdir, writeFile, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, it, expect, vi } from "vitest";
import { buildPwa } from "../../scripts/build-pwa.mjs";
const template = await readFile(
  new URL("./service-worker.js", import.meta.url),
  "utf8",
);
const paths = [
  "/assets/app-123.js",
  "/assets/app-123.css",
  "/offline.html",
  "/images/pwa/icon-192.png",
];
function mime(path) {
  return path.endsWith(".html")
    ? "text/html"
    : path.endsWith(".css")
      ? "text/css"
      : path.endsWith(".png")
        ? "image/png"
        : "text/javascript";
}
function worker() {
  const stores = new Map(),
    listeners = new Map();
  const caches = {
    open: vi.fn(async (name) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const map = stores.get(name);
      return {
        match: async (path) => map.get(path)?.clone(),
        put: async (path, response) => map.set(path, response.clone()),
      };
    }),
    keys: async () => [...stores.keys()],
    delete: vi.fn(async (name) => stores.delete(name)),
  };
  const request = vi.fn(
    async (input) =>
      new Response(
        "Static " +
          new URL(typeof input === "string" ? input : input.url).pathname,
        {
          headers: {
            "Content-Type": mime(
              new URL(typeof input === "string" ? input : input.url).pathname,
            ),
          },
        },
      ),
  );
  const self = {
    location: { origin: "https://pereirao.example" },
    clients: { claim: vi.fn(async () => {}), matchAll: vi.fn(async () => [{id:"tab-a"},{id:"tab-b"}]) },
    skipWaiting: vi.fn(async () => {}),
    addEventListener: (name, fn) => listeners.set(name, fn),
  };
  runInNewContext(
    template
      .replace("__PWA_VERSION__", "aaaaaaaaaaaaaaaaaaaa")
      .replace("__STATIC_ASSETS__", JSON.stringify(paths)),
    { self, caches, Request, Response, URL, Set, fetch: request },
  );
  async function dispatch(name, event = {}) {
    const jobs = [];
    let response;
    listeners.get(name)({
      ...event,
      waitUntil: (p) => jobs.push(p),
      respondWith: (p) => {
        response = p;
      },
    });
    await Promise.all(jobs);
    return response ? await response : undefined;
  }
  return { stores, caches, self, request, dispatch };
}
function request(path, options = {}, navigation = false) {
  const r = new Request(new URL(path, "https://pereirao.example"), options);
  if (navigation) Object.defineProperty(r, "mode", { value: "navigate" });
  return r;
}
describe("worker: cache explícito e privado por versão", () => {
  it("pré-carrega apenas suporte offline sem disputar rede com rotas lazy", async () => {
    const f = worker();
    await f.dispatch("install");
    expect([...f.stores.get("pereirao-static-aaaaaaaaaaaaaaaaaaaa").keys()]).toEqual(paths.filter(path => !path.startsWith("/assets/")));
    expect(f.self.skipWaiting).not.toHaveBeenCalled();
    expect(
      f.request.mock.calls.every(
        ([r]) => r.cache === "reload" && r.redirect === "error",
      ),
    ).toBe(true);
  });
  it("mantém o cache ativo anterior quando uma instalação nova falha", async () => {
    const f = worker();
    f.stores.set("pereirao-static-old", new Map());
    f.request.mockRejectedValueOnce(Error("offline"));
    await expect(f.dispatch("install")).rejects.toThrow("offline");
    expect(f.stores.has("pereirao-static-old")).toBe(true);
    expect(f.stores.has("pereirao-static-aaaaaaaaaaaaaaaaaaaa")).toBe(false);
  });
  it("recusa HTML no lugar de um asset e limpa instalação incompleta", async () => {
    const f = worker();
    f.request.mockResolvedValueOnce(
      new Response("<html>offline</html>", { headers: { "Content-Type": "text/html" } }),
    ).mockResolvedValueOnce(
      new Response("<html>login</html>", {
        headers: { "Content-Type": "text/html" },
      }),
    );
    await expect(f.dispatch("install")).rejects.toThrow();
    expect(f.stores.has("pereirao-static-aaaaaaaaaaaaaaaaaaaa")).toBe(false);
  });
  it("preserva versões usadas por outras abas na ativação", async () => {
    const f = worker();
    f.stores.set("another-app-cache", new Map());
    f.stores.set("pereirao-static-old", new Map());
    await f.dispatch("activate");
    expect(f.stores.has("another-app-cache")).toBe(true);
    expect(f.stores.has("pereirao-static-old")).toBe(true);
    expect(f.self.clients.claim).toHaveBeenCalledOnce();
  });
  it("só coleta caches antigos após TODAS as abas confirmarem a versão nova",async()=>{
    const f=worker(); f.stores.set('pereirao-static-old',new Map()); f.stores.set('another-app-cache',new Map());
    await f.dispatch('message',{source:{id:'tab-a'},data:{type:'PEREIRAO_CLIENT_VERSION',version:'aaaaaaaaaaaaaaaaaaaa'}});
    expect(f.stores.has('pereirao-static-old')).toBe(true);
    await f.dispatch('message',{source:{id:'tab-b'},data:{type:'PEREIRAO_CLIENT_VERSION',version:'bbbbbbbbbbbbbbbbbbbb'}});
    expect(f.stores.has('pereirao-static-old')).toBe(true);
    await f.dispatch('message',{source:{id:'tab-b'},data:{type:'PEREIRAO_CLIENT_VERSION',version:'aaaaaaaaaaaaaaaaaaaa'}});
    expect(f.stores.has('pereirao-static-old')).toBe(false);
    expect(f.stores.has('another-app-cache')).toBe(true);
  });
  it('serve o mesmo hash antigo para uma aba preservada, sem trocar por chunk novo',async()=>{
    const f=worker(); f.stores.set('pereirao-static-old',new Map([['/assets/old-123.js',new Response('old chunk',{headers:{'Content-Type':'text/javascript'}})]]));
    const response=await f.dispatch('fetch',{request:request('/assets/old-123.js')});
    expect(await response.text()).toBe('old chunk'); expect(f.request).not.toHaveBeenCalled();
  });
  it('version.json e manifesto nunca entram no CacheStorage',async()=>{
    const f=worker(); for(const path of ['/version.json','/manifest.webmanifest']) expect(await f.dispatch('fetch',{request:request(path)})).toBeUndefined();
    expect(f.caches.open).not.toHaveBeenCalled();
  });
  it("só aplica atualização mediante a mensagem esperada", async () => {
    const f = worker();
    await f.dispatch("message", { data: { type: "UNKNOWN" } });
    expect(f.self.skipWaiting).not.toHaveBeenCalled();
    await f.dispatch("message", { data: { type: "PEREIRAO_ACTIVATE_UPDATE" } });
    expect(f.self.skipWaiting).toHaveBeenCalledOnce();
  });
  it.each([
    "/api/admin",
    "/api/sandbox-billing",
    "/api/asaas-webhook",
    "/api/other",
    "https://yazdjiwaksamizrbqewq.supabase.co/rest/v1/profiles",
    "https://yazdjiwaksamizrbqewq.supabase.co/auth/v1/user",
    "https://yazdjiwaksamizrbqewq.supabase.co/storage/v1/object/sign/business-portfolio/private.webp?token=private",
    "/foto.webp?token=private",
    "/assets/app-123.js?token=private",
    "/images/providers/private.png",
  ])("não intercepta nem armazena %s", async (path) => {
    const f = worker();
    expect(
      await f.dispatch("fetch", { request: request(path) }),
    ).toBeUndefined();
    expect(f.caches.open).not.toHaveBeenCalled();
    expect(f.request).not.toHaveBeenCalled();
  });
  it("não intercepta POST nem estático com Authorization", async () => {
    const f = worker();
    for (const r of [
      request("/api/admin", { method: "POST", body: "private" }),
      request("/assets/app-123.js", {
        headers: { Authorization: "Bearer private" },
      }),
    ])
      expect(await f.dispatch("fetch", { request: r })).toBeUndefined();
    expect(f.caches.open).not.toHaveBeenCalled();
  });
  it.each([
    "/admin",
    "/conta",
    "/entrar",
    "/prestadores/profissional",
    "/trabalhos/00000000-0000-4000-8000-000000000001",
    "/auth/retorno?code=private",
  ])("busca HTML atual sem cache para %s", async (path) => {
    const f = worker();
    const response = await f.dispatch("fetch", {
      request: request(path, {}, true),
    });
    expect(response.status).toBe(200);
    expect(f.request.mock.calls[0][0].cache).toBe("no-store");
    expect(f.caches.open).not.toHaveBeenCalled();
  });
  it("retorna offline genérico em navegação sem gravar a URL privada", async () => {
    const f = worker();
    await f.dispatch("install");
    f.request.mockRejectedValue(Error("offline"));
    const response = await f.dispatch("fetch", {
      request: request("/admin?session=private", {}, true),
    });
    expect(await response.text()).toContain("/offline.html");
    expect([...f.stores.get("pereirao-static-aaaaaaaaaaaaaaaaaaaa").keys()]).toEqual(paths.filter(path => !path.startsWith("/assets/")));
    expect(
      JSON.stringify([...f.stores.get("pereirao-static-aaaaaaaaaaaaaaaaaaaa").keys()]),
    ).not.toContain("private");
  });
  it("retorna 503 seguro se o fallback estiver ausente", async () => {
    const f = worker();
    f.request.mockRejectedValue(Error("offline"));
    const response = await f.dispatch("fetch", {
      request: request("/conta", {}, true),
    });
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("armazena chunk sob demanda e o serve offline sem pré-carregar todas as rotas", async () => {
    const f = worker();
    await f.dispatch("install");
    expect(f.request.mock.calls.some(([r]) => new URL(r.url).pathname.startsWith("/assets/"))).toBe(false);
    await f.dispatch("fetch", { request: request("/assets/app-123.js") });
    f.request.mockRejectedValue(Error("offline"));
    const r = await f.dispatch("fetch", {
      request: request("/assets/app-123.js"),
    });
    expect(await r.text()).toContain("Static /assets/app-123.js");
  });
});
describe("manifesto e build do PWA", () => {
  it("usa a Home, standalone, identidade e ícones PNG válidos", async () => {
    const manifest = JSON.parse(
      await readFile("public/manifest.webmanifest", "utf8"),
    );
    expect(manifest).toMatchObject({
      id: "/",
      name: "PEREIRÃO",
      start_url: "/?source=pwa",
      scope: "/",
      display: "standalone",
      theme_color: "#FFD000",
      background_color: "#FFFFFF",
    });
    for (const icon of manifest.icons) {
      const png = await readFile("public" + icon.src);
      expect(png.toString("hex", 0, 8)).toBe("89504e470d0a1a0a");
      expect(icon.sizes).toBe(
        png.readUInt32BE(16) + "x" + png.readUInt32BE(20),
      );
    }
    const apple = await readFile("public/images/pwa/apple-touch-icon.png");
    expect(apple.readUInt32BE(16)).toBe(180);
    expect(apple.readUInt32BE(20)).toBe(180);
    expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
  });
  it("gera versão determinística e a altera quando qualquer recurso muda", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pereirao-pwa-"));
    try {
      await cp("public", directory, { recursive: true });
      await mkdir(join(directory, "assets"));
      await writeFile(join(directory,"index.html"),"<html><head></head><body></body></html>");
      await writeFile(
        join(directory, "assets", "app-123.js"),
        'console.log("public")',
      );
      await writeFile(join(directory, "assets", "private.map"), "not cached");
      const first = await buildPwa(directory),
        same = await buildPwa(directory);
      expect(same.version).toBe(first.version);
      expect(JSON.parse(await readFile(join(directory,'version.json'),'utf8'))).toEqual({version:first.version});
      expect(await readFile(join(directory,'index.html'),'utf8')).toContain(`name="pereirao-build" content="${first.version}"`);
      await writeFile(join(directory,'index.html'),'<html><head></head><body>changed HTML</body></html>');
      expect((await buildPwa(directory)).version).not.toBe(first.version);
      await writeFile(
        join(directory, "assets", "app-123.js"),
        'console.log("updated")',
      );
      expect((await buildPwa(directory)).version).not.toBe(first.version);
      const source = await readFile(join(directory, "sw.js"), "utf8");
      expect(source).not.toContain("__PWA_VERSION__");
      expect(source).not.toContain("private.map");
      expect(source).not.toContain("/api/admin");
      expect(source).not.toContain("index.html");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it("preserva o diagnóstico de servidor e impede cache HTTP do worker", async () => {
    const config = JSON.parse(await readFile("vercel.json", "utf8"));
    expect(config.buildCommand).toBe(
      "npm run build && node scripts/check-asaas-sandbox.mjs",
    );
    expect(config.rewrites[0]).toEqual({
      source: "/api/admin",
      destination: "/api/admin",
    });
    expect(
      config.headers.find((h) => h.source === "/sw.js").headers,
    ).toContainEqual({ key: "Cache-Control", value: "no-store" });
    const index = await readFile("index.html", "utf8");
    expect(index).toContain("viewport-fit=cover");
    expect(index).toContain("/manifest.webmanifest");
    expect(index).toContain("apple-touch-icon");
  });
});
describe('contrato HTTP de versões',()=>{
 it('impede HTML/version/SW obsoletos e mantém hashes imutáveis sem alterar rotas de API',async()=>{
  const config=JSON.parse(await readFile('vercel.json','utf8'));
  const policy=source=>config.headers.filter(h=>h.source===source).flatMap(h=>h.headers);
  expect(policy('/(.*)')).toContainEqual({key:'Cache-Control',value:'no-store'});
  expect(policy('/version.json')).toContainEqual({key:'Cache-Control',value:'no-store'});
  expect(policy('/assets/(.*)')).toContainEqual({key:'Cache-Control',value:'public, max-age=31536000, immutable'});
  expect(policy('/manifest.webmanifest')).toContainEqual({key:'Cache-Control',value:'no-cache'});
  for(const path of ['/api/admin','/api/sandbox-billing','/api/asaas-webhook']) expect(config.rewrites).toContainEqual({source:path,destination:path});
 });
});
