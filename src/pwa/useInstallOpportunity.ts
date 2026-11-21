import { useEffect, useState } from 'react';

import { INSTALL_DELAY_MS } from './installPolicy';

/** Apenas uma preferência local de interface; não lê sessão, tokens ou dados pessoais. */
export function useInstallOpportunity(pathname: string) {
  const publicPage = pathname === '/' || pathname === '/buscar' || pathname.startsWith('/prestadores/') || pathname.startsWith('/trabalhos/');
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
      setObstructed(editing || importantAction || keyboard);
    };
    check();
    document.addEventListener('focusin', check);
    document.addEventListener('focusout', check);
    window.visualViewport?.addEventListener('resize', check);
    return () => {
      document.removeEventListener('focusin', check);
      document.removeEventListener('focusout', check);
      window.visualViewport?.removeEventListener('resize', check);
    };
  }, []);
  return publicPage && ready && engaged && !obstructed;
}
