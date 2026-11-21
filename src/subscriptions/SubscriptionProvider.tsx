import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { createSubscriptionRepository } from "./repository";
import type { SubscriptionRepository } from "./types";
const fallback = supabase ? createSubscriptionRepository(supabase) : null;
const Context = createContext<SubscriptionRepository | null>(null);
export function SubscriptionProvider({
  children,
  repository = fallback,
}: {
  children: ReactNode;
  repository?: SubscriptionRepository | null;
}) {
  return <Context.Provider value={repository}>{children}</Context.Provider>;
}
export const useSubscriptions = () => useContext(Context);
