import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { supabase, publicSupabase } from "../lib/supabase";
import { createManagedPosts, createPublicPosts } from "./repository";
import type { ManagedPosts, PublicPosts } from "./types";
const defaultManaged = supabase ? createManagedPosts(supabase) : null,
  defaultPublic = publicSupabase ? createPublicPosts(publicSupabase) : null;
const Context = createContext<{
  managed: ManagedPosts | null;
  publicPosts: PublicPosts | null;
}>({ managed: null, publicPosts: null });
export function PostsProvider({
  children,
  managed = defaultManaged,
  publicPosts = defaultPublic,
}: {
  children: ReactNode;
  managed?: ManagedPosts | null;
  publicPosts?: PublicPosts | null;
}) {
  return (
    <Context.Provider value={{ managed, publicPosts }}>
      {children}
    </Context.Provider>
  );
}
export const usePosts = () => useContext(Context);
