import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ProviderList } from '../components/ProviderList';
import { useMarketplace } from './MarketplaceProvider';
import { usePublicQuery } from './usePublicQuery';
import { QueryStatus } from './QueryStatus';
export function HomeProviders() {
  const repository = useMarketplace();
  const load = useCallback(async (signal: AbortSignal) => repository ? repository.search({ query: '', categoryId: '', cityId: 'mundo-novo-ms', type: '' }, 1, signal) : { items: [], page: 1, hasNext: false }, [repository]);
  const state = usePublicQuery('home', load, true, 30_000);
  if (!repository) return <ProviderList providers={[]} />;
  return <><QueryStatus {...state} />{state.data && <><ProviderList providers={state.data.items.slice(0, 8)} carousel />{state.data.items.length > 0 && <Link className="text-link" to="/buscar?cidade=mundo-novo-ms">Ver profissionais</Link>}</>}</>;
}
