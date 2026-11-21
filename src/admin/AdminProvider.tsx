import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { createAdminRepository } from "./repository";
import type { AdminRepository } from "./types";
import { supabase } from "../lib/supabase";
const fallback = supabase ? createAdminRepository(supabase) : null;
const Context = createContext<AdminRepository | null>(null);
export function AdminProvider({
  children,
  repository = fallback,
}: {
  children: ReactNode;
  repository?: AdminRepository | null;
}) {
  return <Context.Provider value={repository}>{children}</Context.Provider>;
}
export const useAdmin = () => useContext(Context);
