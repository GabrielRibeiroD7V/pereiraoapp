import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { authErrorMessage } from '../auth/errors';
import { safeReturnPath } from '../auth/RequireAuth';
import { FormField } from '../components/FormField';
import { PageHeader } from '../components/PageHeader';

type Mode = 'login' | 'signup' | 'recovery' | 'password';
const titles: Record<Mode, string> = {
  login: 'Entrar', signup: 'Criar conta', recovery: 'Recuperar senha', password: 'Definir nova senha',
};

export function AuthPage({ mode }: { mode: Mode }) {
  const { gateway, session, loading } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeReturnPath(params.get('next'));
  if (session && !loading && (mode === 'login' || mode === 'signup')) return <Navigate to={next} replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!gateway || pending || loading) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');
    const name = String(data.get('display_name') ?? '').trim();
    setError(null); setNotice(null);
    if ((mode === 'signup' || mode === 'password') && password.length < 8) {
      setError('Use pelo menos 8 caracteres na senha.'); return;
    }
    if (mode === 'signup' && name.length < 2) { setError('Informe seu nome com pelo menos 2 caracteres.'); return; }
    if (mode === 'password' && password !== String(data.get('password_confirm') ?? '')) {
      setError('As senhas precisam ser iguais.'); return;
    }
    setPending(true);
    try {
      if (mode === 'login') {
        await gateway.signIn(email, password);
        navigate(next, { replace: true });
      } else if (mode === 'signup') {
        const result = await gateway.signUp(email, password, name, next);
        if (result.confirmationRequired) {
          form.reset();
          setNotice('Enviamos um link de confirmação para o e-mail informado. Abra a mensagem e toque em Confirmar conta. Confira também a pasta de spam. Se já possui uma conta, entre ou recupere sua senha.');
        } else navigate(next, { replace: true });
      } else if (mode === 'recovery') {
        await gateway.requestReset(email, next);
        form.reset();
        setNotice('Se houver uma conta para esse e-mail, você receberá as instruções para recuperar a senha.');
      } else {
        await gateway.updatePassword(password);
        // Encerrar a sessão local após a troca; demais dispositivos seguem a política do Auth.
        await gateway.signOut();
        navigate(`/entrar?${new URLSearchParams({ senha: 'atualizada', next })}`, { replace: true });
      }
    } catch (cause) { setError(authErrorMessage(cause)); }
    finally { setPending(false); }
  }

  return (
    <div className="auth-page">
      <PageHeader title={titles[mode]}>
        <p>{mode === 'signup' ? 'Uma conta para você e seus futuros perfis profissionais.' : 'Seu acesso ao PEREIRÃO.'}</p>
      </PageHeader>
      {!gateway && <p className="form-notice" role="status">O acesso à conta ainda está sendo preparado. Você pode continuar explorando os serviços.</p>}
      {loading && <p role="status">Verificando sua sessão…</p>}
      {mode === 'login' && params.get('senha') === 'atualizada' && <p role="status">Senha atualizada. Entre com sua nova senha.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <div className="form-notice auth-confirmation" role="status"><strong>{mode === 'signup' ? 'Confirme seu e-mail' : 'Confira seu e-mail'}</strong><p>{notice}</p></div>}
      <form className="auth-form" onSubmit={submit} aria-busy={pending}>
        {mode === 'signup' && <FormField id="auth-name" name="display_name" label="Seu nome" autoComplete="name" minLength={2} maxLength={100} required />}
        {mode !== 'password' && <FormField id="auth-email" name="email" label="E-mail" type="email" autoComplete="email" maxLength={254} required />}
        {mode !== 'recovery' && <FormField id="auth-password" name="password" label={mode === 'password' ? 'Nova senha' : 'Senha'} type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? undefined : 8} maxLength={128} required />}
        {mode === 'password' && <FormField id="auth-confirm" name="password_confirm" label="Confirme a nova senha" type="password" autoComplete="new-password" minLength={8} maxLength={128} required />}
        {(mode === 'signup' || mode === 'password') && <p className="field-help">Use pelo menos 8 caracteres.</p>}
        <button className="button button--primary" type="submit" disabled={!gateway || loading || pending}>
          {pending ? 'Aguarde…' : mode === 'recovery' ? 'Enviar instruções' : mode === 'password' ? 'Salvar nova senha' : titles[mode]}
        </button>
      </form>
      <nav className="auth-links" aria-label="Opções de acesso">
        {mode === 'login' && <><Link to={`/criar-conta?${new URLSearchParams({ next })}`}>Criar conta</Link><Link to={`/recuperar-senha?${new URLSearchParams({ next })}`}>Esqueci minha senha</Link></>}
        {mode !== 'login' && <Link to={`/entrar?${new URLSearchParams({ next })}`}>Já tenho conta. Entrar</Link>}
        <Link to="/">Continuar sem entrar</Link>
      </nav>
    </div>
  );
}
