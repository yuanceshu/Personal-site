import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  use: {
    baseURL: process.env.HOME_TEST_URL ?? "http://localhost:3000",
    browserName: "chromium",
    channel: "chrome",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  reporter: "list",
  outputDir: "../../test-results/home",
});
