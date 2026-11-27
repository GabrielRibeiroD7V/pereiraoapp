import { ArrowRight, BriefcaseBusiness } from "lucide-react";
import { Link } from "react-router-dom";
import { HomeBannerCarousel } from "../components/HomeBannerCarousel";
import { HomeCategories } from "../categories/HomeCategories";
import { SearchField } from "../components/SearchField";
import { HomeProviders } from "../marketplace/HomeProviders";
import { SocialFeed } from "../social/SocialFeed";

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
        <HomeBannerCarousel/>
        <section className="home-professional-entry" aria-label="É profissional ou tem uma empresa?">
          <Link to="/conta/profissional" aria-label="É profissional ou tem uma empresa? Cadastre-se">
            <BriefcaseBusiness size={17} aria-hidden="true"/>
            <span>É profissional ou tem uma empresa? <strong>Cadastre-se</strong></span>
            <ArrowRight size={17} aria-hidden="true"/>
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
