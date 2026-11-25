import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { supabase, publicSupabase } from "../lib/supabase";
import { createOffersRepository } from "./repository";
import type { OffersRepository } from "./model";
const defaults = {
  owner: supabase ? createOffersRepository(supabase) : null,
  public: publicSupabase ? createOffersRepository(publicSupabase) : null,
};
const Context = createContext(defaults);
export function OffersProvider({
  children,
  repository,
}: {
  children: ReactNode;
  repository?: OffersRepository;
}) {
  return (
    <Context.Provider
      value={repository ? { owner: repository, public: repository } : defaults}
    >
      {children}
    </Context.Provider>
  );
}
export function useOffers(privateView = false) {
  const repos = useContext(Context);
  return privateView ? repos.owner : repos.public;
}
export function offersError(e: unknown) {
  if (e instanceof Error) return e.message;
  const code = e && typeof e === "object" && "code" in e ? e.code : "";
  return code === "40001"
    ? "A oferta mudou em outra aba. Atualize a lista antes de editar."
    : code === "54000"
      ? "Limite atingido: até 100 ofertas e cinco produtos em destaque."
      : code === "42501"
        ? "Entre com a conta responsável e confirme seu e-mail."
        : code === "PGRST202"
          ? "Ofertas e busca unificada aguardam a migração autorizada."
          : "Não foi possível concluir. Seus dados anteriores foram preservados; tente novamente.";
}
