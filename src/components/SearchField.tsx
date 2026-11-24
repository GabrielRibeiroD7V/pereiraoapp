import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { FormEvent } from 'react';
import { routes } from '../app/routes';

export function SearchField() {
  const navigate = useNavigate();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = String(new FormData(event.currentTarget).get('q') ?? '').trim();
    const params = new URLSearchParams();
    if (term) params.set('q', term);
    navigate(`${routes.search}${params.size ? `?${params}` : ''}`);
  }

  return (
    <form className="search-field" role="search" onSubmit={submit}>
      <Search className="search-field__leading" size={22} aria-hidden="true" />
      <label className="visually-hidden" htmlFor="home-search">Buscar serviços ou profissionais</label>
      <input id="home-search" type="search" name="q" maxLength={200}
        placeholder="Buscar serviços ou profissionais" enterKeyHint="search" />
      <button type="submit" aria-label="Pesquisar"><Search size={22} aria-hidden="true" /></button>
    </form>
  );
}
