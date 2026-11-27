import { useCallback } from 'react';
import { useMarketplace } from '../marketplace/MarketplaceProvider';
import { usePublicQuery } from '../marketplace/usePublicQuery';

export function useCategoryCatalog() {
  const repository=useMarketplace();
  const load=useCallback((signal:AbortSignal)=>repository?repository.getCategories(signal):Promise.resolve([]),[repository]);
  return usePublicQuery('active-categories',load,false,60_000);
}
