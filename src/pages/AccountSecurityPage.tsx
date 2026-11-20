import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { PageHeader } from '../components/PageHeader';
import { MenuRow } from '../components/MenuRow';

export function AccountSecurityPage() {
  const { session } = useAuth();
  return <div className="account-page"><Link className="back-link" to="/conta"><ArrowLeft size={17} aria-hidden="true" />Minha conta</Link>
    <PageHeader title="Segurança e acesso" />
    <div className="security-email"><Mail size={21} aria-hidden="true" /><div><strong>E-mail da conta</strong><p>{session?.user.email}</p></div></div>
    <MenuRow icon={ShieldCheck} title="Recuperar senha" description="Receba por e-mail um link para definir uma nova senha" to="/recuperar-senha?next=%2Fconta%2Fseguranca" />
    <p className="supporting-copy">Defina sua senha somente no aplicativo. Nunca a compartilhe em mensagens.</p>
  </div>;
}
