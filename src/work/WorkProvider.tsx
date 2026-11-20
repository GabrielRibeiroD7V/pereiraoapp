import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { createWorkRepository } from './repository';
import type { WorkRepository } from './types';
const defaultRepository = supabase ? createWorkRepository(supabase) : null;
const Context = createContext<WorkRepository | null>(null);
export function WorkProvider({ children, repository = defaultRepository }: { children: ReactNode; repository?: WorkRepository | null }) { return <Context.Provider value={repository}>{children}</Context.Provider>; }
export function useWorkRepository() { return useContext(Context); }
