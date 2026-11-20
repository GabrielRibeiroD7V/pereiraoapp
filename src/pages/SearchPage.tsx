import { Search } from 'lucide-react';
import { ContentState } from '../components/ContentState';
import { PageHeader } from '../components/PageHeader';

export function SearchPage() {
  return (
    <>
      <PageHeader title="Buscar"><p>Encontre serviços e profissionais na sua cidade.</p></PageHeader>
      <ContentState icon={Search} title="Seu próximo serviço começa aqui">
        A busca por categorias e profissionais estará disponível em breve.
      </ContentState>
    </>
  );
}
