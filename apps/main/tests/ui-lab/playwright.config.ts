import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".", testMatch: "*.spec.ts", timeout: 30000, fullyParallel: false,
  use: { baseURL: process.env.UI_LAB_TEST_URL ?? "http://localhost:3000", browserName: "chromium", channel: "chrome", viewport: { width: 1440, height: 1000 }, timezoneId: "Asia/Shanghai", locale: "zh-CN", trace: "retain-on-failure" },
  reporter: [["list"], ["json", { outputFile: "../../test-results/ui-lab/results.json" }]], outputDir: "../../test-results/ui-lab/artifacts",
});
