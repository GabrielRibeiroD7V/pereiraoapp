import {usePostScrollReturn} from '../posts/postReturn';
import { Suspense, useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';
import { Outlet, useLocation } from 'react-router-dom';
import { RouteBoundary } from './RouteBoundary';
import { LoadingState } from './LoadingState';
import { Brand } from './Brand';
import { MainNavigation } from './MainNavigation';
import { InstallInvitation, VersionDiagnostics } from '../pwa/PwaProvider';
import { HomeHero } from './HomeHero';

export function AppShell() {
  usePostScrollReturn();
  const { pathname, search } = useLocation();
  const home = pathname === '/';
  const previousPath = useRef(pathname);

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    const main = document.getElementById('main-content');
    const focusTitle = () => {
      const title = document.getElementById('page-title');
      title?.focus();
      return Boolean(title);
    };
    if (focusTitle() || !main) return;
    // A rota lazy ainda pode estar mostrando o fallback; transfere o foco após montar.
    const observer = new MutationObserver(() => { if (focusTitle()) observer.disconnect(); });
    observer.observe(main, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  return (
    <>
      <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
      <div className={home ? 'home-masthead' : undefined}>
        <header className={`app-header${home ? ' app-header--home' : ''}`}>
          <div className="app-header__inner">
            <Brand inverse />
            <div className="app-header__actions">
              <div className="location" aria-label="Cidade inicial: Mundo Novo, Mato Grosso do Sul">
                <MapPin size={18} aria-hidden="true" /><span>Mundo Novo, MS</span>
              </div>
            </div>
          </div>
        </header>
        {home && <HomeHero />}
      </div>
      <MainNavigation />
      <main id="main-content" className={`page-container${home ? ' page-container--home' : ''}`} tabIndex={-1}><RouteBoundary key={pathname}><Suspense fallback={<LoadingState>Carregando página…</LoadingState>}><Outlet /></Suspense></RouteBoundary></main>
      <InstallInvitation />
      {new URLSearchParams(search).get('pwa-diagnostico') === '1' && <VersionDiagnostics />}
    </>
  );
}
