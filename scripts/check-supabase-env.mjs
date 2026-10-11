import nextEnv from "@next/env";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const present = (name) => Boolean(process.env[name]?.trim());
console.log(JSON.stringify({
  rootLocalFileExists: existsSync(".env.local"),
  urlPresent: present("NEXT_PUBLIC_SUPABASE_URL"),
  publicKeyPresent: present("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") || present("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  serviceRoleKeyRequired: false,
}));
let unsafe = false;
for (const file of [".env.local", "lib/env.local"]) {
  const tracked = spawnSync("git", ["ls-files", "--", file], { encoding: "utf8" });
  const staged = spawnSync("git", ["diff", "--cached", "--name-only", "--", file], { encoding: "utf8" });
  const ignored = spawnSync("git", ["check-ignore", "-q", "--", file]);
  const state = { file, ignored: ignored.status === 0, tracked: Boolean(tracked.stdout?.trim()), staged: Boolean(staged.stdout?.trim()) };
  console.log(JSON.stringify(state));
  unsafe ||= state.tracked || state.staged || !state.ignored || tracked.status !== 0 || staged.status !== 0;
}
if (unsafe || !present("NEXT_PUBLIC_SUPABASE_URL") ||
    !(present("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") || present("NEXT_PUBLIC_SUPABASE_ANON_KEY"))) process.exitCode = 1;
