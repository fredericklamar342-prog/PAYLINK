import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// The isolated audit server must already be running on port 3100.
export default defineConfig({
  ...base,
  webServer: undefined,
  outputDir: "artifacts/frontend-audit/states",
  testMatch: ["wallet.spec.ts", "stored-wallet.spec.ts", "interface.spec.ts", "payments.spec.ts", "premium-interface.spec.ts"],
  use: { ...base.use, screenshot: "on" },
});
