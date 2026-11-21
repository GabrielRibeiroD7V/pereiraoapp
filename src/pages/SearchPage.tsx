import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { ProviderList } from '../components/ProviderList';
import { categories } from '../config/categories';
import { useMarketplace } from '../marketplace/MarketplaceProvider';
import { usePublicQuery } from '../marketplace/usePublicQuery';
import { pageNumber, readFilters } from '../marketplace/validation';
import { QueryStatus } from '../marketplace/QueryStatus';
import { Pagination } from '../marketplace/Pagination';

function FilterForm({ params, onSubmit }: { params: URLSearchParams; onSubmit: (params: URLSearchParams) => void }) {
  const filters = readFilters(params), repository = useMarketplace();
  const [query, setQuery] = useState(filters.query);
  const [selectedCity, setSelectedCity] = useState(filters.cityId);
  const load = useCallback((signal: AbortSignal) => repository ? repository.getCities(signal) : Promise.resolve([]), [repository]);
  const cities = usePublicQuery('cities', load);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget), next = new URLSearchParams();
    const term = query.trim().slice(0, 200); if (term) next.set('q', term);
    const category = String(values.get('categoria') ?? ''); if (category) next.set('categoria', category);
    const city = String(values.get('cidade') ?? ''); next.set('cidade', city || 'todas');
    const type = String(values.get('tipo') ?? ''); if (type) next.set('tipo', type);
    onSubmit(next);
  }
  return <form className="public-filters" role="search" onSubmit={submit}>
    <div className="form-field public-search-input"><label htmlFor="market-query">Buscar por nome, especialidade ou serviço</label><input id="market-query" type="search" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={200} placeholder="Qual serviço você procura?" /></div>
    <div className="form-field"><label htmlFor="market-category">Categoria</label><select id="market-category" name="categoria" defaultValue={filters.categoryId}><option value="">Todas as categorias</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
    <div className="form-field"><label htmlFor="market-city">Cidade atendida</label><select id="market-city" name="cidade" value={selectedCity} onChange={(event) => setSelectedCity(event.target.value)}><option value="">Todas as cidades</option>{selectedCity && !cities.data?.some((item) => item.id === selectedCity) && <option value={selectedCity}>{selectedCity === 'mundo-novo-ms' ? 'Mundo Novo/MS' : 'Localidade selecionada'}</option>}{cities.data?.map((item) => <option key={item.id} value={item.id}>{item.name}/{item.state}</option>)}</select></div>
    <div className="form-field"><label htmlFor="market-type">Tipo de prestador</label><select id="market-type" name="tipo" defaultValue={filters.type}><option value="">Todos</option><option value="autonomo">Autônomos</option><option value="empresa">Empresas</option></select></div>
    <button className="button button--primary" type="submit"><Search size={18} aria-hidden="true" />Pesquisar</button>
    {cities.error && <p role="status" className="field-help">Não foi possível atualizar as cidades. <button className="text-link" type="button" onClick={cities.retry}>Tentar novamente</button></p>}
  </form>;
}
export function SearchPage() {
  const [params, setParams] = useSearchParams(), repository = useMarketplace();
  const { query, categoryId, cityId, type } = readFilters(params), current = pageNumber(params.get('pagina'));
  const category = categories.find((item) => item.id === categoryId);
  const load = useCallback((signal: AbortSignal) => repository ? repository.search({ query, categoryId, cityId, type }, current, signal) : Promise.resolve({ items: [], page: current, hasNext: false }), [repository, query, categoryId, cityId, type, current]);
  const state = usePublicQuery(JSON.stringify([query, categoryId, cityId, type, current]), load);
  function turn(page: number) { const next = new URLSearchParams(params); next.set('pagina', String(page)); setParams(next); }
  return <div className="public-marketplace"><PageHeader title="Buscar"><p>Encontre serviços e profissionais na sua cidade.</p></PageHeader>
    <FilterForm key={params.toString()} params={params} onSubmit={setParams} />
    {(query || category) && <div className="search-context" aria-label="Sua busca">{query && <p>Você pesquisou: <strong>{query}</strong></p>}{category && <p>Categoria: <strong>{category.name}</strong></p>}</div>}
    {!repository ? <p className="form-notice">A busca está sendo preparada. Tente novamente em breve.</p> : <><QueryStatus {...state} />{state.data && <section aria-label="Resultados da busca" aria-live="polite"><p className="field-help">{state.data.items.length ? 'Profissionais e empresas · ordem alfabética' : 'Nenhum profissional encontrado para estes filtros.'}</p><ProviderList providers={state.data.items} /><Pagination page={current} hasNext={state.data.hasNext} onChange={turn} label="resultados" /></section>}</>}
  </div>;
}
