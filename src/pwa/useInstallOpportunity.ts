import { useEffect, useState } from 'react';

import { INSTALL_DELAY_MS } from './installPolicy';

/** Apenas uma preferência local de interface; não lê sessão, tokens ou dados pessoais. */
export function useInstallOpportunity(pathname: string) {
  const publicPage = pathname === "/conta" || /^\/conta\/profissional\/[^/]+\/perfil$/.test(pathname) || pathname === '/' || pathname === '/buscar' || pathname.startsWith('/prestadores/') || pathname.startsWith('/trabalhos/');
  const [ready, setReady] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [obstructed, setObstructed] = useState(false);
  useEffect(() => {
    if (!publicPage) return;
    const timer = window.setTimeout(() => setReady(true), INSTALL_DELAY_MS);
    const engage = () => setEngaged(true);
    window.addEventListener('pointerdown', engage, { once: true });
    window.addEventListener('keydown', engage, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', engage);
      window.removeEventListener('keydown', engage);
    };
  }, [publicPage]);
  useEffect(() => {
    const check = () => {
      const active = document.activeElement;
      const editing = active?.matches('input,textarea,select,[contenteditable=true]') ?? false;
      const importantAction = Boolean(active?.matches('button,a') && active.closest('main') && !active.closest('.pwa-install'));
      const viewport = window.visualViewport;
      const keyboard = Boolean(viewport && window.innerHeight - viewport.height > 150);
      const overlay = [...document.querySelectorAll('dialog[open], [role="dialog"], [aria-busy="true"]')].some(node => !node.closest(".pwa-install-help"));
      setObstructed(editing || importantAction || keyboard || overlay || document.visibilityState === "hidden");
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open", "aria-busy"] });
    document.addEventListener("visibilitychange", check);
    document.addEventListener('focusin', check);
    document.addEventListener('focusout', check);
    window.visualViewport?.addEventListener('resize', check);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", check);
      document.removeEventListener('focusin', check);
      document.removeEventListener('focusout', check);
      window.visualViewport?.removeEventListener('resize', check);
    };
  }, []);
  return publicPage && ready && engaged && !obstructed;
}
