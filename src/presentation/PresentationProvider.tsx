import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase, publicSupabase } from '../lib/supabase';
import { emptyPresentation } from './model';
import { createPresentationRepository } from './repository';
import type { Presentation, PresentationRepository } from './model';
const repository = supabase ? createPresentationRepository(supabase, publicSupabase!) : null;
const Context = createContext<PresentationRepository | null>(null);
export function PresentationProvider({ children, value = repository }: { children: ReactNode; value?: PresentationRepository | null }) { return <Context.Provider value={value}>{children}</Context.Provider>; }
export function usePresentationRepository() { return useContext(Context); }
export function usePresentation(id: string, publicOnly = false) {
  const source = usePresentationRepository();
  const [data, setData] = useState<Presentation>(emptyPresentation), [error, setError] = useState(false);
  useEffect(() => {
    let live = true; setData(emptyPresentation); setError(false);
    if (source) void source.get(id, publicOnly).then(result => { if(live) setData(result.data); }).catch(() => { if(live) setError(true); });
    return () => { live = false; };
  }, [source,id,publicOnly]);
  return { data,error };
}
