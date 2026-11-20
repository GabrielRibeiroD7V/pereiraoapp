import { Search } from 'lucide-react';
import { ContentState } from '../components/ContentState';
import { PageHeader } from '../components/PageHeader';
import { useSearchParams } from 'react-router-dom';
import { categories } from '../config/categories';

export function SearchPage() {
  const [params] = useSearchParams();
  const query = params.get('q')?.trim();
  const category = categories.find((item) => item.id === params.get('categoria'));
  return (
    <>
      <PageHeader title="Buscar"><p>Encontre serviços e profissionais na sua cidade.</p></PageHeader>
      {(query || category) && <div className="search-context" aria-label="Sua busca">
        {query && <p>Você pesquisou: <strong>{query}</strong></p>}
        {category && <p>Categoria: <strong>{category.name}</strong></p>}
      </div>}
      <ContentState icon={Search} title="Seu próximo serviço começa aqui">
        A busca por categorias e profissionais estará disponível em breve.
      </ContentState>
    </>
  );
}
