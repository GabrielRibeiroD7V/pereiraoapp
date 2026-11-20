import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { AccountPage } from '../pages/AccountPage';
import { HomePage } from '../pages/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { SearchPage } from '../pages/SearchPage';
import { routes } from './routes';
import { AuthProvider } from '../auth/AuthProvider';
import type { AuthGateway } from '../auth/types';
import { RequireAuth } from '../auth/RequireAuth';
import { AuthPage } from '../pages/AuthPage';
import { AuthCallbackPage } from '../pages/AuthCallbackPage';
import { PersonalDataPage } from '../pages/PersonalDataPage';

const titles: Record<string, string> = {
  [routes.home]: 'Início', [routes.search]: 'Buscar', [routes.account]: 'Conta',
  '/entrar': 'Entrar', '/criar-conta': 'Criar conta', '/recuperar-senha': 'Recuperar senha',
  '/redefinir-senha': 'Definir nova senha', '/auth/retorno': 'Confirmar acesso', '/conta/dados': 'Meus dados',
};

export function App({ authGateway }: { authGateway?: AuthGateway | null }) {
  return <AuthProvider gateway={authGateway}><AppRoutes /></AuthProvider>;
}

function AppRoutes() {
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
        <Route path="/entrar" element={<AuthPage key="login" mode="login" />} />
        <Route path="/criar-conta" element={<AuthPage key="signup" mode="signup" />} />
        <Route path="/recuperar-senha" element={<AuthPage key="recovery" mode="recovery" />} />
        <Route path="/auth/retorno" element={<AuthCallbackPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/conta/dados" element={<PersonalDataPage />} />
          <Route path="/redefinir-senha" element={<AuthPage key="password" mode="password" />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
