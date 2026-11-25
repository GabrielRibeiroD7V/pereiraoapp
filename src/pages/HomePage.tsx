import { ArrowRight, BriefcaseBusiness } from "lucide-react";
import { CategoryTile } from "../components/CategoryTile";
import { SearchField } from "../components/SearchField";
import { HomeProviders } from "../marketplace/HomeProviders";
import { SocialFeed } from "../social/SocialFeed";
import { categories } from "../config/categories";
import { Link } from "react-router-dom";

export function HomePage() {
  return (
    <div className="home-page">
      <section className="home-hero" aria-labelledby="page-title">
        <div className="home-hero__inner">
          <h1 id="page-title" tabIndex={-1}>
            O que você está <span>procurando?</span>
          </h1>
          <SearchField />
        </div>
      </section>
      <div className="home-content">
        <section className="professional-entry" aria-labelledby="invite-title">
          <Link to="/conta/profissional/cadastro" aria-label="Anunciar meus serviços">
            <BriefcaseBusiness size={17} aria-hidden="true" />
            <h2 id="invite-title">É profissional ou tem uma empresa?</h2>
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </section>
        <section className="home-section" aria-labelledby="categories-title">
          <h2 id="categories-title">Categorias populares</h2>
          <ul className="category-grid">
            {categories.map((category) => (
              <li key={category.id}>
                <CategoryTile category={category} />
              </li>
            ))}
          </ul>
        </section>
        <section className="home-section" aria-labelledby="featured-title">
          <h2 id="featured-title">Profissionais cadastrados</h2>
          <HomeProviders />
        </section>
        <SocialFeed />
      </div>
    </div>
  );
}
