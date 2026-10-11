import { spawn, spawnSync } from "node:child_process";
import { startFixture } from "./supabase-fixture.mjs";

// Never inherit a real Supabase endpoint/key into the test application.
const testEnv = { ...process.env, PAYLINK_TEST_BUILD: "1",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3101",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_test_fixture_only",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
  PAYLINK_STAGING_PROJECT_REF: "",
  SUPABASE_SERVICE_ROLE_KEY: "", SUPABASE_SECRET_KEY: "" };
const productionMode = process.argv.includes("--production");
if (productionMode) {
  const build = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], {
    stdio: "inherit", env: testEnv,
  });
  if (build.status !== 0) process.exit(build.status ?? 1);
}
const fixture = await startFixture();
const nextArguments = productionMode
  ? ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3100"]
  : ["node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", "127.0.0.1", "--port", "3100"];
const child = spawn(process.execPath, nextArguments, { stdio: "inherit", env: testEnv });
function stop() { child.kill(); fixture.close(); }
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
child.on("exit", (code) => { fixture.close(); process.exit(code ?? 0); });
