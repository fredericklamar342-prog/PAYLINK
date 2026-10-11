export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Payment storage is not configured yet. Please contact the site owner.");
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" &&
      !(parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname))) {
    throw new Error("Payment storage configuration is invalid.");
  }
  // Refuse privileged keys accidentally placed in public configuration.
  if (key.startsWith("sb_secret_")) throw new Error("Use a Supabase publishable key, not a secret key.");
  if (key.split(".").length === 3) {
    try {
      const payload = JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      if (payload.role !== "anon") throw new Error("Invalid public key role.");
    } catch {
      throw new Error("Use a Supabase publishable key or legacy anon key.");
    }
  } else if (!key.startsWith("sb_publishable_")) {
    throw new Error("Use a Supabase publishable key or legacy anon key.");
  }
  return { url, key };
}
