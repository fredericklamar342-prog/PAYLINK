import type { NextConfig } from "next";
import { supabaseConfig } from "./lib/supabase/config";

const hasSupabaseConfig = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

// Fail before bundling if public Supabase configuration is partial or contains a
// privileged key. Vercel staging builds also verify the intended project ref so
// a production Supabase URL cannot be selected accidentally.
if (hasSupabaseConfig || process.env.VERCEL) {
  const { url } = supabaseConfig();
  const expectedProjectRef = process.env.PAYLINK_STAGING_PROJECT_REF?.trim();

  if (process.env.VERCEL && !expectedProjectRef) {
    throw new Error("PAYLINK_STAGING_PROJECT_REF is required for Vercel staging builds.");
  }

  if (expectedProjectRef) {
    const expectedHost = `${expectedProjectRef}.supabase.co`;
    if (new URL(url).hostname !== expectedHost) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL does not match PAYLINK_STAGING_PROJECT_REF.");
    }
  }
}

const nextConfig: NextConfig = {
  // Isolate the test server/build from the developer's running site.
  distDir: process.env.PAYLINK_TEST_BUILD === "1" ? ".next-test" : ".next",
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: process.env.PAYLINK_TEST_BUILD !== "1",
  partialPrefetching: process.env.PAYLINK_TEST_BUILD !== "1",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
