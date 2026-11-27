import {createContext,useContext,useEffect,useState} from 'react';
import type {ReactNode} from 'react';
import {supabase,publicSupabase} from '../lib/supabase';
import {useAuth} from '../auth/AuthProvider';
import {useReturnRevision} from '../hooks/useReturnRevision';
import {createPresenceRepository} from './repository';
import type {Presence,PresenceRepository} from './model';
const source=supabase&&publicSupabase?createPresenceRepository(supabase,publicSupabase):null;
const Context=createContext<PresenceRepository|null>(source);
export function PresenceProvider({value,children}:{value:PresenceRepository;children:ReactNode}){return <Context.Provider value={value}>{children}</Context.Provider>;}
export function usePresenceSource(){return useContext(Context);}
export function usePresence(id:string,owner:boolean,refreshOnReturn=true){
 const repository=usePresenceSource(),{session}=useAuth(),resume=useReturnRevision();
 const effectiveResume=refreshOnReturn?resume:0;
 const [data,setData]=useState<Presence|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{let live=true;setData(null);setError('');if(!repository)return;
 void repository.read(id,owner).then(value=>{if(live)setData(value);}).catch(()=>{if(live)setError('Equipe e localização indisponíveis. A ativação da migração ainda pode estar pendente.');});
 return()=>{live=false;};},[repository,id,owner,session?.user.id,effectiveResume,revision]);
 return {repository,data,error,reload:()=>setRevision(n=>n+1)};
}
