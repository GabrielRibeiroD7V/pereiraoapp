import { ArrowRight, BriefcaseBusiness } from "lucide-react";
import { HomeCategories } from "../categories/HomeCategories";
import { SearchField } from "../components/SearchField";
import { HomeProviders } from "../marketplace/HomeProviders";
import { SocialFeed } from "../social/SocialFeed";
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
        <section className="home-professional-entry" aria-labelledby="invite-title">
          <Link to="/conta/profissional/cadastro" aria-label="Anunciar meus serviços">
            <BriefcaseBusiness size={17} aria-hidden="true" />
            <h2 id="invite-title">É profissional ou tem uma empresa?</h2>
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </section>
        <HomeCategories/>
        <section className="home-section" aria-labelledby="featured-title">
          <h2 id="featured-title">Profissionais cadastrados</h2>
          <HomeProviders />
        </section>
        <SocialFeed />
      </div>
    </div>
  );
}
