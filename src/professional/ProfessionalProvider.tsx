import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { createProfessionalRepository } from './repository';
import type { ProfessionalRepository } from './types';

const defaultRepository = supabase ? createProfessionalRepository(supabase) : null;
const RepositoryContext = createContext<ProfessionalRepository | null>(null);
export function ProfessionalProvider({ children, repository = defaultRepository }: { children: ReactNode; repository?: ProfessionalRepository | null }) {
  return <RepositoryContext.Provider value={repository}>{children}</RepositoryContext.Provider>;
}
export function useProfessionalRepository() { return useContext(RepositoryContext); }
