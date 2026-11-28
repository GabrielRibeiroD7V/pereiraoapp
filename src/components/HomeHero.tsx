import { SearchField } from './SearchField';

export function HomeHero() {
  return (
    <section className="home-hero" aria-labelledby="page-title">
      <div className="home-hero__inner">
        <h1 id="page-title" tabIndex={-1}>
          O que você está <span>procurando?</span>
        </h1>
        <SearchField />
      </div>
    </section>
  );
}
