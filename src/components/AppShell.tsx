import { useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';
import { Outlet, useLocation } from 'react-router-dom';
import { Brand } from './Brand';
import { MainNavigation } from './MainNavigation';
import { InstallInvitation } from '../pwa/PwaProvider';

export function AppShell() {
  const { pathname } = useLocation();
  const previousPath = useRef(pathname);

  useEffect(() => {
    if (previousPath.current !== pathname) {
      document.getElementById('page-title')?.focus();
      previousPath.current = pathname;
    }
  }, [pathname]);

  return (
    <>
      <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
      <header className="app-header">
        <div className="app-header__inner">
          <MainNavigation />
          <Brand />
          <div className="location" aria-label="Cidade inicial: Mundo Novo, Mato Grosso do Sul">
            <MapPin size={18} aria-hidden="true" /><span>Mundo Novo, MS</span>
          </div>
        </div>
      </header>
      <main id="main-content" className="page-container" tabIndex={-1}><Outlet /></main>
      <InstallInvitation />
    </>
  );
}
