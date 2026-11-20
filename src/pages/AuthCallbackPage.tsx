import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { authErrorMessage } from '../auth/errors';
import { PageHeader } from '../components/PageHeader';
import { safeReturnPath } from '../auth/returnPath';
import { clearAuthReturn, readAuthReturn } from '../auth/flowState';

export function AuthCallbackPage() {
  const { gateway } = useAuth();
  const [params] = useSearchParams();
  const code = params.get('code');
  const recovery = params.get('flow') === 'recovery';
  const [next] = useState(() => params.has('next') ? safeReturnPath(params.get('next')) : readAuthReturn());
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  useEffect(() => {
    let live = true;
    if (!gateway || !code) return;
    void gateway.completeCallback(code).then(() => {
      if (live) {
        clearAuthReturn();
        navigate(recovery ? `/redefinir-senha?${new URLSearchParams({ next })}` : next, { replace: true });
      }
    }).catch((cause: unknown) => { if (live) setError(authErrorMessage(cause)); });
    return () => { live = false; };
  }, [gateway, code, recovery, next, navigate]);
  const message = error ?? (!gateway ? 'O acesso à conta ainda está sendo preparado.' : !code ? 'Link inválido ou expirado. Solicite um novo e-mail.' : null);
  return <div className="auth-page">
    <PageHeader title="Confirmar acesso" />
    {message ? <><p role="alert" className="form-error">{message}</p><Link className="button button--secondary" to="/recuperar-senha">Solicitar novo link</Link></> : <p role="status">Confirmando seu acesso…</p>}
  </div>;
}
