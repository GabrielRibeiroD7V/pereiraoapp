export const INSTALL_DELAY_MS = 45_000;
export const INSTALL_LEGACY_SEEN_KEY = 'pereirao.install.shownAt';
export const INSTALL_SEEN_KEY = 'pereirao.install.visibleAt.v2';
export const INSTALL_AUTOMATIC_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const INSTALL_VISIBLE_MS = 3000;
export const INSTALL_DISMISS_KEY = 'pereirao.install.dismissedAt';
export const INSTALL_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
export function installDismissed(storage: Pick<Storage, 'getItem'>, now = Date.now(), key = INSTALL_DISMISS_KEY, cooldown = INSTALL_COOLDOWN_MS) {
  const value = Number(storage.getItem(key));
  return Number.isFinite(value) && value > 0 && value <= now && now - value < cooldown;
}
