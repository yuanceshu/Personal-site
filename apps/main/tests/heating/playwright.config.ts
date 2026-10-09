import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";
const remote = process.env.HEATING_BROWSER_REMOTE === "1";
const origin = process.env.HEATING_VERIFY_ORIGIN;
if (remote && (!origin || new URL(origin).protocol !== "https:" || new URL(origin).origin !== origin)) throw new Error("远程浏览器验收需要明确的 HTTPS HEATING_VERIFY_ORIGIN，无路径或凭据。");
export default defineConfig({ testDir: ".", testMatch: remote || process.env.HEATING_BROWSER_LIVE === "1" ? "live.browser.spec.ts" : "browser.spec.ts", timeout: 240000, workers: 1, fullyParallel: false, use: { baseURL: remote ? origin : "http://127.0.0.1:3216", browserName: "chromium", channel: "chrome", viewport: { width: 1440, height: 1000 }, trace: "off" }, webServer: remote ? undefined : { command: "npx tsx tests/heating/browser-server.ts", cwd: resolve(__dirname, "../.."), url: "http://127.0.0.1:3216/works/demos/heating", reuseExistingServer: false, gracefulShutdown: { signal: "SIGTERM", timeout: 5000 }, timeout: 120000 }, reporter: "list", outputDir: "../../test-results/heating" });
