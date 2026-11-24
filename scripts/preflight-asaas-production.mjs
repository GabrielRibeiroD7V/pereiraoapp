// Somente servidor, opt-in; nunca cria recursos ou habilita o receptor.
import { boundedJson } from '../server/production-billing-provider.ts';
const financialFlags = ['CHECKOUT', 'SUBSCRIPTIONS', 'CHARGES', 'ENFORCEMENT', 'PIX'];
const statuses = new Set(['PENDING', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED']);
export async function productionReadOnlyPreflight(env, request = fetch) {
  if (env.VERCEL_ENV !== 'production' || env.ASAAS_PRODUCTION_PREFLIGHT_READ_ONLY !== 'true') return { state: 'skipped' };
  if ((env.ASAAS_PRODUCTION_WEBHOOK_ENABLED !== undefined && env.ASAAS_PRODUCTION_WEBHOOK_ENABLED !== 'false') || financialFlags.some(name => env[`ASAAS_PRODUCTION_${name}_ENABLED`] !== undefined && env[`ASAAS_PRODUCTION_${name}_ENABLED`] !== 'false')) return { state: 'unsafe_configuration' };
  const key = env.ASAAS_API_KEY_PRODUCTION;
  const invalid = reason => ({ state: 'invalid_key_format', reason });
  if (typeof key !== 'string' || !key) return invalid('missing');
  if (key.trim() !== key) return invalid('outer_whitespace');
  if (/^["']|["']$/.test(key)) return invalid('quoted_value');
  if (key.startsWith('$aact_hmlg_')) return invalid('sandbox_key');
  if (!key.startsWith('$aact_prod_')) return invalid('unexpected_prefix');
  if (!/^\$aact_prod_[\x21-\x7E]{1,2048}$/.test(key)) return invalid('invalid_characters_or_length');
  if (key === env.ASSAS_API_KEY_SANDBOX) return invalid('reused_sandbox_value');
  try {
    const response = await request('https://api.asaas.com/v3/myAccount/status/', {
      method: 'GET', headers: { access_token: key, accept: 'application/json', 'User-Agent': 'PereiraoProductionReadOnlyPreflight/1.0' },
      redirect: 'error', signal: AbortSignal.timeout(8000),
    });
    if (response.status !== 200 || !response.headers.get('content-type')?.includes('application/json')) {
      await response.body?.cancel();
      return { state: 'not_validated', httpStatus: response.status };
    }
    const data = await boundedJson(response, 65536);
    return { state: 'connected', httpStatus: 200, account: Object.fromEntries(['commercialInfo', 'bankAccountInfo', 'documentation', 'general'].map(name => [name, statuses.has(data[name]) ? data[name] : 'UNKNOWN'])) };
  } catch { return { state: 'communication_error' }; }
}
