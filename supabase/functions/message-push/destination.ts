/** Limita egress aos serviços de Push conhecidos; nunca segue uma URL arbitrária cadastrada pelo cliente. */
export function allowedPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 2048 || /[\s\\]/.test(endpoint)) return false;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash || url.pathname === '/') return false;
    return url.hostname === 'fcm.googleapis.com'
      || url.hostname === 'android.googleapis.com'
      || url.hostname === 'updates.push.services.mozilla.com'
      || /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.push\.apple\.com$/.test(url.hostname)
      || /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.notify\.windows\.com$/.test(url.hostname);
  } catch { return false; }
}

export async function sendToPushService<T extends { endpoint: string }>(subscription: T, send: (subscription: T) => Promise<unknown>) {
  if (!allowedPushEndpoint(subscription.endpoint)) return false;
  await send(subscription);
  return true;
}
