"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

let client: SupabaseClient | undefined;
export function browserSupabase() {
  if (!client) {
    const { url, key } = supabaseConfig();
    client = createClient(url, key, {
      global: { fetch: (input, init) => fetch(input, {
        ...init, signal: AbortSignal.timeout(12_000),
      }) },
    });
  }
  return client;
}

export async function creatorAccessToken() {
  const supabase = browserSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error("Could not restore your session. Please refresh and try again.");
  if (data.session) return data.session.access_token;
  const result = await supabase.auth.signInAnonymously();
  if (result.error || !result.data.session) {
    throw new Error(result.error?.status === 429
      ? "Too many session requests. Please wait before trying again."
      : "Could not start a creator session. Please try again, or ask the site owner to check anonymous sign-in settings.");
  }
  return result.data.session.access_token;
}
