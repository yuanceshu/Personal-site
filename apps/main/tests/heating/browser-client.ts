import type { Page } from "@playwright/test";
const requests = new WeakMap<Page, { demoState: string; headers: Record<string, string> }>();
export function watchPage(page: Page) {
  page.on("request", request => {
    if (!request.url().includes("/api/experiments/heating/") || !request.headers()["content-type"]?.includes("application/json")) return;
    try { const { demoState } = request.postDataJSON(); if (typeof demoState === "string") requests.set(page, { demoState, headers: request.headers() }); } catch { /* multipart carries metadata independently */ }
  });
}
export async function pageSnapshot(page: Page) {
  const state = requests.get(page); if (!state) throw Error("Page request state not observed");
  return page.evaluate(async ({ demoState, headers }) => {
    const response = await fetch("/api/experiments/heating/snapshot", { method: "POST", credentials: "omit", headers: { "Content-Type": "application/json", "X-Heating-Demo": "1", "X-Heating-Identity-Version": headers["x-heating-identity-version"], "X-Heating-Generation": headers["x-heating-generation"] }, body: JSON.stringify({ demoState }) });
    if (!response.ok) throw Error("Snapshot failed"); return (await response.json()).result;
  }, state);
}
export async function repeatConfirm(page: Page, proposalId: string) {
  const state = requests.get(page)!;
  return page.evaluate(async ({ demoState, headers, proposalId }) => {
    return (await fetch("/api/experiments/heating/confirm", { method: "POST", headers: { "Content-Type": "application/json", "X-Heating-Demo": "1", "X-Heating-Identity-Version": headers["x-heating-identity-version"], "X-Heating-Generation": headers["x-heating-generation"] }, body: JSON.stringify({ demoState, proposalId, confirmed: true }) })).status;
  }, { ...state, proposalId });
}

/** Exercise the actual signature UI with pointer strokes, never patch browser business state. */
export async function signInPage(page: Page) {
  const button = page.getByRole("button", { name: "手写签署", exact: true }).last();
  if (!await button.count()) return;
  await button.click();
  const pad = page.getByRole("img", { name: "演示手写签名板" });
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.6); await page.mouse.down();
  for (const [x,y] of [[0.3,0.2],[0.5,0.8],[0.7,0.3],[0.85,0.5]]) await page.mouse.move(box.x + box.width*x, box.y + box.height*y, { steps: 8 });
  await page.mouse.up(); await page.getByRole("button", { name: "确认模拟签署", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.locator(".heat-wait").waitFor({ state: "hidden" });
}
