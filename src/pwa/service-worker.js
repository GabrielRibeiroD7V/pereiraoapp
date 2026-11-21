/* Gerado por scripts/build-pwa.mjs; não contém dados dinâmicos ou credenciais. */
const CACHE_PREFIX = 'pereirao-static-';
const VERSION = '__PWA_VERSION__';
const CACHE_NAME = CACHE_PREFIX + VERSION;
const clientVersions = new Map();
const STATIC_ASSETS = __STATIC_ASSETS__;
const ALLOWED = new Set(STATIC_ASSETS);
// Não disputa rede com a abertura nem baixa todas as rotas lazy.
// JS/CSS são estáticos permitidos, mas entram no cache somente quando requisitados.
const PRECACHE_ASSETS = STATIC_ASSETS.filter(path => !path.startsWith('/assets/'));
const OFFLINE = '/offline.html';
function validStatic(response, path) {
  const mime = response.headers.get('Content-Type') || '';
  const expected = path.endsWith('.html') ? 'text/html' : path.endsWith('.css') ? 'text/css' : path.endsWith('.png') ? 'image/png' : path.endsWith('.woff2') ? 'font/woff2' : '(?:text|application)/javascript';
  return response.ok && !response.redirected && new RegExp('^' + expected + '(?:;|$)', 'i').test(mime);
}
async function staticResponse(request, path) {
  const cache = await caches.open(CACHE_NAME);
  const stored = await cache.match(path);
  if (stored) return stored;
  const response = await fetch(request);
  if (validStatic(response, path)) await cache.put(path, response.clone());
  return response;
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      await Promise.all(PRECACHE_ASSETS.map(async path => {
        const response = await fetch(new Request(new URL(path, self.location.origin), { cache: 'reload', credentials: 'same-origin', redirect: 'error' }));
        if (!validStatic(response, path)) throw new Error('Static asset unavailable');
        await cache.put(path, response);
      }));
    } catch (error) {
      await caches.delete(CACHE_NAME);
      throw error;
    }
  })());
  // Uma atualização permanece waiting até a confirmação do usuário.
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Não apaga chunks usados por outras abas ou formulários ainda na versão anterior.
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'PEREIRAO_ACTIVATE_UPDATE') event.waitUntil(self.skipWaiting());
  if (event.data?.type === 'PEREIRAO_CLIENT_VERSION' && event.source?.id && /^[a-f0-9]{20}$/.test(event.data.version)) {
    clientVersions.set(event.source.id, event.data.version);
    event.waitUntil((async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // Abas antigas/sem resposta impedem a coleta. Nenhum dado de sessão é armazenado.
      if (!clients.length || clients.some(client => clientVersions.get(client.id) !== VERSION)) return;
      const keys = await caches.keys();
      await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
    })());
  }
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  // POST, Auth, API, Supabase/Storage, URLs assinadas e recursos não listados nunca usam CacheStorage.
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('Authorization') || url.pathname === '/api' || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(new Request(request, { cache: 'no-store' })).catch(async () =>
      (await (await caches.open(CACHE_NAME)).match(OFFLINE)) ||
      new Response('Sem conexão. Conecte-se à internet para continuar.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })
    ));
    return;
  }
  if (!url.search && ALLOWED.has(url.pathname)) event.respondWith(staticResponse(request, url.pathname));
  else if (!url.search && /^\/assets\/[a-zA-Z0-9_-]+\.(?:js|css|woff2)$/.test(url.pathname)) {
    // Uma aba antiga continua usando SOMENTE suas URLs com hash, nunca um chunk de outro nome.
    event.respondWith((async () => {
      for (const key of await caches.keys()) {
        if (!key.startsWith(CACHE_PREFIX)) continue;
        const stored = await (await caches.open(key)).match(url.pathname);
        if (stored && validStatic(stored, url.pathname)) return stored;
      }
      return fetch(request); // Nunca salva um recurso desconhecido ou resposta dinâmica.
    })());
  }
});
