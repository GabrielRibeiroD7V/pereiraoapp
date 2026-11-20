import { PageHeader } from '../components/PageHeader';
import { LinkButton } from '../components/LinkButton';
import { routes } from '../app/routes';

export function NotFoundPage() {
  return (
    <>
      <PageHeader eyebrow="Página não encontrada" title="Este caminho não existe">
        <p>Volte ao início para continuar navegando.</p>
      </PageHeader>
      <LinkButton to={routes.home}>Voltar ao início</LinkButton>
    </>
  );
}
