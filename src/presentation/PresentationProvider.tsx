import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase, publicSupabase } from '../lib/supabase';
import { emptyPresentation } from './model';
import type { Presentation, PresentationRepository } from './model';
const repository: PresentationRepository | null = supabase ? {
  async get(id, publicOnly) {
    const client = publicOnly ? publicSupabase! : supabase!;
    const { data, error } = await client.from('business_presentations').select('headline,experience,education,certifications,professional_registration').eq('business_id',id).maybeSingle();
    if (error && ['42P01','PGRST205'].includes(error.code)) return { available: false, data: { ...emptyPresentation } };
    if (error) throw error;
    return { available: true, data: data ?? { ...emptyPresentation } };
  },
  async save(id, value) {
    const { error } = await supabase!.rpc('save_business_presentation', { target_business: id, p_headline: value.headline, p_experience: value.experience, p_education: value.education, p_certifications: value.certifications, p_registration: value.professional_registration });
    if (error) throw error;
  },
} : null;
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
