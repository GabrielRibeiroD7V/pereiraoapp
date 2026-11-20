import { UserRound } from 'lucide-react';
import { ContentState } from '../components/ContentState';
import { PageHeader } from '../components/PageHeader';
import { LinkButton } from '../components/LinkButton';
import { routes } from '../app/routes';
import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { authErrorMessage } from '../auth/errors';

export function AccountPage() {
  const { session, gateway, loading, error: sessionError } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function signOut() {
    if (!gateway || pending) return;
    setPending(true); setError(null);
    try { await gateway.signOut(); }
    catch (cause) { setError(authErrorMessage(cause)); }
    finally { setPending(false); }
  }
  return (
    <>
      <PageHeader title="Conta"><p>Seu espaço no PEREIRÃO.</p></PageHeader>
      {loading ? <p role="status">Verificando sua sessão…</p> : session ? <>
        <ContentState icon={UserRound} title={session.user.displayName || 'Sua conta'}>{session.user.email}</ContentState>
        <div className="account-actions">
          <LinkButton to="/conta/dados" variant="secondary">Meus dados</LinkButton>
          <button className="button button--secondary" disabled={pending} onClick={() => void signOut()}>{pending ? 'Saindo…' : 'Sair'}</button>
        </div>
      </> : <>
        <ContentState icon={UserRound} title="Uma conta, novas possibilidades">
          Entre ou crie uma conta gratuita. Você pode continuar explorando sem entrar.
        </ContentState>
        <div className="account-actions"><LinkButton to="/entrar">Entrar</LinkButton><LinkButton to="/criar-conta" variant="secondary">Criar conta</LinkButton></div>
      </>}
      {(error || sessionError) && <p className="form-error" role="alert">{error || sessionError}</p>}
      <LinkButton to={routes.home} variant="secondary">Continuar explorando</LinkButton>
    </>
  );
}
