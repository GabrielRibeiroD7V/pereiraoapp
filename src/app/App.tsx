import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { AccountPage } from '../pages/AccountPage';
import { HomePage } from '../pages/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { SearchPage } from '../pages/SearchPage';
import { routes } from './routes';

const titles: Record<string, string> = {
  [routes.home]: 'Início', [routes.search]: 'Buscar', [routes.account]: 'Conta',
};

export function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = `${titles[pathname] ?? 'Página não encontrada'} | PEREIRÃO`;
  }, [pathname]);

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path={routes.home} element={<HomePage />} />
        <Route path={routes.search} element={<SearchPage />} />
        <Route path={routes.account} element={<AccountPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
