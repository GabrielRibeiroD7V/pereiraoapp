import { BriefcaseBusiness } from 'lucide-react';
import { CategoryTile } from '../components/CategoryTile';
import { PageHeader } from '../components/PageHeader';
import { SearchField } from '../components/SearchField';
import { ProviderList } from '../components/ProviderList';
import { categories } from '../config/categories';
import { LinkButton } from '../components/LinkButton';

export function HomePage() {
  return (
    <>
      <PageHeader title="O que você está procurando?" />
      <SearchField />
      <section className="home-section" aria-labelledby="categories-title">
        <h2 id="categories-title">Categorias populares</h2>
        <ul className="category-grid">
          {categories.map((category) => <li key={category.id}><CategoryTile category={category} /></li>)}
        </ul>
      </section>
      <section className="home-section" aria-labelledby="featured-title">
        <h2 id="featured-title">Profissionais em destaque</h2>
        <ProviderList providers={[]} />
      </section>
      <section className="provider-invite" aria-labelledby="invite-title">
        <BriefcaseBusiness size={24} aria-hidden="true" />
        <div>
          <h2 id="invite-title">É profissional ou tem uma empresa?</h2>
          <p>Divulgue seus serviços no PEREIRÃO e seja encontrado na sua cidade.</p>
          <LinkButton to="/conta/profissional/cadastro" variant="secondary">Anunciar meus serviços</LinkButton>
        </div>
      </section>
    </>
  );
}
