import { useAuth } from '../auth/AuthProvider';
import { PageHeader } from '../components/PageHeader';
import { LinkButton } from '../components/LinkButton';

export function PersonalDataPage() {
  const { session } = useAuth();
  return <>
    <PageHeader title="Meus dados"><p>Informações da sua conta.</p></PageHeader>
    <dl className="account-details">
      <dt>Nome</dt><dd>{session?.user.displayName || 'Nome não informado'}</dd>
      <dt>E-mail</dt><dd>{session?.user.email || 'E-mail não informado'}</dd>
    </dl>
    <LinkButton to="/conta" variant="secondary">Voltar à conta</LinkButton>
  </>;
}
