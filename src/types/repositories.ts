import type {
  Account, PageResult, PortfolioItem, Provider, ProviderService, SearchFilters,
} from './domain';

/** Implementações, autenticação e políticas de acesso pertencem a PRs futuros.
 * Nunca confiar em ownerId/IDs recebidos do cliente para conceder acesso.
 */
export interface MarketplaceRepository {
  search(filters: SearchFilters, page: number, signal?: AbortSignal): Promise<PageResult<Provider>>;
  getProvider(slug: string, signal?: AbortSignal): Promise<Provider | null>;
  getServices(providerId: string, signal?: AbortSignal): Promise<readonly ProviderService[]>;
  getPortfolio(providerId: string, signal?: AbortSignal): Promise<readonly PortfolioItem[]>;
}

export interface AccountRepository {
  getCurrentAccount(): Promise<Account | null>;
  signOut(): Promise<void>;
}
