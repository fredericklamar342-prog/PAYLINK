import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

// Per-request client: never share a user's Authorization header between requests.
// No service-role key: creation runs with the verified user's identity.
export function serverSupabase(accessToken?: string) {
  const { url, key } = supabaseConfig();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      fetch: (input, init) => fetch(input, {
        ...init, cache: "no-store", signal: AbortSignal.timeout(10_000),
      }),
    },
  });
}
