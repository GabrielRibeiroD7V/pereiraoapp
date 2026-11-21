import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import type { AdminRepository } from "./types";
export function createAdminRepository(
  client: SupabaseClient<Database>,
  request: typeof fetch = fetch,
): AdminRepository {
  async function call<T>(body: unknown, signal?: AbortSignal): Promise<T> {
    const { data, error } = await client.auth.getSession();
    if (error || !data.session) throw { code: "AUTH_REQUIRED" };
    const response = await request("/api/admin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + data.session.access_token,
      },
      body: JSON.stringify(body),
      signal,
      cache: "no-store",
    });
    const value = await response.json();
    if (!response.ok) throw { code: value.code ?? "UNAVAILABLE" };
    return value.data as T;
  }
  return {
    access: (signal) => call({ action: "access" }, signal),
    query: (section, filters, signal) =>
      call({ action: "query", section, filters }, signal),
    act: async (input) => {
      await call({ action: "command", input });
    },
    sandbox: () => call({ action: "sandbox" }),
    image: (businessId, path) => call({ action: "image", businessId, path }),
  };
}
