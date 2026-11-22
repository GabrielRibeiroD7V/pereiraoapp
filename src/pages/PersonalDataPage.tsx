import { useAuth } from '../auth/AuthProvider';
import { PageHeader } from '../components/PageHeader';
import { LinkButton } from '../components/LinkButton';
import { usePersonalProfile } from '../auth/usePersonalProfile';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { FormField } from '../components/FormField';

export function PersonalDataPage() {
  const { session, gateway } = useAuth();
  const { profile, loading, error: loadError } = usePersonalProfile();
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setName(profile.displayName); }, [profile.displayName]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!gateway?.updateProfile || pending || loading || loadError) return;
    if (name.trim().length < 2 || name.trim().length > 100) { setError('Informe um nome entre 2 e 100 caracteres.'); return; }
    setPending(true); setError(null); setMessage(null);
    try { await gateway.updateProfile(name.trim()); setMessage('Seus dados foram salvos.'); }
    catch { setError('Não foi possível salvar seus dados. Tente novamente.'); }
    finally { setPending(false); }
  }
  return <div className="account-page">
    <PageHeader title="Meus dados"><p>Informações da sua conta.</p></PageHeader>
    {loading && <p role="status">Carregando seus dados…</p>}
    {loadError && <p role="alert" className="form-error">Não foi possível carregar seus dados. Reabra esta página para tentar novamente.</p>}
    {error && <p role="alert" className="form-error">{error}</p>}
    {message && <p role="status" className="form-notice">{message}</p>}
    <form className="auth-form personal-form" onSubmit={save}>
      <FormField id="personal-name" label="Seu nome" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} autoComplete="name" required disabled={loading || pending || loadError || !gateway?.updateProfile} />
      <dl className="account-details"><dt>E-mail</dt><dd>{session?.user.email || 'E-mail não informado'}</dd></dl>
      {gateway?.updateProfile && <button className="button button--primary" disabled={loading || pending || loadError}>{pending ? 'Salvando…' : 'Salvar meus dados'}</button>}
    </form>
    <section className="personal-professional-link" aria-labelledby="professional-data-title">
      <h2 id="professional-data-title">Perfil profissional</h2>
      <p>Descrição, cidade, contatos, serviços e trabalhos ficam no seu Espaço Profissional.</p>
      <LinkButton to="/conta/profissional" variant="secondary">Abrir meu perfil profissional</LinkButton>
    </section>
    <LinkButton to="/conta" variant="secondary">Voltar à conta</LinkButton>
  </div>;
}
