import{createContext,useContext}from'react';import type{ReactNode}from'react';
import{supabase,publicSupabase}from'../lib/supabase';import{createHoursRepository}from'./repository';import type{HoursRepository}from'./model';
const source=supabase&&publicSupabase?createHoursRepository(supabase,publicSupabase):null;
const Context=createContext<HoursRepository|null>(null);
export function HoursProvider({repository=source,children}:{repository?:HoursRepository|null;children:ReactNode}){return<Context.Provider value={repository}>{children}</Context.Provider>;}
export const useHoursRepository=()=>useContext(Context);
