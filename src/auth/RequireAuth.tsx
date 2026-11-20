import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function safeReturnPath(value: string | null) {
  return value && ['/conta', '/conta/dados'].includes(value) ? value : '/conta';
}

export function RequireAuth() {
  const { session, loading, error } = useAuth();
  const { pathname } = useLocation();
  if (loading) return <p role="status">Verificando sua sessão…</p>;
  if (error) return <p role="alert">{error} Recarregue a página para tentar novamente.</p>;
  if (!session) return <Navigate to={`/entrar?${new URLSearchParams({ next: safeReturnPath(pathname) })}`} replace />;
  return <Outlet />;
}
