import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "settlement-proof.spec.ts",
  workers: 1,
});
