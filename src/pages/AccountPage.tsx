import { BriefcaseBusiness, ChevronRight, CreditCard, LogOut, MessageSquare, Settings2, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { MenuRow } from '../components/MenuRow';
import { usePersonalProfile } from '../auth/usePersonalProfile';
import { PageHeader } from '../components/PageHeader';
import { LinkButton } from '../components/LinkButton';
import { routes } from '../app/routes';
import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { authErrorMessage } from '../auth/errors';
import {AdminEntry} from '../admin/AdminEntry';

export function AccountPage() {
  const { session, gateway, loading, error: sessionError } = useAuth();
  const { profile, error: profileError } = usePersonalProfile();
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
    <div className="account-page">
      <PageHeader title="Minha conta" />
      {loading ? <p role="status">Verificando sua sessão…</p> : session ? <>
        <Link className="personal-heading" to="/conta/dados" aria-label="Editar dados da conta">
          <ProfileAvatar src={profile.avatarUrl} /><div className="personal-heading__copy"><h2>{profile.displayName}</h2><p>Nome e e-mail da conta</p></div><ChevronRight size={23} aria-hidden="true" />
        </Link>
        {profileError && <p role="status" className="field-help">Não foi possível atualizar seus dados agora. Tente novamente em Dados da conta.</p>}
      </> : <>
        <div className="personal-heading"><ProfileAvatar /><div className="personal-heading__copy"><h2>Bem-vindo ao PEREIRÃO</h2><p>Encontre serviços ou anuncie seu trabalho.</p></div></div>
        <div className="account-actions"><LinkButton to="/entrar">Entrar</LinkButton><LinkButton to="/criar-conta" variant="secondary">Criar conta</LinkButton></div>
      </>}
      {(error || sessionError) && <p className="form-error" role="alert">{error || sessionError}</p>}
      <Link className="professional-entry" to={session ? '/conta/profissional' : '/conta/profissional/cadastro'}>
        <span className="professional-entry__icon"><BriefcaseBusiness size={28} strokeWidth={1.7} aria-hidden="true" /></span>
        <span><strong>Meu perfil profissional</strong><span>Prévia, fotos, serviços e publicações.</span></span><ChevronRight size={23} aria-hidden="true" />
      </Link>
      {session && <div className="account-menu">
        <MenuRow icon={MessageSquare} title="Mensagens" description="Converse com profissionais e clientes" to="/mensagens" />
        <AdminEntry />
        <MenuRow icon={CreditCard} title="Gratuidade e assinatura" description="Consulte a situação de cada negócio" to="/conta/assinaturas"/>
        <MenuRow icon={ShieldCheck} title="Segurança e acesso" description="E-mail e recuperação de senha" to="/conta/seguranca" />
        <MenuRow icon={Settings2} title="Configurações" description="Preferências e notificações" soon />
        <MenuRow icon={LogOut} title={pending ? 'Saindo…' : 'Sair da conta'} description="Encerrar sua sessão no PEREIRÃO" onClick={() => void signOut()} pending={pending} danger />
      </div>}
      <Link className="text-link account-explore" to={routes.home}>Continuar explorando</Link>
    </div>
  );
}
