import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".", testMatch: "*.spec.ts", timeout: 30000, fullyParallel: false,
  use: { baseURL: process.env.TRAVEL_TEST_URL ?? "http://localhost:3000", browserName: "chromium", channel: "chrome", viewport: { width: 1440, height: 1100 }, trace: "retain-on-failure" },
  reporter: "list", outputDir: "../../test-results/island-travel",
});
