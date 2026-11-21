import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { supabase } from "../lib/supabase";
import type { SandboxBillingRepository } from "./types";
import { createBillingRepository } from "./repository";
const fallback = supabase ? createBillingRepository(supabase) : null;
const Context = createContext<SandboxBillingRepository | null>(null);
export function BillingProvider({
  children,
  repository = fallback,
}: {
  children: ReactNode;
  repository?: SandboxBillingRepository | null;
}) {
  return <Context.Provider value={repository}>{children}</Context.Provider>;
}
export const useBilling = () => useContext(Context);
