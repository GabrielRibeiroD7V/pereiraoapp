import { UserRound } from 'lucide-react';
import { ContentState } from '../components/ContentState';
import { PageHeader } from '../components/PageHeader';
import { LinkButton } from '../components/LinkButton';
import { routes } from '../app/routes';

export function AccountPage() {
  return (
    <>
      <PageHeader title="Conta"><p>Seu espaço no PEREIRÃO.</p></PageHeader>
      <ContentState icon={UserRound} title="Uma conta, novas possibilidades">
        Em breve você poderá criar sua conta e cadastrar seu perfil profissional.
      </ContentState>
      <LinkButton to={routes.home} variant="secondary">Continuar explorando</LinkButton>
    </>
  );
}
