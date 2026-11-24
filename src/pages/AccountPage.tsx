import {profileBusinessSelections} from '../posts/postReturn';
import {InitialFreeNotice} from '../subscriptions/InitialFreeNotice';
import { useEffect, useState } from 'react';
import { BriefcaseBusiness, CreditCard, Ellipsis, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { InstallAppAccess } from '../pwa/PwaProvider';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { usePersonalProfile } from '../auth/usePersonalProfile';
import { LinkButton } from '../components/LinkButton';
import { PageHeader } from '../components/PageHeader';
import { routes } from '../app/routes';
import { useAuth } from '../auth/AuthProvider';
import { authErrorMessage } from '../auth/errors';
import { AdminEntry } from '../admin/AdminEntry';
import { useProfessionalRepository } from '../professional/ProfessionalProvider';
import { professionalError } from '../professional/validation';
import { ProfilePreviewPage } from './ProfilePreviewPage';
import type { BusinessRow } from '../lib/database.types';

export function AccountPage() {
  const { session, gateway, loading, error: sessionError } = useAuth();
  const { profile, error: profileError } = usePersonalProfile();
  const professional = useProfessionalRepository();
  const location = useLocation();
  const [businesses, setBusinesses] = useState<readonly BusinessRow[]>([]);
  const [selectedId, setSelectedId] = useState(()=>profileBusinessSelections.get(location.key)??'');
  const [businessesLoading, setBusinessesLoading] = useState(true);
  const [businessesError, setBusinessesError] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setBusinesses([]); setBusinessesError(''); setBusinessesLoading(true);
    if (!session || !professional) { setBusinessesLoading(false); return; }
    void professional.listMine().then(rows => { if (live) setBusinesses(rows); })
      .catch((cause: unknown) => { if (live) setBusinessesError(professionalError(cause)); })
      .finally(() => { if (live) setBusinessesLoading(false); });
    return () => { live = false; };
  }, [session?.user.id, professional]);
  const selected = businesses.find(item => item.id === (selectedId || location.state?.businessId)) ?? businesses[0];
  useEffect(()=>{if(selected){profileBusinessSelections.set(location.key,selected.id);if(profileBusinessSelections.size>40)profileBusinessSelections.delete(profileBusinessSelections.keys().next().value!);}},[location.key,selected?.id]);
  async function signOut() {
    if (!gateway || pending) return;
    setPending(true); setError(null);
    try { await gateway.signOut(); }
    catch (cause) { setError(authErrorMessage(cause)); }
    finally { setPending(false); }
  }
  return <div className="account-page">
    {!session && <PageHeader title="Minha conta" />}
    {loading ? <p role="status">Verificando sua sessão…</p> : session ? <>
      <header className="owner-toolbar"><h1>Meu perfil</h1><div>
        <details className="owner-settings"><summary aria-label="Opções da conta"><Ellipsis aria-hidden="true" /></summary>
          <nav aria-label="Opções da conta">
            <Link to="/conta/dados"><UserRound size={18} />Dados da conta</Link>
            {selected && <Link to="/conta/profissional/cadastro"><BriefcaseBusiness size={18} />Cadastrar outro negócio</Link>}
            {selected?.type === 'empresa' && <Link to={`/conta/profissional/${selected.id}/dados-empresariais`}><BriefcaseBusiness size={18} />Dados empresariais privados</Link>}
            <Link to="/conta/seguranca"><ShieldCheck size={18} />Segurança e acesso</Link>
            <Link to="/conta/assinaturas"><CreditCard size={18} />Gratuidade e assinatura</Link>
            <InstallAppAccess menu />
            <AdminEntry />
            <button type="button" disabled={pending} onClick={() => void signOut()}><LogOut size={18} />{pending ? 'Saindo…' : 'Sair da conta'}</button>
          </nav>
        </details>
      </div></header>
      <InitialFreeNotice /><p className="owner-account-name">Conta de {profile.displayName}</p>
      {location.state?.saved && <p className="form-notice" role="status">Rascunho salvo. Confira sua bio, foto e informações abaixo.</p>}
      {profileError && <p role="status" className="field-help">Não foi possível atualizar seus dados agora.</p>}
      {(error || sessionError) && <p className="form-error" role="alert">{error || sessionError}</p>}
      {businessesLoading && <p role="status">Carregando seu perfil…</p>}
      {businessesError && <p role="alert" className="form-error">{businessesError}</p>}
      {!businessesLoading && !businessesError && !professional && <p role="status">Perfil profissional indisponível neste momento.</p>}
      {!businessesLoading && !businessesError && professional && businesses.length === 0 && <section className="owner-empty">
        <ProfileAvatar src={profile.avatarUrl} /><h2>{profile.displayName}</h2><p>Você ainda não cadastrou um perfil profissional. Crie um rascunho para adicionar bio, foto, serviços e trabalhos.</p>
        <LinkButton to="/conta/profissional/cadastro">Criar perfil profissional</LinkButton>
      </section>}
      {selected && <>
        {businesses.length > 1 && <div className="business-selector form-field"><label htmlFor="owner-business">Perfil que você está vendo</label>
          <select id="owner-business" value={selected.id} onChange={event => setSelectedId(event.target.value)}>{businesses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>}
        <ProfilePreviewPage key={selected.id} businessIdOverride={selected.id} embedded />
      </>}
    </> : <>
      <div className="personal-heading"><ProfileAvatar /><div className="personal-heading__copy"><h2>Bem-vindo ao PEREIRÃO</h2><p>Encontre serviços ou anuncie seu trabalho.</p></div></div>
      <div className="account-actions"><LinkButton to="/entrar">Entrar</LinkButton><LinkButton to="/criar-conta" variant="secondary">Criar conta</LinkButton></div>
      <Link className="professional-entry" to="/conta/profissional/cadastro"><span className="professional-entry__icon"><BriefcaseBusiness size={28} aria-hidden="true" /></span><span><strong>Anunciar meus serviços</strong><span>Crie seu perfil profissional.</span></span></Link>
      <Link className="text-link account-explore" to={routes.home}>Continuar explorando</Link>
    </>}
    {!session && <InstallAppAccess />}
  </div>;
}
