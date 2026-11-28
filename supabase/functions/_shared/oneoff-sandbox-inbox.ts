import { oneoffNotice, oneoffUuid } from './oneoff-notice.ts';

const projectUrl = 'https://yazdjiwaksamizrbqewq.supabase.co';
const rpcUrl = projectUrl + '/rest/v1/rpc/admin_oneoff_server';
const paths = ['/asaas-admin-oneoff-sandbox-webhook', '/functions/v1/asaas-admin-oneoff-sandbox-webhook'];
type Env = Record<string, string | undefined>;
const reply = (status: number, value: unknown) => Response.json(value, {status, headers: {'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'}});
const encoded = (value: string) => new TextEncoder().encode(value);
const digest = (value: string) => crypto.subtle.digest('SHA-256', encoded(value));
async function sameToken(expected: string, actual: string | null) {
 if (!actual || actual.length > 255) return false;
 const [a, b] = await Promise.all([expected, actual].map(async value => new Uint8Array(await digest(value))));
 let different = 0;
 for (let i = 0; i < 32; i++) different |= a![i]! ^ b![i]!;
 return different === 0;
}
async function readJson(stream: ReadableStream<Uint8Array> | null, limit: number): Promise<unknown> {
 if (!stream) throw new Error('INVALID_INPUT');
 const reader = stream.getReader(), chunks: Uint8Array[] = [];
 let size = 0;
 try {
  for (;;) {
   const next = await reader.read(); if (next.done) break;
   size += next.value.length;
   if (size > limit) {await reader.cancel(); throw new Error('BODY_TOO_LARGE');}
   chunks.push(next.value);
  }
 } finally {reader.releaseLock();}
 const bytes = new Uint8Array(size); let offset = 0;
 for (const part of chunks) {bytes.set(part, offset); offset += part.length;}
 return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
}

// Fixed Sandbox + enqueue only. No caller-selected command, environment, URL,
// actor, API credential or financial write. Never uses service_role or a bypass.
export function createOneoffSandboxInbox(env: Env, databaseFetch: typeof fetch = fetch) {
 return async (request: Request) => {
  const url = new URL(request.url);
  if (!paths.includes(url.pathname) || url.search) return reply(404, {code: 'NOT_FOUND'});
  if (request.method !== 'POST') return reply(405, {code: 'METHOD_NOT_ALLOWED'});
  // Normalize only ASCII whitespace accidentally added around the server-side Secret.
  // The HTTP header is never normalized: authentication still requires the exact token.
  const token = env.ASAAS_ADMIN_ONEOFF_SANDBOX_WEBHOOK_TOKEN?.replace(/^[ \\t\\r\\n]+|[ \\t\\r\\n]+$/g, '');
  const signing = env.ASAAS_ADMIN_ONEOFF_SANDBOX_RPC_SIGNING_SECRET;
  const publishable = env.ASAAS_ADMIN_ONEOFF_SANDBOX_PUBLISHABLE_KEY;
  if (env.ASAAS_ADMIN_ONEOFF_SANDBOX_RECEIVER_ENABLED !== 'true' || env.SUPABASE_URL !== projectUrl ||
      !token || !/^[\x21-\x7e]{32,255}$/.test(token) || !signing || !/^[A-Za-z0-9_-]{48,200}$/.test(signing) ||
      !publishable || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishable) || token === signing ||
      token === env.ASAAS_SANDBOX_WEBHOOK_TOKEN || signing === env.BILLING_PRODUCTION_RPC_SIGNING_SECRET ||
      token === env.ASAAS_PRODUCTION_WEBHOOK_TOKEN) return reply(503, {code: 'SETUP_REQUIRED'});
  if (!await sameToken(token, request.headers.get('asaas-access-token'))) return reply(401, {code: 'AUTH_REQUIRED'});
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) return reply(415, {code: 'JSON_REQUIRED'});
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 65536)) return reply(413, {code: 'BODY_TOO_LARGE'});
  let notice;
  try {notice = oneoffNotice(await readJson(request.body, 65536));}
  catch (error) {return reply(error instanceof Error && error.message === 'BODY_TOO_LARGE' ? 413 : 400, {code: 'INVALID_INPUT'});}
  if (!notice) return reply(400, {code: 'INVALID_INPUT'});
  try {
   const command = 'enqueue', raw = JSON.stringify({...notice, environment: 'sandbox'});
   const nonce = crypto.randomUUID(), issuedAt = Math.floor(Date.now() / 1000);
   // Same oneoff-v1 wire proof and existing Sandbox digest; no digest replacement.
   const key = await crypto.subtle.importKey('raw', await digest(signing), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
   const mac = await crypto.subtle.sign('HMAC', key, encoded(`oneoff-v1\n${command}\n${nonce}\n${issuedAt}\n${raw}`));
   const signature = Array.from(new Uint8Array(mac), byte => byte.toString(16).padStart(2, '0')).join('');
   const response = await databaseFetch(rpcUrl, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: {apikey: publishable, 'Content-Type': 'application/json', Accept: 'application/json'},
    body: JSON.stringify({command, raw_payload: raw, issued_at: issuedAt, nonce, signature}),
   });
   if (!response.headers.get('content-type')?.includes('application/json')) {await response.body?.cancel(); return reply(503, {code: 'INBOX_UNAVAILABLE'});}
   const result = await readJson(response.body, 2048);
   if (!response.ok) {
    const code = result && typeof result === 'object' && 'code' in result ? result.code : null;
    return reply(code === '23505' || code === '23514' ? 409 : 503, {code: code === '23505' || code === '23514' ? 'CONFLICT' : 'INBOX_UNAVAILABLE'});
   }
   if (response.status !== 200 || !result || typeof result !== 'object' || !('duplicate' in result) || typeof result.duplicate !== 'boolean' || !('requestId' in result) || !(result.requestId === null || oneoffUuid(result.requestId))) return reply(503, {code: 'INBOX_UNAVAILABLE'});
   // RPC commits its inbox transaction before resolving. Reconciliation is the
   // existing admin retry/GET flow; this receiver never declares a payment paid.
   return reply(200, {received: true, duplicate: result.duplicate});
  } catch {return reply(503, {code: 'INBOX_UNAVAILABLE'});}
 };
}
