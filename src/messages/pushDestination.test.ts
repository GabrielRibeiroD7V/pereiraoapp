import { expect, it, vi } from 'vitest';
import { allowedPushEndpoint, sendToPushService } from '../../supabase/functions/message-push/destination';

it.each([
  'https://web.push.apple.com/token',
  'https://fcm.googleapis.com/fcm/send/token',
  'https://fcm.googleapis.com/wp/token',
  'https://android.googleapis.com/gcm/send/token',
  'https://updates.push.services.mozilla.com/wpush/v2/token',
  'https://wns2-test.notify.windows.com/w/?token=example',
])('preserva o provedor Push conhecido: %s', endpoint => {
  expect(allowedPushEndpoint(endpoint)).toBe(true);
});

it.each([
  'http://127.0.0.1:8000/path', 'https://127.0.0.1/path', 'https://169.254.169.254/latest/meta-data',
  'https://[::1]/path', 'https://example.invalid/path', 'file:///etc/passwd',
  'https://web.push.apple.com.attacker.invalid/path', 'https://attacker.invalid/updates.push.services.mozilla.com',
  'https://web.push.apple.com@attacker.invalid/path', 'https://user:password@web.push.apple.com/path',
  'https://web.push.apple.com:8443/path', 'https://web.push.apple.com/path#fragment',
  'https://web.push.apple.com\\@attacker.invalid/path', ' https://web.push.apple.com/path',
  'https://web.push.apple.com/', 'https://web.push.apple.com./path',
  null, '', 'https://web.push.apple.com/' + 'a'.repeat(2048),
])('recusa destino sem realizar requisição: %s', async endpoint => {
  const send = vi.fn();
  expect(await sendToPushService({ endpoint: endpoint as string }, send)).toBe(false);
  expect(send).not.toHaveBeenCalled();
});

it('chama somente o destino permitido e propaga a falha para tratamento de expiração', async () => {
  const subscription = { endpoint: 'https://web.push.apple.com/token' };
  const send = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce({ statusCode: 410 });
  expect(await sendToPushService(subscription, send)).toBe(true);
  expect(send).toHaveBeenCalledExactlyOnceWith(subscription);
  await expect(sendToPushService(subscription, send)).rejects.toEqual({ statusCode: 410 });
});
