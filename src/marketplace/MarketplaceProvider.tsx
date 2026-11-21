import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { publicSupabase } from '../lib/supabase';
import { createPublicMarketplace } from './repository';
import type { PublicMarketplace } from './types';
const defaultRepository = publicSupabase ? createPublicMarketplace(publicSupabase) : null;
const Context = createContext<PublicMarketplace | null>(null);
export function MarketplaceProvider({ children, repository = defaultRepository }: { children: ReactNode; repository?: PublicMarketplace | null }) { return <Context.Provider value={repository}>{children}</Context.Provider>; }
export const useMarketplace = () => useContext(Context);
