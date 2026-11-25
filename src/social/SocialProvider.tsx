import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { createSocialRepository } from "./repository";
import type { SocialRepository } from "./model";
const defaultRepository = supabase ? createSocialRepository(supabase) : null;
const Context = createContext<SocialRepository | null>(defaultRepository);
export const useSocial = () => useContext(Context);
export function SocialProvider({
  repository,
  children,
}: {
  repository: SocialRepository | null;
  children: ReactNode;
}) {
  return <Context.Provider value={repository}>{children}</Context.Provider>;
}
