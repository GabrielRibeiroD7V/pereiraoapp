export const INSTALL_DELAY_MS = 45_000;
export const INSTALL_DISMISS_KEY = 'pereirao.install.dismissedAt';
export const INSTALL_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
export function installDismissed(storage: Pick<Storage, 'getItem'>, now = Date.now()) {
  const value = Number(storage.getItem(INSTALL_DISMISS_KEY));
  return Number.isFinite(value) && value > 0 && value <= now && now - value < INSTALL_COOLDOWN_MS;
}
