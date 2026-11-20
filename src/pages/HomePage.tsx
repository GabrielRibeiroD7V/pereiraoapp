import { Search } from 'lucide-react';
import { LinkButton } from '../components/LinkButton';
import { PageHeader } from '../components/PageHeader';
import { routes } from '../app/routes';

export function HomePage() {
  return (
    <>
      <PageHeader eyebrow="Serviços na sua cidade" title="O que você está procurando?">
        <p>Profissionais autônomos e empresas, perto de você.</p>
      </PageHeader>
      <LinkButton to={routes.search}><Search size={20} aria-hidden="true" />Buscar serviços</LinkButton>
      <p className="supporting-copy">Navegue livremente pelo PEREIRÃO. Você não precisa entrar para explorar.</p>
    </>
  );
}
